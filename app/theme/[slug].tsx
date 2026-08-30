import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, QuoteSheet, Screen, ScreenHeader, Text } from '@/components';
import { themeEmoji, themeStats } from '@/data/themes';
import { useFeed } from '@/store/selectors';
import { useStore } from '@/store/useStore';
import { colors, spacing } from '@/theme';

export default function PageTheme() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const theme = decodeURIComponent(slug ?? '');

  const followed = useStore((s) => s.user.followedThemes.includes(theme));
  const toggleFollowedTheme = useStore((s) => s.toggleFollowedTheme);
  const books = useStore((s) => s.books);
  const myQuotes = useStore((s) => s.quotes);
  const feed = useFeed();

  const stats = themeStats(theme);

  const items = useMemo(
    () => feed.filter((i) => i.kind === 'quote' && i.quote.themes.includes(theme)),
    [feed, theme],
  );
  const mine = useMemo(() => myQuotes.filter((q) => q.themes.includes(theme)), [myQuotes, theme]);

  return (
    <Screen>
      <ScreenHeader title={`${themeEmoji(theme)} #${theme}`} />

      <Card style={styles.statsCard}>
        <View style={styles.stats}>
          <Stat value={stats.quotes} label="citations" />
          <Stat value={stats.books} label="livres" />
          <Stat value={stats.readers} label="lecteurs" />
        </View>
        <Button
          label={followed ? '✓ Thème suivi' : 'Suivre ce thème'}
          variant={followed ? 'secondary' : 'primary'}
          onPress={() => toggleFollowedTheme(theme)}
        />
        <Text variant="small" center style={styles.hint}>
          {followed
            ? 'Les nouvelles citations de ce thème apparaissent dans ton fil.'
            : 'Suivre un thème ajoute ses citations à ton fil d’accueil.'}
        </Text>
      </Card>

      {mine.length > 0 ? (
        <>
          <Text variant="sectionTitle" style={styles.section}>
            Tes citations sur ce thème
          </Text>
          {mine.map((q) => {
            const book = books.find((b) => b.id === q.bookId);
            return (
              <QuoteSheet
                key={q.id}
                text={q.text}
                locator={q.locator}
                bookTitle={book?.title ?? ''}
                bookAuthor={book?.author ?? ''}
                bookKind={book?.kind}
                themes={q.themes}
                isPrivate={!q.isPublic}
                onPress={() => router.push(`/citation/${q.id}`)}
              />
            );
          })}
        </>
      ) : null}

      <Text variant="sectionTitle" style={styles.section}>
        Dans la communauté
      </Text>
      {items.length === 0 ? (
        <EmptyState
          emoji="🌱"
          title="Ce thème démarre"
          body="Sois la première personne à y publier une citation."
          actionLabel="Capturer une citation"
          onAction={() => router.push('/capture')}
        />
      ) : (
        items.map((item) =>
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
        )
      )}
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="pageNumber" color={colors.green}>
        {value.toLocaleString('fr-FR')}
      </Text>
      <Text variant="small">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statsCard: {},
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  stat: { alignItems: 'center', flex: 1 },
  hint: { marginTop: spacing.sm },
  section: { marginTop: spacing.xl, marginBottom: spacing.md },
});
