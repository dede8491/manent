import type { Board, BoardPin, Book, Quote } from '@/types';
import type { SyncGateway } from './gateway';
import {
  boardToRow, bookToRow, pinToRow, quoteToRow,
  rowToBoard, rowToBook, rowToPin, rowToQuote,
  type BoardRow, type BookRow, type PinRow, type QuoteRow,
} from './mappers';
import { mergeById, newestFirst, removeDeleted } from './merge';
import { dequeue, groupByEntity } from './outbox';
import type { SyncEntity, SyncOperation, SyncReport, SyncedRow } from './types';

/** Ce que le moteur lit et réécrit dans le store. */
export interface SyncSnapshot {
  books: Book[];
  quotes: Quote[];
  boards: Board[];
  pins: BoardPin[];
  outbox: SyncOperation[];
  lastSyncedAt: string | null;
}

export interface SyncOutcome {
  snapshot: SyncSnapshot;
  report: SyncReport;
}

const emptyReport = (): SyncReport => ({
  pushed: 0,
  pulled: 0,
  deleted: 0,
  rejected: [],
  skipped: null,
});

/** Retrouve la ligne locale visée par une opération d'envoi. */
function rowFor(
  entity: SyncEntity,
  rowId: string,
  snapshot: SyncSnapshot,
  userId: string,
): Record<string, unknown> | null {
  switch (entity) {
    case 'books': {
      const book = snapshot.books.find((b) => b.id === rowId);
      return book ? { ...bookToRow(book, userId) } : null;
    }
    case 'quotes': {
      const quote = snapshot.quotes.find((q) => q.id === rowId);
      return quote ? { ...quoteToRow(quote, userId) } : null;
    }
    case 'boards': {
      const board = snapshot.boards.find((b) => b.id === rowId);
      return board ? { ...boardToRow(board, userId) } : null;
    }
    case 'board_quotes': {
      const pin = snapshot.pins.find((p) => p.id === rowId);
      return pin ? { ...pinToRow(pin, userId) } : null;
    }
  }
}

/**
 * Rejoue l'outbox vers le serveur. Une entité qui échoue laisse ses opérations
 * en file — elles repartiront à la prochaine tentative ; les autres entités
 * continuent, pour qu'un blocage isolé ne gèle pas toute la synchronisation.
 */
async function push(
  gateway: SyncGateway,
  snapshot: SyncSnapshot,
  userId: string,
  report: SyncReport,
): Promise<SyncOperation[]> {
  let remaining = snapshot.outbox;

  for (const { entity, operations } of groupByEntity(snapshot.outbox)) {
    const upserts = operations.filter((o) => o.op === 'upsert');
    const deletes = operations.filter((o) => o.op === 'delete');

    const rows: Record<string, unknown>[] = [];
    const orphans: SyncOperation[] = [];
    for (const operation of upserts) {
      const row = rowFor(entity, operation.rowId, snapshot, userId);
      // La ligne a disparu localement entre-temps : l'opération n'a plus d'objet.
      if (row) rows.push(row);
      else orphans.push(operation);
    }

    try {
      await gateway.upsert(entity, rows);
      await gateway.softDelete(entity, deletes.map((o) => o.rowId));
      report.pushed += rows.length + deletes.length;
      remaining = dequeue(remaining, operations);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'échec inconnu';
      report.rejected.push(...operations.map((operation) => ({ operation, reason })));
      continue;
    }

    remaining = dequeue(remaining, orphans);
  }

  return remaining;
}

/** Applique les lignes distantes modifiées depuis le dernier passage. */
async function pull(
  gateway: SyncGateway,
  snapshot: SyncSnapshot,
  userId: string,
  report: SyncReport,
): Promise<Pick<SyncSnapshot, 'books' | 'quotes' | 'boards' | 'pins'>> {
  const since = snapshot.lastSyncedAt;

  const [bookRows, quoteRows, boardRows, pinRows] = await Promise.all([
    gateway.changedSince('books', since, userId),
    gateway.changedSince('quotes', since, userId),
    gateway.changedSince('boards', since, userId),
    gateway.changedSince('board_quotes', since, userId),
  ]);

  const live = <T extends SyncedRow>(rows: SyncedRow[]) =>
    rows.filter((r) => r.deleted_at == null) as T[];
  const goneIds = (rows: SyncedRow[]) =>
    rows.filter((r) => r.deleted_at != null).map((r) => r.id);

  const books = mergeById(snapshot.books, live<BookRow>(bookRows).map(rowToBook));
  const quotes = mergeById(snapshot.quotes, live<QuoteRow>(quoteRows).map(rowToQuote));
  const boards = mergeById(snapshot.boards, live<BoardRow>(boardRows).map((r) => rowToBoard(r)));

  // Les épingles n'ont pas de contenu propre : la version distante fait foi.
  const livePins = live<PinRow>(pinRows).map(rowToPin);
  const pinIds = new Set(livePins.map((p) => p.id));
  const pins = [...snapshot.pins.filter((p) => !pinIds.has(p.id)), ...livePins];

  const deletedBooks = goneIds(bookRows);
  const deletedQuotes = goneIds(quoteRows);
  const deletedBoards = goneIds(boardRows);
  const deletedPins = goneIds(pinRows);

  report.pulled += books.applied + quotes.applied + boards.applied + livePins.length;
  report.deleted +=
    deletedBooks.length + deletedQuotes.length + deletedBoards.length + deletedPins.length;

  const remainingBoards = removeDeleted(boards.items, deletedBoards);
  const remainingBoardIds = new Set(remainingBoards.map((b) => b.id));
  const remainingQuotes = removeDeleted(quotes.items, deletedQuotes);
  const remainingQuoteIds = new Set(remainingQuotes.map((q) => q.id));

  return {
    books: newestFirst(removeDeleted(books.items, deletedBooks)),
    quotes: newestFirst(remainingQuotes),
    boards: newestFirst(remainingBoards),
    // Une épingle survit à son tableau ou à sa citation : on nettoie ici, comme
    // le fait la contrainte `on delete cascade` côté Postgres.
    pins: removeDeleted(pins, deletedPins).filter(
      (p) => remainingBoardIds.has(p.boardId) && remainingQuoteIds.has(p.quoteId),
    ),
  };
}

/**
 * Un cycle complet : on envoie d'abord ce qui est en attente, on tire ensuite
 * les modifications distantes. Dans cet ordre, une écriture locale n'est jamais
 * écrasée par une version distante plus ancienne qu'elle.
 */
export async function synchronize(
  gateway: SyncGateway | null,
  snapshot: SyncSnapshot,
): Promise<SyncOutcome> {
  const report = emptyReport();

  if (!gateway) {
    return { snapshot, report: { ...report, skipped: 'hors-ligne' } };
  }

  const userId = await gateway.currentUserId();
  if (!userId) {
    return { snapshot, report: { ...report, skipped: 'non-connecte' } };
  }

  const startedAt = new Date().toISOString();
  const outbox = await push(gateway, snapshot, userId, report);
  const pulled = await pull(gateway, snapshot, userId, report);

  return {
    snapshot: {
      ...snapshot,
      ...pulled,
      outbox,
      // On ne date le passage que si tout est parti : sinon la prochaine
      // synchronisation doit repartir de la même borne.
      lastSyncedAt: report.rejected.length === 0 ? startedAt : snapshot.lastSyncedAt,
    },
    report,
  };
}
