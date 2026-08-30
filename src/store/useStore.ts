import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  ME_ID, seedBadges, seedBoards, seedBooks, seedChallenges, seedClubPosts, seedClubs,
  seedFlashcards, seedNotifications, seedPins, seedQuotes, seedStats, seedUser,
} from '@/data/seed';
import { normalizeTheme } from '@/lib/format';
import { slug, uid } from '@/lib/id';
import { supabaseGateway, type SyncGateway } from '@/sync/gateway';
import { synchronize } from '@/sync/engine';
import { enqueue } from '@/sync/outbox';
import type { SyncEntity, SyncOp, SyncOperation, SyncReport } from '@/sync/types';
import type {
  AppNotification, Badge, Board, BoardPin, BoardVisibility, Book, BookStatus, Challenge,
  Club, ClubPost, Flashcard, Quote, ReadingMode, StudySheetSection, User,
} from '@/types';

/** Quota de transcriptions IA du plan gratuit. */
export const FREE_MONTHLY_CAPTURES = 15;

/** Ce que l'écran de capture fournit : le reste est rempli par le store. */
export type NewQuoteInput = Omit<
  Quote,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'sourceImagePath'
>;

export interface NewBookInput {
  kind: Book['kind'];
  title: string;
  author: string;
  isbn?: string | null;
  wattpadUrl?: string | null;
  coverUrl?: string | null;
  totalUnits?: number | null;
  status?: BookStatus;
  genre?: string | null;
  schoolLevel?: string | null;
  examDate?: string | null;
}

interface AppState {
  hydrated: boolean;
  onboarded: boolean;
  user: User;
  books: Book[];
  quotes: Quote[];
  boards: Board[];
  pins: BoardPin[];
  clubs: Club[];
  clubPosts: ClubPost[];
  notifications: AppNotification[];
  badges: Badge[];
  challenges: Challenge[];
  flashcards: Flashcard[];
  stats: typeof seedStats;
  /** Nombre de transcriptions IA consommées sur le mois en cours. */
  captureCount: number;
  captureMonth: string;
  /** Mutations locales en attente d'envoi au backend. */
  outbox: SyncOperation[];
  lastSyncedAt: string | null;
  syncing: boolean;
  lastSyncReport: SyncReport | null;

  // — Onboarding & compte —
  setReadingMode: (mode: ReadingMode) => void;
  toggleFollowedTheme: (theme: string) => void;
  completeOnboarding: (pseudo: string, email: string | null) => void;
  resetAll: () => void;
  updateUser: (patch: Partial<User>) => void;

  // — Livres —
  addBook: (input: NewBookInput) => Book;
  updateBook: (id: string, patch: Partial<Book>) => void;
  removeBook: (id: string) => void;
  setProgress: (id: string, units: number) => void;
  addLesson: (id: string, lesson: string) => void;
  removeLesson: (id: string, index: number) => void;
  updateStudySection: (bookId: string, key: StudySheetSection['key'], content: string) => void;

  // — Citations —
  addQuote: (input: NewQuoteInput) => Quote;
  updateQuote: (id: string, patch: Partial<Quote>) => void;
  removeQuote: (id: string) => void;

  // — Tableaux —
  addBoard: (name: string, description: string, visibility: BoardVisibility) => Board;
  removeBoard: (id: string) => void;
  togglePin: (boardId: string, quoteId: string) => void;

  // — Clubs —
  joinClub: (id: string) => void;
  leaveClub: (id: string) => void;
  createClub: (input: {
    name: string;
    description: string;
    type: Club['type'];
    bookTitle: string;
    bookAuthor: string;
    deadline: string;
  }) => Club;
  addClubComment: (postId: string, text: string) => void;
  toggleEventAttendance: (clubId: string, eventId: string) => void;

  // — Flashcards —
  reviewFlashcard: (id: string, known: boolean) => void;

  // — Notifications —
  markNotificationsRead: () => void;

  // — Synchronisation —
  sync: (gateway?: SyncGateway | null) => Promise<SyncReport>;

  // — Premium & quota —
  startPremium: (plan: 'mensuel' | 'annuel') => void;
  cancelPremium: () => void;
  consumeCapture: () => void;
  remainingCaptures: () => number;
}

const monthKey = () => new Date().toISOString().slice(0, 7);

