import { useMemo } from 'react';

import { seedFeed } from '@/data/seed';
import { useStore } from './useStore';
import type { FeedItem } from '@/types';

/**
 * Le fil d'accueil : les citations publiques de la communauté, dans
 * lesquelles on intercale celles de l'utilisateur — ce qu'il publie doit
 * apparaître immédiatement dans son propre fil.
 */
export function useFeed(): FeedItem[] {
  const quotes = useStore((s) => s.quotes);
  const books = useStore((s) => s.books);
  const user = useStore((s) => s.user);

  return useMemo(() => {
    const mine: FeedItem[] = quotes
      .filter((q) => q.isPublic)
      .slice(0, 4)
      .map((q) => {
        const book = books.find((b) => b.id === q.bookId);
        return {
          kind: 'quote' as const,
          id: `mine_${q.id}`,
          author: { id: user.id, pseudo: user.pseudo, avatarEmoji: user.avatarEmoji },
          quote: {
            id: q.id,
            text: q.text,
            locator: q.locator,
            bookTitle: book?.title ?? 'Lecture',
            bookAuthor: book?.author ?? '',
            bookKind: book?.kind ?? 'papier',
            themes: q.themes,
            note: q.note,
          },
        };
      });

    // Une carte à soi toutes les trois cartes de la communauté.
    const out: FeedItem[] = [];
    let m = 0;
    seedFeed.forEach((item, i) => {
      out.push(item);
      if ((i + 1) % 3 === 0 && m < mine.length) {
        out.push(mine[m]);
        m += 1;
      }
    });
    return [...out, ...mine.slice(m)];
  }, [quotes, books, user.id, user.pseudo, user.avatarEmoji]);
}

/** Nombre de citations rattachées à un livre. */
export function useQuoteCount(bookId: string): number {
  return useStore((s) => s.quotes.filter((q) => q.bookId === bookId).length);
}

/** Citations épinglées sur un tableau, les plus récentes d'abord. */
export function useBoardQuotes(boardId: string) {
  const pins = useStore((s) => s.pins);
  const quotes = useStore((s) => s.quotes);
  return useMemo(
    () =>
      pins
        .filter((p) => p.boardId === boardId)
        .sort((a, b) => b.pinnedAt.localeCompare(a.pinnedAt))
        .map((p) => ({ pin: p, quote: quotes.find((q) => q.id === p.quoteId) }))
        .filter((x): x is { pin: (typeof pins)[number]; quote: (typeof quotes)[number] } => !!x.quote),
    [pins, quotes, boardId],
  );
}
