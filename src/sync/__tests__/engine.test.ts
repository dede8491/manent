import { synchronize, type SyncSnapshot } from '@/sync/engine';
import { enqueue } from '@/sync/outbox';
import type { Board, BoardPin, Book, Quote } from '@/types';
import { fakeGateway } from './fakeGateway';

const book = (over: Partial<Book> = {}): Book => ({
  id: 'book_1',
  kind: 'papier',
  title: "L'Atelier des jours lents",
  author: 'Nour Belkacem',
  isbn: null,
  wattpadUrl: null,
  coverUrl: null,
  totalUnits: 288,
  progressUnits: 96,
  status: 'en-cours',
  rating: 4,
  summary: '',
  lessons: [],
  genre: null,
  schoolLevel: null,
  examDate: null,
  studySheet: [],
  classClubId: null,
  notifyNewChapters: false,
  userId: 'user_1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const quote = (over: Partial<Quote> = {}): Quote => ({
  id: 'quote_1',
  text: 'Une phrase gardée.',
  locator: 74,
  note: '',
  themes: ['confiance'],
  sourceImageUri: 'file:///local/page.jpg',
  sourceImagePath: null,
  isPublic: false,
  bookId: 'book_1',
  userId: 'user_1',
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...over,
});

const board = (over: Partial<Board> = {}): Board => ({
  id: 'board_1',
  name: 'Pour les matins durs',
  description: '',
  visibility: 'prive',
  shareSlug: 'abc123',
  memberIds: ['user_1'],
  ownerId: 'user_1',
  createdAt: '2026-01-03T00:00:00.000Z',
  updatedAt: '2026-01-03T00:00:00.000Z',
  ...over,
});

const pin = (over: Partial<BoardPin> = {}): BoardPin => ({
  id: 'pin_1',
  boardId: 'board_1',
  quoteId: 'quote_1',
  pinnedBy: 'user_1',
  pinnedAt: '2026-01-04T00:00:00.000Z',
  ...over,
});

const snapshot = (over: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
  books: [],
  quotes: [],
  boards: [],
  pins: [],
  outbox: [],
  lastSyncedAt: null,
  ...over,
});

describe('synchronize — garde-fous', () => {
  it('ne fait rien sans backend configuré', async () => {
    const state = snapshot({ books: [book()] });
    const { snapshot: after, report } = await synchronize(null, state);

    expect(report.skipped).toBe('hors-ligne');
    expect(after).toBe(state);
  });

  it('ne fait rien tant que personne n’est connecté', async () => {
    const gateway = fakeGateway(null);
    const { report } = await synchronize(gateway, snapshot({ books: [book()] }));

    expect(report.skipped).toBe('non-connecte');
    expect(gateway.rows('books')).toHaveLength(0);
  });
});

