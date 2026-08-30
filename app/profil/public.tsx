import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Avatar, Button, Card, Pill, QuoteSheet, Screen, ScreenHeader, SectionHeader, Text,
} from '@/components';
import { plural } from '@/lib/format';
import { copyLink, publicProfileUrl } from '@/services/share';
import { useStore } from '@/store/useStore';
import { colors, radii, spacing } from '@/theme';

/** Aperçu de la page web publique manent.app/@pseudo, telle que la voient les autres. */
export default function ProfilPublic() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const books = useStore((s) => s.books);
  const quotes = useStore((s) => s.quotes);
  const boards = useStore((s) => s.boards);
  const allBadges = useStore((s) => s.badges);
  const pins = useStore((s) => s.pins);

  const badges = useMemo(() => allBadges.filter((b) => b.unlocked), [allBadges]);
  const publicQuotes = quotes.filter((q) => q.isPublic).slice(0, 5);
  const publicBoards = boards.filter((b) => b.visibility !== 'prive');

  return (
    <Screen>
      <ScreenHeader title="Mon profil public" />

      <View style={styles.banner}>
        <Text variant="small" color={colors.green}>
          👁 Voici ce que les autres voient — sur l’app comme sur {publicProfileUrl(user.pseudo)}
        </Text>
      </View>

      <Card>
        <View style={styles.head}>
          <Avatar emoji={user.avatarEmoji} size={60} />
          <View style={styles.identity}>
            <Text variant="title">{user.pseudo}</Text>
            <Text variant="small">
              {user.followers} abonnés · {plural(publicQuotes.length, 'citation publique', 'citations publiques')}
            </Text>
          </View>
          <Button label="Suivre" small full={false} onPress={() => {}} />
        </View>
        {user.bio ? (
          <Text variant="bodySoft" style={styles.bio}>
            {user.bio}
          </Text>
        ) : null}

        <View style={styles.badges}>
          {badges.map((b) => (
            <Pill key={b.id} label={`${b.emoji} ${b.label}`} bg={colors.amberPale} fg={colors.amber} />
          ))}
        </View>
      </Card>

      <SectionHeader title="Tableaux publics" />
      {publicBoards.length === 0 ? (
        <Card>
          <Text variant="bodySoft">
            Aucun tableau public. Passe un tableau en public pour qu’il apparaisse ici.
          </Text>
        </Card>
      ) : (
        publicBoards.map((b) => (
          <Card key={b.id} onPress={() => router.push(`/tableau/${b.id}`)}>
            <Text variant="sectionTitle" color={colors.green}>
              {b.name}
            </Text>
            <Text variant="small">{b.description}</Text>
            <Text variant="small" style={styles.pinCount}>
              {plural(pins.filter((p) => p.boardId === b.id).length, 'épingle', 'épingles')}
            </Text>
          </Card>
        ))
      )}

      <SectionHeader title="Dernières citations publiques" />
      {publicQuotes.length === 0 ? (
        <Card>
          <Text variant="bodySoft">
            Tes citations sont toutes privées. Passe-en une en publique pour ouvrir ta page.
          </Text>
        </Card>
      ) : (
        publicQuotes.map((q) => {
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
              onPress={() => router.push(`/citation/${q.id}`)}
            />
          );
        })
      )}

      <Button
        label="🔗 Copier le lien de mon profil"
        variant="secondary"
        onPress={() => copyLink(publicProfileUrl(user.pseudo), 'Lien du profil copié')}
        style={styles.copy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.greenPale,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  identity: { flex: 1, marginLeft: spacing.md },
  bio: { marginTop: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  pinCount: { marginTop: spacing.xs },
  copy: { marginTop: spacing.xl },
});
