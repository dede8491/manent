/** Modèle de données de Manent — partagé par le store local et le schéma Supabase. */

export type ReadingMode = 'plaisir' | 'etudes' | 'les-deux';
export type BookKind = 'papier' | 'wattpad' | 'etude';
export type BookStatus = 'a-lire' | 'en-cours' | 'termine';
export type Visibility = 'privee' | 'publique';
export type BoardVisibility = 'prive' | 'public' | 'collaboratif';
export type ClubType = 'invitation' | 'ouvert';
export type ClubRole = 'animatrice' | 'membre';

export interface User {
  id: string;
  pseudo: string;
  email: string | null;
  avatarEmoji: string;
  bio: string;
  readingMode: ReadingMode;
  followedThemes: string[];
  premium: boolean;
  plan: 'mensuel' | 'annuel' | null;
  premiumTrialEndsAt: string | null;
  followers: number;
  following: number;
  /** Visibilité appliquée par défaut aux nouvelles citations. */
  defaultQuoteVisibility: Visibility;
  shareProgress: boolean;
  createdAt: string;
}

/** Fiche de lecture scolaire, une section par rubrique attendue. */
export interface StudySheetSection {
  key: 'auteur' | 'personnages' | 'resume' | 'themes' | 'citations';
  label: string;
  content: string;
  done: boolean;
}

export interface Book {
  id: string;
  kind: BookKind;
  title: string;
  author: string;
  isbn: string | null;
  wattpadUrl: string | null;
  coverUrl: string | null;
  /** Pages pour un livre papier/études, chapitres pour une histoire Wattpad. */
  totalUnits: number | null;
  progressUnits: number;
  status: BookStatus;
  rating: number;
  summary: string;
  lessons: string[];
  genre: string | null;
  /** Mode études uniquement. */
  schoolLevel: string | null;
  examDate: string | null;
  studySheet: StudySheetSection[];
  classClubId: string | null;
  notifyNewChapters: boolean;
  userId: string;
  createdAt: string;
}

export interface Quote {
  id: string;
  text: string;
  /** Numéro de page (papier/études) ou numéro de chapitre (Wattpad). */
  locator: number | null;
  note: string;
  themes: string[];
  /** Photo d'origine : toujours privée (droit de courte citation). */
  sourceImageUri: string | null;
  isPublic: boolean;
  bookId: string;
  userId: string;
  createdAt: string;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  visibility: BoardVisibility;
  shareSlug: string;
  memberIds: string[];
  ownerId: string;
  createdAt: string;
}

export interface BoardPin {
  id: string;
  boardId: string;
  quoteId: string;
  pinnedBy: string;
  pinnedAt: string;
}

export interface ClubEvent {
  id: string;
  title: string;
  /** ISO 8601. */
  startsAt: string;
  scope: string;
  visioUrl: string | null;
  attendeeIds: string[];
}

export interface ClubChallenge {
  id: string;
  title: string;
  goal: number;
  progress: number;
  unit: string;
  badgeId: string | null;
}

export interface CommonRead {
  bookTitle: string;
  bookAuthor: string;
  coverUrl: string | null;
  totalPages: number;
  deadline: string;
}

export interface ClubMemberProgress {
  userId: string;
  pseudo: string;
  avatarEmoji: string;
  page: number;
}

export interface Club {
  id: string;
  name: string;
  description: string;
  type: ClubType;
  hostPseudo: string;
  role: ClubRole | null;
  memberCount: number;
  themes: string[];
  commonRead: CommonRead | null;
  memberProgress: ClubMemberProgress[];
  events: ClubEvent[];
  challenge: ClubChallenge | null;
  inviteSlug: string;
  joined: boolean;
}

export interface ClubComment {
  id: string;
  postId: string;
  pseudo: string;
  avatarEmoji: string;
  text: string;
  createdAt: string;
}

/** Le « passage de la semaine » proposé par un membre, et sa discussion. */
export interface ClubPost {
  id: string;
  clubId: string;
  quoteText: string;
  bookTitle: string;
  bookAuthor: string;
  locator: number | null;
  proposedBy: string;
  proposedByEmoji: string;
  createdAt: string;
  comments: ClubComment[];
}

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  description: string;
  unlocked: boolean;
}

export interface Challenge {
  id: string;
  title: string;
  scope: 'public' | 'club';
  clubName: string | null;
  goal: number;
  progress: number;
  unit: string;
  endsAt: string;
  participants: number;
  rewardBadgeId: string | null;
}

export interface Flashcard {
  id: string;
  bookId: string;
  question: string;
  answer: string;
  /** Palier de répétition espacée : 0 = à revoir aujourd'hui. */
  box: number;
  dueAt: string;
}

/** Auteur d'une carte du fil, réel ou suggéré. */
export interface FeedAuthor {
  id: string;
  pseudo: string;
  avatarEmoji: string;
}

export type FeedItem =
  | { kind: 'quote'; id: string; author: FeedAuthor; quote: PublicQuote }
  | { kind: 'sponsored'; id: string; sponsor: string; headline: string; body: string; ctaUrl: string; accent: string }
  | { kind: 'reader'; id: string; author: FeedAuthor; quotes: number; boards: number; themes: string[] }
  | { kind: 'board'; id: string; boardName: string; author: FeedAuthor; preview: string; pins: number };

/** Citation publique telle qu'elle circule dans le fil et la recherche. */
export interface PublicQuote {
  id: string;
  text: string;
  locator: number | null;
  bookTitle: string;
  bookAuthor: string;
  bookKind: BookKind;
  themes: string[];
  note: string;
}

export type NotificationKind = 'pin' | 'board' | 'club' | 'theme' | 'wattpad' | 'system';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href: string | null;
}

export interface ThemeStat {
  slug: string;
  emoji: string;
  quotes: number;
  books: number;
  readers: number;
}

/** Lien d'achat affilié affiché sur une fiche livre. */
export interface AffiliateLink {
  merchant: string;
  label: string;
  price: string;
  url: string;
  note: string;
}
