import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, EmptyState, Screen, ScreenHeader, Text } from '@/components';
import { timeAgo } from '@/lib/format';
import { useStore } from '@/store/useStore';
import { colors, radii, spacing } from '@/theme';
import type { NotificationKind } from '@/types';

const ICONS: Record<NotificationKind, string> = {
  pin: '📌',
  board: '👥',
  club: '📖',
  theme: '🌱',
  wattpad: '🧡',
  system: '❧',
};

export default function Notifications() {
  const router = useRouter();
  const notifications = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationsRead);

  // Ouvrir l'écran vaut lecture : la pastille du fil disparaît en sortant.
  useEffect(() => () => markRead(), [markRead]);

  return (
    <Screen>
      <ScreenHeader title="Notifications" />

      {notifications.length === 0 ? (
        <EmptyState
          emoji="🔔"
          title="Rien de neuf"
          body="Les épinglages de tes citations, l'activité de tes clubs et les nouveaux chapitres Wattpad arrivent ici."
        />
      ) : (
        notifications.map((n) => (
          <Card key={n.id} onPress={n.href ? () => router.push(n.href as never) : undefined} style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.icon, !n.read && styles.iconUnread]}>
                <Text style={styles.iconText}>{ICONS[n.kind]}</Text>
              </View>
              <View style={styles.body}>
                <Text variant="label">{n.title}</Text>
                <Text variant="small" style={styles.text}>
                  {n.body}
                </Text>
                <Text variant="small" color={colors.muted}>
                  {timeAgo(n.createdAt)}
                </Text>
              </View>
              {!n.read ? <View style={styles.dot} /> : null}
            </View>
          </Card>
        ))
      )}

      <Pressable accessibilityRole="button" onPress={markRead} style={styles.markAll}>
        <Text variant="label" color={colors.green} center>
          Tout marquer comme lu
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconUnread: { backgroundColor: colors.greenPale },
  iconText: { fontSize: 18 },
  body: { flex: 1 },
  text: { marginVertical: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brick, marginTop: 6 },
  markAll: { paddingVertical: spacing.lg },
});
