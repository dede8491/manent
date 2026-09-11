import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import { IconButton } from '@/src/components/IconButton';

// En-tête standard des écrans secondaires : retour à gauche, libellé en capitales au centre, action(s) à droite.
// Remplace les vingt en-têtes recopiés. Le retour est accessible (libellé « Retour », 44 × 44).
export function ScreenHeader({ title, right, onBack, backTestID = 'screen-back', style, large = false }: {
  title: string; right?: React.ReactNode; onBack?: () => void; backTestID?: string; style?: ViewStyle; large?: boolean;
}) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }, style]}>
      <IconButton name="chevron-left" label={t('Retour')} size={22} color={colors.espresso} testID={backTestID} onPress={onBack || (() => router.back())} />
      <Text style={large ? styles.titleLarge : styles.label} numberOfLines={1} accessibilityRole="header">{title}</Text>
      <View style={styles.right}>{right || null}</View>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  label: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  titleLarge: { flex: 1, textAlign: 'center', fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  right: { minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
});
