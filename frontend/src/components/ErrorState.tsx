import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';

// État d'erreur partagé : dit qu'un chargement a échoué et propose de réessayer.
// À utiliser à la place d'un état vide quand la requête a échoué (un vide invite à recréer ce qui existe déjà).
export function ErrorState({ onRetry, title, text, compact = false, testID = 'error-state' }: {
  onRetry?: () => void; title?: string; text?: string; compact?: boolean; testID?: string;
}) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.box, compact && styles.compact]} testID={testID} accessibilityRole="alert">
      <Feather name="wifi-off" size={compact ? 16 : 22} color={colors.clay} />
      <View style={{ flex: compact ? 1 : undefined, alignItems: compact ? 'flex-start' : 'center' }}>
        <Text style={[styles.title, compact && styles.titleCompact]}>{title || t('Impossible de charger.')}</Text>
        {!compact && <Text style={styles.text}>{text || t('Vérifie ta connexion, puis réessaie. Tes données sont intactes.')}</Text>}
      </View>
      {onRetry && (
        <Pressable testID={`${testID}-retry`} onPress={onRetry} accessibilityRole="button" accessibilityLabel={t('Réessayer')} style={[styles.btn, compact && styles.btnCompact]}>
          <Feather name="refresh-cw" size={13} color={colors.espresso} />
          <Text style={styles.btnText}>{t('Réessayer')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  box: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  compact: { flexDirection: 'row', paddingVertical: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, gap: spacing.sm },
  title: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, textAlign: 'center' },
  titleCompact: { fontFamily: fonts.body, fontSize: 13, textAlign: 'left' },
  text: { fontFamily: fonts.body, fontSize: 13.5, color: colors.clay, textAlign: 'center', lineHeight: 19, marginTop: 4, maxWidth: 300 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme },
  btnCompact: { height: 34, paddingHorizontal: 12 },
  btnText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso },
});
