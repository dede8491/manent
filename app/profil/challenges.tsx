import { StyleSheet, View } from 'react-native';

import { Card, ProgressBar, Screen, ScreenHeader, SectionHeader, Text } from '@/components';
import { daysUntil, plural } from '@/lib/format';
import { useStore } from '@/store/useStore';
import { colors, radii, spacing } from '@/theme';

export default function Challenges() {
  const challenges = useStore((s) => s.challenges);
  const badges = useStore((s) => s.badges);
  const stats = useStore((s) => s.stats);

  const unlocked = badges.filter((b) => b.unlocked);
  const locked = badges.filter((b) => !b.unlocked);

  return (
    <Screen>
      <ScreenHeader title="Challenges, badges et statistiques" />

      <SectionHeader title="Challenges en cours" />
      {challenges.map((c) => (
        <Card key={c.id}>
          <View style={styles.headRow}>
            <Text variant="sectionTitle" style={styles.title}>
              {c.title}
            </Text>
            <Text variant="small" color={c.scope === 'club' ? colors.amber : colors.green}>
              {c.scope === 'club' ? c.clubName : 'public'}
            </Text>
          </View>
          <View style={styles.bar}>
            <ProgressBar
              value={c.progress}
              total={c.goal}
              color={c.scope === 'club' ? colors.amber : colors.green}
            />
          </View>
          <Text variant="small">
            {c.progress} / {c.goal} {c.unit} · fin dans {plural(daysUntil(c.endsAt), 'jour', 'jours')}
          </Text>
          <Text variant="small" style={styles.participants}>
            {c.participants.toLocaleString('fr-FR')} participants
          </Text>
        </Card>
      ))}

      <SectionHeader title={`Badges (${unlocked.length}/${badges.length})`} />
      <View style={styles.badges}>
        {[...unlocked, ...locked].map((b) => (
          <View key={b.id} style={[styles.badge, !b.unlocked && styles.badgeLocked]}>
            <Text style={[styles.badgeEmoji, !b.unlocked && styles.lockedEmoji]}>{b.emoji}</Text>
            <Text variant="label" center numberOfLines={2} color={b.unlocked ? colors.ink : colors.muted}>
              {b.label}
            </Text>
            <Text variant="small" center numberOfLines={2} color={colors.muted}>
              {b.unlocked ? 'obtenu' : b.description}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Statistiques" />
      <Card>
        <StatRow label="Pages lues ce mois-ci" value={`${stats.pagesThisMonth}`} />
        <StatRow label="Série de jours" value={`🔥 ${plural(stats.streakDays, 'jour', 'jours')}`} />
        <StatRow label="Genres explorés" value={stats.genres.join(', ')} />
        <StatRow label="Thème du mois" value={`#${stats.themeOfMonth}`} last />
      </Card>
    </Screen>
  );
}

function StatRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.statRow, last && styles.statRowLast]}>
      <Text variant="body" style={styles.statLabel}>
        {label}
      </Text>
      <Text variant="label" color={colors.green} style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { flex: 1, paddingRight: spacing.sm },
  bar: { marginTop: spacing.md, marginBottom: spacing.sm },
  participants: { marginTop: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  badge: {
    width: '31%',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  badgeLocked: { backgroundColor: colors.paper, borderStyle: 'dashed' },
  badgeEmoji: { fontSize: 28, marginBottom: spacing.xs },
  lockedEmoji: { opacity: 0.3 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  statRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  statLabel: { flex: 1, paddingRight: spacing.md },
  statValue: { flexShrink: 1, textAlign: 'right' },
});
