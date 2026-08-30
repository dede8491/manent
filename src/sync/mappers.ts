import type { Board, BoardPin, Book, Quote, StudySheetSection } from '@/types';
import type { SyncedRow } from './types';

/**
 * Conversion entre le modèle local (camelCase) et les lignes Postgres
 * (snake_case). Le schéma de `supabase/migrations` est la référence : toute
 * colonne ajoutée là-bas doit apparaître ici.
 */

export interface BookRow extends SyncedRow {
  user_id: string;
  kind: Book['kind'];
  title: string;
  author: string;
  isbn: string | null;
  wattpad_url: string | null;
  cover_url: string | null;
  total_units: number | null;
  progress_units: number;
  status: Book['status'];
  rating: number;
  summary: string;
  lessons: string[];
  genre: string | null;
  school_level: string | null;
  exam_date: string | null;
  study_sheet: StudySheetSection[];
  class_club_id: string | null;
  notify_new_chapters: boolean;
  created_at: string;
}

export function bookToRow(book: Book, userId: string): Omit<BookRow, 'deleted_at'> {
  return {
    id: book.id,
    user_id: userId,
    kind: book.kind,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    wattpad_url: book.wattpadUrl,
    cover_url: book.coverUrl,
    total_units: book.totalUnits,
    progress_units: book.progressUnits,
    status: book.status,
    rating: book.rating,
    summary: book.summary,
    lessons: book.lessons,
    genre: book.genre,
    school_level: book.schoolLevel,
    exam_date: book.examDate,
    study_sheet: book.studySheet,
    class_club_id: book.classClubId,
    notify_new_chapters: book.notifyNewChapters,
    created_at: book.createdAt,
    updated_at: book.updatedAt,
  };
}

export function rowToBook(row: BookRow): Book {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    author: row.author ?? '',
    isbn: row.isbn,
    wattpadUrl: row.wattpad_url,
    coverUrl: row.cover_url,
    totalUnits: row.total_units,
    progressUnits: row.progress_units ?? 0,
    status: row.status,
    rating: row.rating ?? 0,
    summary: row.summary ?? '',
    lessons: row.lessons ?? [],
    genre: row.genre,
    schoolLevel: row.school_level,
    examDate: row.exam_date,
    studySheet: row.study_sheet ?? [],
    classClubId: row.class_club_id,
    notifyNewChapters: row.notify_new_chapters ?? false,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface QuoteRow extends SyncedRow {
  user_id: string;
  book_id: string | null;
  text: string;
  locator: number | null;
  note: string;
  themes: string[];
  source_image_path: string | null;
  is_public: boolean;
  created_at: string;
}

export function quoteToRow(quote: Quote, userId: string): Omit<QuoteRow, 'deleted_at'> {
  return {
    id: quote.id,
    user_id: userId,
    book_id: quote.bookId || null,
    text: quote.text,
    locator: quote.locator,
    note: quote.note,
    themes: quote.themes,
    // Seul le chemin dans le bucket privé voyage : jamais l'image elle-même,
    // jamais un URI local qui n'aurait aucun sens sur un autre appareil.
    source_image_path: quote.sourceImagePath,
    is_public: quote.isPublic,
    created_at: quote.createdAt,
    updated_at: quote.updatedAt,
  };
}

export function rowToQuote(row: QuoteRow): Quote {
  return {
    id: row.id,
    text: row.text,
    locator: row.locator,
    note: row.note ?? '',
    themes: row.themes ?? [],
    sourceImageUri: null,
    sourceImagePath: row.source_image_path,
    isPublic: row.is_public ?? false,
    bookId: row.book_id ?? '',
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface BoardRow extends SyncedRow {
  owner_id: string;
  name: string;
  description: string;
  visibility: Board['visibility'];
  share_slug: string;
  created_at: string;
}

export function boardToRow(board: Board, userId: string): Omit<BoardRow, 'deleted_at'> {
  return {
    id: board.id,
    owner_id: userId,
    name: board.name,
    description: board.description,
    visibility: board.visibility,
    share_slug: board.shareSlug,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  };
}

export function rowToBoard(row: BoardRow, memberIds: string[] = []): Board {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    visibility: row.visibility,
    shareSlug: row.share_slug,
    memberIds: memberIds.length > 0 ? memberIds : [row.owner_id],
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PinRow extends SyncedRow {
  board_id: string;
  quote_id: string;
  pinned_by: string;
  pinned_at: string;
}

export function pinToRow(pin: BoardPin, userId: string): Omit<PinRow, 'deleted_at'> {
  return {
    id: pin.id,
    board_id: pin.boardId,
    quote_id: pin.quoteId,
    pinned_by: userId,
    pinned_at: pin.pinnedAt,
    updated_at: pin.pinnedAt,
  };
}

export function rowToPin(row: PinRow): BoardPin {
  return {
    id: row.id,
    boardId: row.board_id,
    quoteId: row.quote_id,
    pinnedBy: row.pinned_by,
    pinnedAt: row.pinned_at,
  };
}
