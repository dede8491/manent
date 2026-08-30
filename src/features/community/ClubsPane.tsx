import type { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Card, Pill, SectionHeader, Text } from '@/components';
import { formatDay } from '@/lib/format';
import { useStore } from '@/store/useStore';
import { colors, spacing } from '@/theme';

/** Le routeur est transmis par l'onglet parent pour éviter deux hooks concurrents. */
type Router = ReturnType<typeof useRouter>;

export function ClubsPane({ router }: { router: Router }) {
  const clubs = useStore((s) => s.clubs);
  const joinClub = useStore((s) => s.joinClub);
  const followedThemes = useStore((s) => s.user.followedThemes);

  const mine = clubs.filter((c) => c.joined);
  const discover = clubs
    .filter((c) => !c.joined)
    // Suggestion : d'abord les clubs qui partagent tes thèmes.
    .sort((a, b) => {
      const score = (themes: string[]) => themes.filter((t) => followedThemes.includes(t)).length;
      return score(b.themes) - score(a.themes);
    });

  return (
    <View>
      <SectionHeader title="Mes clubs" />
      {mine.length === 0 ? (
        <Card>
          <Text variant="bodySoft">
            Tu n’as rejoint aucun club. Un club, c’est une lecture commune et une discussion autour
            des passages.
          </Text>
        </Card>
      ) : (
        mine.map((club) => (
          <Card key={club.id} onPress={() => router.push(`/club/${club.id}`)}>
            <View style={styles.headRow}>
              <Text variant="sectionTitle" style={styles.name}>
                {club.name}
              </Text>
              {club.role === 'animatrice' ? (
                <Pill label="animatrice" bg={colors.amberPale} fg={colors.amber} />
              ) : null}
            </View>
            <Text variant="small">{club.memberCount} membres</Text>
            {club.commonRead ? (
              <Text variant="body" style={styles.read}>
                📖 {club.commonRead.bookTitle} · pour le {formatDay(club.commonRead.deadline)}
              </Text>
            ) : null}
          </Card>
        ))
      )}

      <SectionHeader title="Clubs à découvrir" />
      {discover.map((club) => (
        <Card key={club.id}>
          <View style={styles.headRow}>
            <Text variant="sectionTitle" style={styles.name}>
              {club.name}
            </Text>
            <Pill
              label={club.type === 'ouvert' ? 'ouvert' : 'sur invitation'}
              bg={club.type === 'ouvert' ? colors.greenPale : colors.rule}
              fg={club.type === 'ouvert' ? colors.green : colors.inkSoft}
            />
          </View>
          <Text variant="small" style={styles.desc}>
            {club.description}
          </Text>
          <Text variant="small" color={colors.green}>
            {club.themes.map((t) => `#${t}`).join(' ')} · {club.memberCount} membres
          </Text>
          <Button
            label={club.type === 'ouvert' ? 'Rejoindre' : 'Demander à rejoindre'}
            variant={club.type === 'ouvert' ? 'primary' : 'secondary'}
            onPress={() => {
              if (club.type === 'ouvert') {
                joinClub(club.id);
                router.push(`/club/${club.id}`);
                return;
              }
              // Club sur invitation : la demande part vers l'animateur.
              Alert.alert(
                'Demande envoyée',
                `${club.hostPseudo} recevra ta demande. Tu seras prévenue dès qu'elle sera acceptée.`,
              );
            }}
            style={styles.join}
          />
        </Card>
      ))}

      <Button
        label="+ Créer mon club de lecture"
        variant="dashed"
        onPress={() => router.push('/club/nouveau')}
        style={styles.create}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { flex: 1, paddingRight: spacing.sm },
  read: { marginTop: spacing.sm },
  desc: { marginTop: spacing.xs, marginBottom: spacing.sm },
  join: { marginTop: spacing.md },
  create: { marginTop: spacing.sm },
});
