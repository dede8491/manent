import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';

// En-tête de fiche livre : dégradé vertical bisque → glacier derrière la barre (retour,
// libellé méta, action droite) et le bloc héros (couverture, titre, auteur…).
export function BookHero({ label, right, children, testID, onBack }: {
  label: string; right?: React.ReactNode; children: React.ReactNode; testID?: string; onBack?: () => void;
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <LinearGradient colors={[colors.bisque, colors.glacier]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ paddingTop: insets.top + spacing.sm }}>
      <View style={styles.bar}>
        <Pressable onPress={onBack || (() => router.back())} testID={testID} style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.right}>{right || null}</View>
      </View>
      <View style={styles.hero}>{children}</View>
    </LinearGradient>
  );
}

// Ligne « Sénégal » (pays d'origine de l'auteur) sous l'auteur ; les aires littéraires ont été retirées.
export function AreaLine({ areas, countries, style }: { areas?: string[]; countries?: string[]; style?: any }) {
  const styles = useStyles(makeStyles);
  void areas;
  const parts = (countries || []).slice(0, 2).filter(Boolean);
  if (!parts.length) return null;
  return <Text style={[styles.areaLine, style]} numberOfLines={1} testID="book-area-line">{parts.join('  ·  ')}</Text>;
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  right: { minWidth: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  hero: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  areaLine: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.chambray, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 },
});
