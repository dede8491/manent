import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';

// Carte « Littérature » (aire littéraire) : bisque, nom en Cormorant, compteur en méta.
export function AreaCard({ label, count, onPress, testID, width }: { label: string; count: number; onPress: () => void; testID?: string; width?: number }) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.card, width ? { width } : null, pressed && { opacity: 0.85 }]}>
      <Text style={styles.name} numberOfLines={2}>{label}</Text>
      <Text style={styles.count}>{count} {t(count > 1 ? 'livres' : 'livre')}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  card: { backgroundColor: colors.bisque, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minWidth: 150, maxWidth: 200, justifyContent: 'center' },
  name: { fontFamily: fonts.displayMedium, fontSize: 16.5, color: colors.espresso },
  count: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 0.8, marginTop: 3, textTransform: 'uppercase' },
});
