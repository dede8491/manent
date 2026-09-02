import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';

// Carte club public : bisque, globe, nom Cormorant, description 2 lignes, membres, Rejoindre.
export function ClubCard({ club, onJoin, onOpen, joining, testID }: {
  club: { club_id: string; name: string; description?: string | null; members_count?: number; visibility?: string };
  onJoin?: () => void; onOpen?: () => void; joining?: boolean; testID?: string;
}) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const n = club.members_count || 0;
  return (
    <Pressable testID={testID} onPress={onOpen} disabled={!onOpen} style={styles.card}>
      <View style={styles.avatar}><Feather name={club.visibility === 'private' ? 'lock' : 'globe'} size={15} color={colors.chambray} /></View>
      <Text style={styles.name} numberOfLines={1}>{club.name}</Text>
      <Text style={styles.desc} numberOfLines={2}>{club.description || t('Un club de lecture ouvert à toutes et tous.')}</Text>
      <Text style={styles.meta}>{n} {t(n > 1 ? 'MEMBRES' : 'MEMBRE')}</Text>
      {onJoin && (
        <Pressable testID={testID ? `${testID}-join` : undefined} onPress={onJoin} disabled={joining} style={({ pressed }) => [styles.joinBtn, (pressed || joining) && { opacity: 0.8 }]}>
          <Text style={styles.joinText}>{joining ? '…' : t('Rejoindre')}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  card: { width: 200, backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.glacier, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  name: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso },
  desc: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, lineHeight: 17, minHeight: 34 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.clay, letterSpacing: 1, marginTop: 2 },
  joinBtn: { marginTop: 8, height: 34, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  joinText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.creme },
});
