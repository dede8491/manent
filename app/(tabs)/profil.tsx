import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Pill, Screen, SectionHeader, Text } from '@/components';
import { useStore } from '@/store/useStore';
import { colors, radii, spacing } from '@/theme';

export default function Profil() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const books = useStore((s) => s.books);
  const quotes = useStore((s) => s.quotes);
  const boards = useStore((s) => s.boards);

  const finished = books.filter((b) => b.status === 'termine').length;

  return (
    <Screen tabBarPadding>
      <View style={styles.head}>
        <Avatar emoji={user.avatarEmoji} size={72} />
        <View style={styles.identity}>
          <Text variant="title">{user.pseudo}</Text>
          <Text variant="small">
            {user.followers} abonnés · {user.following} abonnements
          </Text>
          {user.premium ? <Pill label="Premium" bg={colors.amberPale} fg={colors.amber} /> : null}
        </View>
      </View>

      {user.bio ? (
        <Text variant="bodySoft" style={styles.bio}>
          {user.bio}
        </Text>
      ) : null}

      <View style={styles.stats}>
        <StatCard value={finished} label="livres terminés" />
        <StatCard value={quotes.length} label="citations capturées" />
        <StatCard value={boards.length} label="tableaux" />
        <StatCard value={user.followedThemes.length} label="thèmes suivis" />
      </View>

      <Button
        label="🏆 Mes challenges, badges et statistiques"
        variant="secondary"
        onPress={() => router.push('/profil/challenges')}
        style={styles.action}
      />
      <Button
        label="Voir mon profil public"
        variant="secondary"
        onPress={() => router.push('/profil/public')}
        style={styles.action}
      />

      {!user.premium ? (
        <Card style={styles.premiumCard}>
          <Text variant="overline" color={colors.amber}>
            MANENT PREMIUM
          </Text>
          <Text variant="sectionTitle" style={styles.premiumTitle}>
            Captures illimitées, export PDF, clubs sans limite
          </Text>
          <Text variant="bodySoft" style={styles.premiumBody}>
            3,99 €/mois ou 34,99 €/an. Essai gratuit de 7 jours.
          </Text>
          <Button label="Découvrir Premium" onPress={() => router.push('/premium')} />
        </Card>
      ) : (
        <Card style={styles.premiumCard}>
          <Text variant="overline" color={colors.amber}>
            MANENT PREMIUM ACTIF
          </Text>
          <Text variant="bodySoft" style={styles.premiumBody}>
            Abonnement {user.plan ?? 'mensuel'}. Merci de faire vivre Manent.
          </Text>
          <Button label="Gérer mon abonnement" variant="secondary" onPress={() => router.push('/premium')} />
        </Card>
      )}

      <SectionHeader title="Réglages" />
      <Button
        label="⚙️ Paramètres"
        variant="secondary"
        onPress={() => router.push('/parametres')}
        style={styles.action}
      />
      <Button
        label="🔔 Notifications"
        variant="secondary"
        onPress={() => router.push('/notifications')}
        style={styles.action}
      />
    </Screen>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text variant="pageNumber" color={colors.green}>
        {value}
      </Text>
      <Text variant="small" center>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  identity: { marginLeft: spacing.lg, flex: 1, gap: 4 },
  bio: { marginBottom: spacing.lg },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  action: { marginBottom: spacing.sm },
  premiumCard: { marginTop: spacing.lg, borderColor: colors.amber, backgroundColor: colors.amberPale },
  premiumTitle: { marginTop: spacing.xs },
  premiumBody: { marginTop: spacing.xs, marginBottom: spacing.lg },
});
