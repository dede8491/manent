import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  Avatar, Card, Chip, EmptyState, QuoteSheet, Screen, ScreenHeader, Segmented, Text,
} from '@/components';
import { TRENDING_THEMES } from '@/data/themes';
import { useFeed } from '@/store/selectors';
import { useStore } from '@/store/useStore';
import { colors, radii, spacing, type } from '@/theme';

type Scope = 'citations' | 'livres' | 'tableaux' | 'lecteurs';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'citations', label: 'Citations' },
  { value: 'livres', label: 'Livres' },
  { value: 'tableaux', label: 'Tableaux' },
  { value: 'lecteurs', label: 'Lecteurs' },
];

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function Recherche() {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [scope, setScope] = useState<Scope>('citations');

  const feed = useFeed();
  const books = useStore((s) => s.books);
  const boards = useStore((s) => s.boards);
  const quotes = useStore((s) => s.quotes);

  const q = norm(term.trim());
  const active = q.length > 0;

  const results = useMemo(() => {
    if (!active) return { quotes: [], books: [], boards: [], readers: [] };

    const feedQuotes = feed.flatMap((item) =>
      item.kind === 'quote' &&
      (norm(item.quote.text).includes(q) ||
        norm(item.quote.bookTitle).includes(q) ||
        item.quote.themes.some((t) => norm(t).includes(q)))
        ? [item]
        : [],
    );

    const mine = quotes.filter(
      (quote) => norm(quote.text).includes(q) || quote.themes.some((t) => norm(t).includes(q)),
    );

    return {
      quotes: feedQuotes,
      mine,
      books: books.filter((b) => norm(b.title).includes(q) || norm(b.author).includes(q)),
      boards: boards.filter((b) => norm(b.name).includes(q) || norm(b.description).includes(q)),
      readers: feed.flatMap((item) =>
        item.kind === 'reader' && norm(item.author.pseudo).includes(q) ? [item] : [],
      ),
    };
  }, [active, q, feed, books, boards, quotes]);

  return (
    <Screen>
      <ScreenHeader title="Recherche" />

      <View style={styles.searchBar}>
        <Text style={styles.icon}>🔍</Text>
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Chercher un thème, un livre, un lecteur…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoFocus
          returnKeyType="search"
          accessibilityLabel="Champ de recherche"
        />
      </View>

      <View style={styles.segmented}>
        <Segmented options={SCOPES} value={scope} onChange={setScope} />
      </View>

      {!active ? (
        <>
          <Text variant="sectionTitle" style={styles.trendingTitle}>
            Thèmes populaires cette semaine
          </Text>
          <View style={styles.chips}>
            {TRENDING_THEMES.map((t) => (
              <Chip key={t} label={`#${t}`} onPress={() => router.push(`/theme/${encodeURIComponent(t)}`)} />
            ))}
          </View>
        </>
      ) : scope === 'citations' ? (
        <ResultList empty="Aucune citation ne contient ces mots.">
          {[
            ...(results.mine ?? []).map((quote) => {
              const book = books.find((b) => b.id === quote.bookId);
              return (
                <QuoteSheet
                  key={quote.id}
                  text={quote.text}
                  locator={quote.locator}
                  bookTitle={book?.title ?? ''}
                  bookAuthor={book?.author ?? ''}
                  bookKind={book?.kind}
                  themes={quote.themes}
                  isPrivate={!quote.isPublic}
                  onPress={() => router.push(`/citation/${quote.id}`)}
                />
              );
            }),
            ...results.quotes.map((item) =>
              item.kind === 'quote' ? (
                <QuoteSheet
                  key={item.id}
                  text={item.quote.text}
                  locator={item.quote.locator}
                  bookTitle={item.quote.bookTitle}
                  bookAuthor={item.quote.bookAuthor}
                  bookKind={item.quote.bookKind}
                  themes={item.quote.themes}
                  byline={{ pseudo: item.author.pseudo, avatarEmoji: item.author.avatarEmoji }}
                />
              ) : null,
            ),
          ]}
        </ResultList>
      ) : scope === 'livres' ? (
        <ResultList empty="Aucun livre de ta bibliothèque ne correspond.">
          {results.books.map((b) => (
            <Card key={b.id} onPress={() => router.push(`/livre/${b.id}`)}>
              <Text variant="sectionTitle">{b.title}</Text>
              <Text variant="small">{b.author}</Text>
            </Card>
          ))}
        </ResultList>
      ) : scope === 'tableaux' ? (
        <ResultList empty="Aucun tableau à ce nom.">
          {results.boards.map((b) => (
            <Card key={b.id} onPress={() => router.push(`/tableau/${b.id}`)}>
              <Text variant="sectionTitle" color={colors.green}>
                {b.name}
              </Text>
              <Text variant="small">{b.description}</Text>
            </Card>
          ))}
        </ResultList>
      ) : (
        <ResultList empty="Aucun lecteur trouvé.">
          {results.readers.map((item) =>
            item.kind === 'reader' ? (
              <Card key={item.id}>
                <View style={styles.readerRow}>
                  <Avatar emoji={item.author.avatarEmoji} />
                  <View style={styles.readerInfo}>
                    <Text variant="label">{item.author.pseudo}</Text>
                    <Text variant="small">{item.quotes} citations</Text>
                  </View>
                </View>
              </Card>
            ) : null,
          )}
        </ResultList>
      )}
    </Screen>
  );
}

function ResultList({ children, empty }: { children: React.ReactNode; empty: string }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const count = Array.isArray(items) ? items.length : items ? 1 : 0;
  if (count === 0) {
    return <EmptyState emoji="🔎" title="Aucun résultat" body={empty} />;
  }
  return <View style={styles.results}>{items}</View>;
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  icon: { fontSize: 15, marginRight: spacing.sm },
  input: { ...type.body, flex: 1, paddingVertical: 0 },
  segmented: { marginTop: spacing.md },
  trendingTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  results: { marginTop: spacing.lg },
  readerRow: { flexDirection: 'row', alignItems: 'center' },
  readerInfo: { marginLeft: spacing.md },
});