const initial = () => ({
  hydrated: false,
  onboarded: false,
  user: seedUser,
  books: seedBooks,
  quotes: seedQuotes,
  boards: seedBoards,
  pins: seedPins,
  clubs: seedClubs,
  clubPosts: seedClubPosts,
  notifications: seedNotifications,
  badges: seedBadges,
  challenges: seedChallenges,
  flashcards: seedFlashcards,
  stats: seedStats,
  captureCount: 0,
  captureMonth: monthKey(),
  outbox: [] as SyncOperation[],
  lastSyncedAt: null as string | null,
  syncing: false,
  lastSyncReport: null as SyncReport | null,
});

const now = () => new Date().toISOString();

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      /**
       * Enregistre une mutation locale dans l'outbox. Toute action qui touche
       * une entité synchronisée doit passer par là, sinon la modification ne
       * quittera jamais l'appareil.
       */
      const track = (entity: SyncEntity, op: SyncOp, rowId: string) =>
        set((s) => ({ outbox: enqueue(s.outbox, entity, op, rowId) }));

      return {
      ...initial(),

      setReadingMode: (mode) => set((s) => ({ user: { ...s.user, readingMode: mode } })),

      toggleFollowedTheme: (theme) =>
        set((s) => {
          const t = normalizeTheme(theme);
          const has = s.user.followedThemes.includes(t);
          return {
            user: {
              ...s.user,
              followedThemes: has
                ? s.user.followedThemes.filter((x) => x !== t)
                : [...s.user.followedThemes, t],
            },
          };
        }),

      completeOnboarding: (pseudo, email) =>
        set((s) => ({
          onboarded: true,
          user: { ...s.user, pseudo: pseudo.trim() || s.user.pseudo, email },
        })),

      resetAll: () => set({ ...initial(), hydrated: true }),

      updateUser: (patch) => set((s) => ({ user: { ...s.user, ...patch } })),

      addBook: (input) => {
        const book: Book = {
          id: uid('book'),
          kind: input.kind,
          title: input.title,
          author: input.author,
          isbn: input.isbn ?? null,
          wattpadUrl: input.wattpadUrl ?? null,
          coverUrl: input.coverUrl ?? null,
          totalUnits: input.totalUnits ?? null,
          progressUnits: 0,
          status: input.status ?? 'a-lire',
          rating: 0,
          summary: '',
          lessons: [],
          genre: input.genre ?? null,
          schoolLevel: input.schoolLevel ?? null,
          examDate: input.examDate ?? null,
          studySheet: [
            { key: 'auteur', label: 'Auteur et contexte', content: '', done: false },
            { key: 'personnages', label: 'Personnages principaux', content: '', done: false },
            { key: 'resume', label: 'Résumé par parties', content: '', done: false },
            { key: 'themes', label: 'Thèmes et analyse', content: '', done: false },
            { key: 'citations', label: 'Citations clés', content: '', done: false },
          ],
          classClubId: null,
          notifyNewChapters: input.kind === 'wattpad',
          userId: ME_ID,
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ books: [book, ...s.books] }));
        track('books', 'upsert', book.id);
        return book;
      },

      updateBook: (id, patch) => {
        set((s) => ({
          books: s.books.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: now() } : b)),
        }));
        track('books', 'upsert', id);
      },

      removeBook: (id) => {
        // Les citations du livre partent avec lui, ici comme dans Postgres.
        const orphans = get().quotes.filter((q) => q.bookId === id);
        set((s) => ({
          books: s.books.filter((b) => b.id !== id),
          quotes: s.quotes.filter((q) => q.bookId !== id),
          pins: s.pins.filter((p) => !orphans.some((q) => q.id === p.quoteId)),
        }));
        orphans.forEach((q) => track('quotes', 'delete', q.id));
        track('books', 'delete', id);
      },

      setProgress: (id, units) => {
        set((s) => ({
          books: s.books.map((b) => {
            if (b.id !== id) return b;
            const max = b.totalUnits ?? units;
            const next = Math.max(0, Math.min(units, max));
            const status: BookStatus =
              b.totalUnits && next >= b.totalUnits ? 'termine' : next > 0 ? 'en-cours' : b.status;
            return { ...b, progressUnits: next, status, updatedAt: now() };
          }),
        }));
        track('books', 'upsert', id);
      },

      addLesson: (id, lesson) => {
        set((s) => ({
          books: s.books.map((b) =>
            b.id === id ? { ...b, lessons: [...b.lessons, lesson.trim()], updatedAt: now() } : b,
          ),
        }));
        track('books', 'upsert', id);
      },

      removeLesson: (id, index) => {
        set((s) => ({
          books: s.books.map((b) =>
            b.id === id
              ? { ...b, lessons: b.lessons.filter((_, i) => i !== index), updatedAt: now() }
              : b,
          ),
        }));
        track('books', 'upsert', id);
      },

      updateStudySection: (bookId, key, content) => {
        set((s) => ({
          books: s.books.map((b) =>
            b.id === bookId
              ? {
                  ...b,
                  studySheet: b.studySheet.map((sec) =>
                    sec.key === key ? { ...sec, content, done: content.trim().length > 0 } : sec,
                  ),
                  updatedAt: now(),
                }
              : b,
          ),
        }));
        track('books', 'upsert', bookId);
      },

      addQuote: (input) => {
        const quote: Quote = {
          ...input,
          // La photo n'est téléversée qu'à la synchronisation : tant qu'elle
          // n'est que locale, elle n'a pas de chemin côté serveur.
          sourceImagePath: null,
          id: uid('quote'),
          userId: ME_ID,
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ quotes: [quote, ...s.quotes] }));
        track('quotes', 'upsert', quote.id);
        return quote;
      },

      updateQuote: (id, patch) => {
        set((s) => ({
          quotes: s.quotes.map((q) => (q.id === id ? { ...q, ...patch, updatedAt: now() } : q)),
        }));
        track('quotes', 'upsert', id);
      },

      removeQuote: (id) => {
        const orphanPins = get().pins.filter((p) => p.quoteId === id);
        set((s) => ({
          quotes: s.quotes.filter((q) => q.id !== id),
          pins: s.pins.filter((p) => p.quoteId !== id),
        }));
        orphanPins.forEach((p) => track('board_quotes', 'delete', p.id));
        track('quotes', 'delete', id);
      },

      addBoard: (name, description, visibility) => {
        const board: Board = {
          id: uid('board'),
          name: name.trim(),
          description: description.trim(),
          visibility,
          shareSlug: slug(),
          memberIds: [ME_ID],
          ownerId: ME_ID,
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ boards: [board, ...s.boards] }));
        track('boards', 'upsert', board.id);
        return board;
      },

      removeBoard: (id) => {
        // Le tableau disparaît, ses épingles aussi — mais pas les citations.
        const orphanPins = get().pins.filter((p) => p.boardId === id);
        set((s) => ({
          boards: s.boards.filter((b) => b.id !== id),
          pins: s.pins.filter((p) => p.boardId !== id),
        }));
        orphanPins.forEach((p) => track('board_quotes', 'delete', p.id));
        track('boards', 'delete', id);
      },

      togglePin: (boardId, quoteId) => {
        const existing = get().pins.find((p) => p.boardId === boardId && p.quoteId === quoteId);
        if (existing) {
          set((s) => ({ pins: s.pins.filter((p) => p.id !== existing.id) }));
          track('board_quotes', 'delete', existing.id);
          return;
        }
        const pin: BoardPin = {
          id: uid('pin'),
          boardId,
          quoteId,
          pinnedBy: ME_ID,
          pinnedAt: now(),
        };
        set((s) => ({ pins: [pin, ...s.pins] }));
        track('board_quotes', 'upsert', pin.id);
      },

      joinClub: (id) =>
        set((s) => ({
          clubs: s.clubs.map((c) =>
            c.id === id
              ? { ...c, joined: true, role: c.role ?? 'membre', memberCount: c.memberCount + 1 }
              : c,
          ),
        })),

      leaveClub: (id) =>
        set((s) => ({
          clubs: s.clubs.map((c) =>
            c.id === id
              ? { ...c, joined: false, role: null, memberCount: Math.max(0, c.memberCount - 1) }
              : c,
          ),
        })),

      createClub: (input) => {
        const club: Club = {
          id: uid('club'),
          name: input.name.trim(),
          description: input.description.trim(),
          type: input.type,
          hostPseudo: get().user.pseudo,
          role: 'animatrice',
          memberCount: 1,
          themes: get().user.followedThemes.slice(0, 2),
          commonRead: input.bookTitle
            ? {
                bookTitle: input.bookTitle,
                bookAuthor: input.bookAuthor,
                coverUrl: null,
                totalPages: 300,
                deadline: input.deadline,
              }
            : null,
          memberProgress: [
            {
              userId: ME_ID,
              pseudo: get().user.pseudo,
              avatarEmoji: get().user.avatarEmoji,
              page: 0,
            },
          ],
          events: [],
          challenge: null,
          inviteSlug: slug(6),
          joined: true,
        };
        set((s) => ({ clubs: [club, ...s.clubs] }));
        return club;
      },

      addClubComment: (postId, text) =>
        set((s) => ({
          clubPosts: s.clubPosts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  comments: [
                    ...p.comments,
                    {
                      id: uid('c'),
                      postId,
                      pseudo: s.user.pseudo,
                      avatarEmoji: s.user.avatarEmoji,
                      text: text.trim(),
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : p,
          ),
        })),

      toggleEventAttendance: (clubId, eventId) =>
        set((s) => ({
          clubs: s.clubs.map((c) =>
            c.id === clubId
              ? {
                  ...c,
                  events: c.events.map((e) =>
                    e.id === eventId
                      ? {
                          ...e,
                          attendeeIds: e.attendeeIds.includes(ME_ID)
                            ? e.attendeeIds.filter((x) => x !== ME_ID)
                            : [...e.attendeeIds, ME_ID],
                        }
                      : e,
                  ),
                }
              : c,
          ),
        })),

      reviewFlashcard: (id, known) =>
        set((s) => ({
          flashcards: s.flashcards.map((f) => {
            if (f.id !== id) return f;
            const box = known ? Math.min(5, f.box + 1) : 0;
            // Répétition espacée simple : 1, 2, 4, 8, 16, 32 jours.
            const days = known ? 2 ** box : 0;
            return { ...f, box, dueAt: new Date(Date.now() + days * 86_400_000).toISOString() };
          }),
        })),

      markNotificationsRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      sync: async (gateway) => {
        if (get().syncing) {
          return { pushed: 0, pulled: 0, deleted: 0, rejected: [], skipped: null };
        }
        set({ syncing: true });
        try {
          const state = get();
          const { snapshot, report } = await synchronize(
            gateway === undefined ? supabaseGateway() : gateway,
            {
              books: state.books,
              quotes: state.quotes,
              boards: state.boards,
              pins: state.pins,
              outbox: state.outbox,
              lastSyncedAt: state.lastSyncedAt,
            },
          );
          set({
            books: snapshot.books,
            quotes: snapshot.quotes,
            boards: snapshot.boards,
            pins: snapshot.pins,
            outbox: snapshot.outbox,
            lastSyncedAt: snapshot.lastSyncedAt,
            lastSyncReport: report,
          });
          return report;
        } finally {
          set({ syncing: false });
        }
      },

      startPremium: (plan) =>
        set((s) => ({
          user: {
            ...s.user,
            premium: true,
            plan,
            // Essai gratuit de 7 jours ; la facturation réelle est gérée par
            // le store (App Store / Play Store) via RevenueCat.
            premiumTrialEndsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          },
        })),

      cancelPremium: () =>
        set((s) => ({ user: { ...s.user, premium: false, plan: null, premiumTrialEndsAt: null } })),

      consumeCapture: () =>
        set((s) => {
          const m = monthKey();
          if (s.captureMonth !== m) return { captureMonth: m, captureCount: 1 };
          return { captureCount: s.captureCount + 1 };
        }),

      remainingCaptures: () => {
        const s = get();
        if (s.user.premium) return Infinity;
        if (s.captureMonth !== monthKey()) return FREE_MONTHLY_CAPTURES;
        return Math.max(0, FREE_MONTHLY_CAPTURES - s.captureCount);
      },
      };
    },
    {
      name: 'manent-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // On ne persiste que les données, jamais les actions ni l'état de session.
      partialize: (s) => ({
        onboarded: s.onboarded,
        user: s.user,
        books: s.books,
        quotes: s.quotes,
        boards: s.boards,
        pins: s.pins,
        clubs: s.clubs,
        clubPosts: s.clubPosts,
        notifications: s.notifications,
        badges: s.badges,
        challenges: s.challenges,
        flashcards: s.flashcards,
        stats: s.stats,
        captureCount: s.captureCount,
        captureMonth: s.captureMonth,
        // L'outbox doit survivre à la fermeture de l'app : c'est ce qui rend
        // le travail hors ligne sûr.
        outbox: s.outbox,
        lastSyncedAt: s.lastSyncedAt,
      }),
      // Quel que soit le résultat (stockage vide, JSON corrompu), on lève le
      // drapeau : l'app ne doit jamais rester bloquée sur l'écran de chargement.
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);
