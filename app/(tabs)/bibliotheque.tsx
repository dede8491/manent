import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { BookCard, Button, EmptyState, Screen, Segmented, Text } from '@/components';
import { pickPageNumberFromPhoto } from '@/features/capture/pageScan';
import { useStore } from '@/store/useStore';
import { colors, spacing } from '@/theme';
import type { BookStatus } from '@/types';

type Filter = 'tous' | BookStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'en-cours', label: 'En cours' },
  { value: 'termine', label: 'Terminés' },
  { value: 'a-lire', label: 'À lire' },
];

export default function Bibliotheque() {
  const router = useRouter();
  const books = useStore((s) => s.books);
  const quotes = useStore((s) => s.quotes);
  const setProgress = useStore((s) => s.setProgress);
  const [filter, setFilter] = useState<Filter>('tous');
  const [scanning, setScanning] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter === 'tous' ? books : books.filter((b) => b.status === filter)),
    [books, filter],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    quotes.forEach((q) => {
      map[q.bookId] = (map[q.bookId] ?? 0) + 1;
    });
    return map;
  }, [quotes]);

  /** Photographie la dernière page lue : l'IA lit le numéro et met à jour la progression. */
  const capturePage = async (bookId: string, title: string) => {
    setScanning(bookId);
    try {
      const page = await pickPageNumberFromPhoto();
      if (page == null) return;
      setProgress(bookId, page);
      Alert.alert('Progression mise à jour', `${title} — tu en es à la page ${page}.`);
    } catch (error) {
      Alert.alert(
        'Numéro de page introuvable',
        error instanceof Error ? error.message : "L'image n'a pas pu être lue.",
      );
    } finally {
      setScanning(null);
    }
  };

  return (
    <Screen tabBarPadding>
      <View style={styles.head}>
        <Text variant="title">Ma bibliothèque</Text>
        <Text variant="bodySoft">
          {books.length} lectures · {quotes.length} citations
        </Text>
      </View>

      <Segmented options={FILTERS} value={filter} onChange={setFilter} />

      <View style={styles.list}>
        {visible.length === 0 ? (
          <EmptyState
            emoji="📚"
            title="Rien dans cette étagère"
            body="Ajoute un livre papier, une histoire Wattpad ou une œuvre au programme."
            actionLabel="Ajouter une lecture"
            onAction={() => router.push('/ajouter')}
          />
        ) : (
          visible.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              quoteCount={counts[book.id] ?? 0}
              onPress={() => router.push(`/livre/${book.id}`)}
              footer={
                book.status === 'en-cours' && book.kind !== 'wattpad' ? (
                  <Button
                    label="📷 Photographier ma dernière page lue"
                    variant="dashed"
                    small
                    loading={scanning === book.id}
                    onPress={() => capturePage(book.id, book.title)}
                    style={styles.captureBtn}
                  />
                ) : null
              }
            />
          ))
        )}
      </View>

      <Button
        label="+ Ajouter un livre ou une histoire"
        variant="dashed"
        onPress={() => router.push('/ajouter')}
        style={styles.add}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: spacing.lg },
  list: { marginTop: spacing.lg },
  captureBtn: { marginTop: spacing.md, borderColor: colors.green },
  add: { marginTop: spacing.sm },
});