describe('synchronize — envoi', () => {
  it('envoie les créations en attente et vide l’outbox', async () => {
    const gateway = fakeGateway();
    const state = snapshot({
      books: [book()],
      quotes: [quote()],
      outbox: enqueue(enqueue([], 'books', 'upsert', 'book_1'), 'quotes', 'upsert', 'quote_1'),
    });

    const { snapshot: after, report } = await synchronize(gateway, state);

    expect(report.pushed).toBe(2);
    expect(after.outbox).toHaveLength(0);
    expect(gateway.rows('books')[0]).toMatchObject({ id: 'book_1', progress_units: 96 });
  });

  it('téléverse la photo de page et n’envoie que son chemin distant', async () => {
    const gateway = fakeGateway();
    const { snapshot: after } = await synchronize(
      gateway,
      snapshot({ quotes: [quote()], outbox: enqueue([], 'quotes', 'upsert', 'quote_1') }),
    );

    const row = gateway.rows('quotes')[0];
    expect(row.source_image_path).toBe('user_1/quote_1.jpg');
    // L'URI local n'a aucun sens ailleurs et ne doit jamais partir.
    expect(JSON.stringify(row)).not.toContain('file:///local');
    expect(gateway.photos['user_1/quote_1.jpg']).toBe('file:///local/page.jpg');
    expect(after.quotes[0].sourceImagePath).toBe('user_1/quote_1.jpg');
  });

  it('ne téléverse pas deux fois la même photo', async () => {
    const gateway = fakeGateway();
    const spy = jest.spyOn(gateway, 'uploadPagePhoto');
    const already = quote({ sourceImagePath: 'user_1/quote_1.jpg' });

    await synchronize(
      gateway,
      snapshot({ quotes: [already], outbox: enqueue([], 'quotes', 'upsert', 'quote_1') }),
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it('envoie la citation même si le téléversement de la photo échoue', async () => {
    const gateway = fakeGateway();
    gateway.failPhotoUpload(true);

    const { snapshot: after, report } = await synchronize(
      gateway,
      snapshot({ quotes: [quote()], outbox: enqueue([], 'quotes', 'upsert', 'quote_1') }),
    );

    expect(report.pushed).toBe(1);
    expect(gateway.rows('quotes')[0].source_image_path).toBeNull();
    // La photo repartira au passage suivant.
    expect(after.quotes[0].sourceImagePath).toBeNull();
  });

  it('ne téléverse que les photos des citations réellement envoyées', async () => {
    const gateway = fakeGateway();
    const spy = jest.spyOn(gateway, 'uploadPagePhoto');

    await synchronize(
      gateway,
      snapshot({
        quotes: [quote(), quote({ id: 'quote_2' })],
        outbox: enqueue([], 'quotes', 'upsert', 'quote_1'),
      }),
    );

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('user_1', 'quote_1', 'file:///local/page.jpg');
  });

  it('marque la suppression côté serveur sans effacer la ligne', async () => {
    const gateway = fakeGateway();
    gateway.seed('books', { id: 'book_1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null });

    const { report } = await synchronize(
      gateway,
      snapshot({ outbox: enqueue([], 'books', 'delete', 'book_1') }),
    );

    expect(report.pushed).toBe(1);
    expect(gateway.tables.books.book_1.deleted_at).not.toBeNull();
  });

  it('abandonne une opération dont la ligne locale a disparu', async () => {
    const gateway = fakeGateway();
    const { snapshot: after } = await synchronize(
      gateway,
      // L'outbox référence un livre absent du snapshot.
      snapshot({ outbox: enqueue([], 'books', 'upsert', 'fantome') }),
    );

    expect(after.outbox).toHaveLength(0);
    expect(gateway.rows('books')).toHaveLength(0);
  });

  it('garde l’outbox et la borne intactes quand le serveur refuse', async () => {
    const gateway = fakeGateway();
    gateway.failOn('books');

    const state = snapshot({
      books: [book()],
      outbox: enqueue([], 'books', 'upsert', 'book_1'),
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
    });
    const { snapshot: after, report } = await synchronize(gateway, state);

    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0].reason).toContain('books');
    expect(after.outbox).toHaveLength(1);
    // La borne ne bouge pas : la prochaine tentative repart du même point.
    expect(after.lastSyncedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('continue sur les autres entités malgré un échec isolé', async () => {
    const gateway = fakeGateway();
    gateway.failOn('books');

    let outbox = enqueue([], 'books', 'upsert', 'book_1');
    outbox = enqueue(outbox, 'quotes', 'upsert', 'quote_1');

    const { snapshot: after } = await synchronize(
      gateway,
      snapshot({ books: [book()], quotes: [quote()], outbox }),
    );

    expect(gateway.rows('quotes')).toHaveLength(1);
    expect(after.outbox.map((o) => o.entity)).toEqual(['books']);
  });
});

describe('synchronize — réception', () => {
  it('ramène une lecture créée sur un autre appareil', async () => {
    const gateway = fakeGateway();
    gateway.seed('books', {
      id: 'book_2',
      user_id: 'user_1',
      kind: 'papier',
      title: 'Des lignes de faille',
      author: 'Éloi Ravenne',
      isbn: null,
      wattpad_url: null,
      cover_url: null,
      total_units: 342,
      progress_units: 0,
      status: 'a-lire',
      rating: 0,
      summary: '',
      lessons: [],
      genre: null,
      school_level: null,
      exam_date: null,
      study_sheet: [],
      class_club_id: null,
      notify_new_chapters: false,
      created_at: '2026-02-01T00:00:00.000Z',
      updated_at: '2026-02-01T00:00:00.000Z',
      deleted_at: null,
    });

    const { snapshot: after, report } = await synchronize(gateway, snapshot());

    expect(report.pulled).toBe(1);
    expect(after.books).toHaveLength(1);
    expect(after.books[0]).toMatchObject({ title: 'Des lignes de faille', totalUnits: 342 });
  });

  it('garde la version locale quand elle est plus récente que la distante', async () => {
    const gateway = fakeGateway();
    gateway.seed('books', {
      id: 'book_1',
      title: 'Titre distant',
      author: '',
      kind: 'papier',
      progress_units: 10,
      status: 'en-cours',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
    } as never);

    const local = book({ progressUnits: 200, updatedAt: '2026-05-01T00:00:00.000Z' });
    const { snapshot: after } = await synchronize(gateway, snapshot({ books: [local] }));

    expect(after.books[0].progressUnits).toBe(200);
  });

  it('retire localement ce qui a été supprimé ailleurs', async () => {
    const gateway = fakeGateway();
    gateway.seed('quotes', {
      id: 'quote_1',
      updated_at: '2026-05-01T00:00:00.000Z',
      deleted_at: '2026-05-01T00:00:00.000Z',
    });

    const { snapshot: after, report } = await synchronize(
      gateway,
      snapshot({ quotes: [quote()], books: [book()] }),
    );

    expect(report.deleted).toBe(1);
    expect(after.quotes).toHaveLength(0);
  });

  it('nettoie les épingles dont le tableau ou la citation a disparu', async () => {
    const gateway = fakeGateway();
    gateway.seed('boards', {
      id: 'board_1',
      updated_at: '2026-05-01T00:00:00.000Z',
      deleted_at: '2026-05-01T00:00:00.000Z',
    });

    const { snapshot: after } = await synchronize(
      gateway,
      snapshot({ boards: [board()], quotes: [quote()], pins: [pin()] }),
    );

    expect(after.boards).toHaveLength(0);
    expect(after.pins).toHaveLength(0);
  });

  it('ne retire pas une épingle dont le tableau et la citation tiennent', async () => {
    const gateway = fakeGateway();
    const { snapshot: after } = await synchronize(
      gateway,
      snapshot({ boards: [board()], quotes: [quote()], pins: [pin()] }),
    );

    expect(after.pins).toHaveLength(1);
  });

  it('ne redemande que les changements postérieurs à la dernière borne, pour moi seule', async () => {
    const gateway = fakeGateway();
    const spy = jest.spyOn(gateway, 'changedSince');

    await synchronize(gateway, snapshot({ lastSyncedAt: '2026-04-01T00:00:00.000Z' }));

    expect(spy).toHaveBeenCalledWith('books', '2026-04-01T00:00:00.000Z', 'user_1');
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('avance la borne après un passage complet', async () => {
    const gateway = fakeGateway();
    const { snapshot: after } = await synchronize(gateway, snapshot());

    expect(after.lastSyncedAt).not.toBeNull();
  });
});

describe('synchronize — travail hors ligne puis reconnexion', () => {
  it('rejoue les mutations accumulées à la reconnexion', async () => {
    // Hors ligne : trois mutations s'empilent.
    let outbox = enqueue([], 'books', 'upsert', 'book_1');
    outbox = enqueue(outbox, 'quotes', 'upsert', 'quote_1');
    outbox = enqueue(outbox, 'boards', 'upsert', 'board_1');

    const offline = snapshot({ books: [book()], quotes: [quote()], boards: [board()], outbox });
    const { report: skipped } = await synchronize(null, offline);
    expect(skipped.skipped).toBe('hors-ligne');

    // De retour en ligne, tout part d'un coup.
    const gateway = fakeGateway();
    const { snapshot: after, report } = await synchronize(gateway, offline);

    expect(report.pushed).toBe(3);
    expect(after.outbox).toHaveLength(0);
    expect(gateway.rows('books')).toHaveLength(1);
    expect(gateway.rows('quotes')).toHaveLength(1);
    expect(gateway.rows('boards')).toHaveLength(1);
  });

  it('envoie les épingles après les tableaux et les citations qu’elles référencent', async () => {
    const gateway = fakeGateway();
    let outbox = enqueue([], 'board_quotes', 'upsert', 'pin_1');
    outbox = enqueue(outbox, 'boards', 'upsert', 'board_1');
    outbox = enqueue(outbox, 'quotes', 'upsert', 'quote_1');

    await synchronize(
      gateway,
      snapshot({ quotes: [quote()], boards: [board()], pins: [pin()], outbox }),
    );

    expect(gateway.upsertCalls.map((c) => c.entity)).toEqual([
      'quotes',
      'boards',
      'board_quotes',
    ]);
  });
});
