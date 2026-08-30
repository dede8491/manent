import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import {
  Avatar, Button, Card, Pill, QuoteSheet, Screen, Text, ThemeRow,
} from '@/components';
import { useFeed } from '@/store/selectors';
import { useStore } from '@/store/useStore';
import { colors, radii, spacing } from '@/theme';
import type { FeedItem } from '@/types';

const POUR_TOI = 'Pour toi';

export default function Accueil() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const notifications = useStore((s) => s.notifications);
  const [filter, setFilter] = useState(POUR_TOI);

  const unread = notifications.filter((n) => !n.read).length;
  const chips = useMemo(() => [POUR_TOI, ...user.followedThemes], [user.followedThemes]);

  const feed = useFeed();
  const filtered = useMemo(() => {
    if (filter === POUR_TOI) return feed;
    return feed.filter((item) =>
      item.kind === 'quote'
        ? item.quote.themes.includes(filter)
        : item.kind === 'reader'
          ? item.themes.includes(filter)
          : false,
    );
  }, [feed, filter]);

  return (
    <Screen tabBarPadding>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Chercher un thème, un livre, un lecteur"
          onPress={() => router.push('/recherche')}
          style={styles.searchBar}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text variant="bodySoft" numberOfLines={1} style={styles.searchText}>
            Chercher un thème, un livre, un lecteur…
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `${unread} notifications non lues` : 'Notifications'}
          onPress={() => router.push('/notifications')}
          style={styles.bell}
          hitSlop={8}
        >
          <Text style={styles.bellIcon}>🔔</Text>
          {unread > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>

      <ThemeRow themes={chips} selected={filter} onSelect={setFilter} />

      {filtered.length === 0 ? (
        <Card style={styles.empty}>
          <Text variant="sectionTitle">Rien pour #{filter} aujourd’hui</Text>
          <Text variant="bodySoft" style={styles.emptyBody}>
            Ce thème est calme cette semaine. Capture la première citation et elle ouvrira le fil.
          </Text>
          <Button label="Capturer une citation" onPress={() => router.push('/capture')} />
        </Card>
      ) : (
        filtered.map((item) => <FeedCard key={item.id} item={item} />)
      )}
    </Screen>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const router = useRouter();

  if (item.kind === 'quote') {
    return (
      <View>
        {item.quote.bookKind === 'wattpad' ? (
          <Pill label="🧡 Wattpad" bg={colors.wattpadPale} fg={colors.wattpad} style={styles.feedPill} />
        ) : null}
        <QuoteSheet
          text={item.quote.text}
          locator={item.quote.locator}
          bookTitle={item.quote.bookTitle}
          bookAuthor={item.quote.bookAuthor}
          bookKind={item.quote.bookKind}
          themes={item.quote.themes}
          note={item.quote.note}
          byline={{ pseudo: item.author.pseudo, avatarEmoji: item.author.avatarEmoji }}
          onPress={() => router.push(`/theme/${encodeURIComponent(item.quote.themes[0] ?? 'lecture')}`)}
        />
      </View>
    );
  }

  if (item.kind === 'sponsored') {
    return (
      <Card style={styles.sponsored}>
        <View style={styles.sponsorHead}>
          <Pill label="Sponsorisé" bg={colors.amberPale} fg={colors.amber} />
          <Text variant="small" style={styles.sponsorName}>
            par {item.sponsor}
          </Text>
        </View>
        <View style={styles.sponsorVisual}>
          <Text style={styles.sponsorGlyph}>❧</Text>
        </View>
        <Text variant="sectionTitle" style={styles.sponsorTitle}>
          {item.headline}
        </Text>
        <Text variant="bodySoft" style={styles.sponsorBody}>
          {item.body}
        </Text>
        <Button
          label="Visiter"
          variant="secondary"
          onPress={() => Linking.openURL(item.ctaUrl).catch(() => {})}
        />
      </Card>
    );
  }

  if (item.kind === 'reader') {
    return (
      <Card>
        <View style={styles.readerRow}>
          <Avatar emoji={item.author.avatarEmoji} size={46} />
          <View style={styles.readerInfo}>
            <Text variant="label">{item.author.pseudo}</Text>
            <Text variant="small">
              {item.quotes} citations · {item.boards} tableaux
            </Text>
            <Text variant="small" color={colors.green}>
              {item.themes.map((t) => `#${t}`).join(' ')}
            </Text>
          </View>
          <Button label="Suivre" variant="secondary" small full={false} onPress={() => {}} />
        </View>
      </Card>
    );
  }

  return (
    <Card onPress={() => router.push('/(tabs)/communaute')}>
      <Text variant="overline">TABLEAU SUGGÉRÉ</Text>
      <Text variant="sectionTitle" color={colors.green} style={styles.boardName}>
        {item.boardName}
      </Text>
      <Text variant="quote" numberOfLines={2} style={styles.boardPreview}>
        « {item.preview} »
      </Text>
      <Text variant="small">
        {item.pins} épingles · par {item.author.pseudo}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  searchIcon: { fontSize: 14, marginRight: spacing.sm },
  searchText: { flex: 1 },
  bell: { marginLeft: spacing.md, padding: 4 },
  bellIcon: { fontSize: 22 },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brick,
    borderWidth: 1.5,
    borderColor: colors.paper,
  },
  empty: { marginTop: spacing.lg },
  emptyBody: { marginTop: spacing.xs, marginBottom: spacing.lg },
  feedPill: { marginBottom: spacing.xs, marginLeft: spacing.xs },
  sponsored: {},
  sponsorHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  sponsorName: { marginLeft: spacing.sm },
  sponsorVisual: {
    height: 120,
    borderRadius: radii.md,
    backgroundColor: colors.greenPale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  sponsorGlyph: { fontSize: 46, color: colors.green },
  sponsorTitle: { marginBottom: spacing.xs },
  sponsorBody: { marginBottom: spacing.lg },
  readerRow: { flexDirection: 'row', alignItems: 'center' },
  readerInfo: { flex: 1, marginLeft: spacing.md },
  boardName: { marginTop: spacing.xs },
  boardPreview: { marginVertical: spacing.sm },
});
