import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { EmptyState, Screen, ScreenHeader } from '@/components';
import { PersoBook } from '@/features/book/PersoBook';
import { StudyBook } from '@/features/book/StudyBook';
import { WattpadBook } from '@/features/book/WattpadBook';
import { useStore } from '@/store/useStore';

/** Aiguille vers la fiche adaptée au type de lecture. */
export default function FicheLivre() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const book = useStore((s) => s.books.find((b) => b.id === id));
  const allQuotes = useStore((s) => s.quotes);

  const quotes = useMemo(() => allQuotes.filter((q) => q.bookId === id), [allQuotes, id]);

  if (!book) {
    return (
      <Screen>
        <ScreenHeader title="Lecture introuvable" />
        <EmptyState
          emoji="📖"
          title="Ce livre n'est plus dans ta bibliothèque"
          body="Il a peut-être été retiré depuis un autre appareil."
        />
      </Screen>
    );
  }

  if (book.kind === 'wattpad') return <WattpadBook book={book} quotes={quotes} />;
  if (book.kind === 'etude') return <StudyBook book={book} quotes={quotes} />;
  return <PersoBook book={book} quotes={quotes} />;
}
