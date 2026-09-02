import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fonts, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { PrimaryButton, GhostButton } from '@/src/components/Button';
import { Wordmark } from '@/src/components/Wordmark';
import { useT } from '@/src/i18n';

// Écran d'accueil : un seul repère de marque (le mot-symbole), une promesse incarnée,
// trois lignes qui disent tout ce que fait Manent. Fond glacier uni, aucune illustration.
const LINES: { icon: React.ComponentProps<typeof Feather>['name']; text: string }[] = [
  { icon: 'camera', text: 'Tes citations, photographiées' },
  { icon: 'compass', text: 'Des livres choisis pour toi' },
  { icon: 'users', text: 'Des clubs de lecture à rejoindre' },
];

export default function Welcome() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fades = useRef(LINES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(140, fades.map(v => Animated.timing(v, { toValue: 1, duration: 420, delay: 250, useNativeDriver: true }))).start();
  }, [fades]);

  return (
    <View style={[styles.c, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]} testID="onboarding-welcome">
      <View style={styles.top}>
        <Wordmark size={40} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.promise}>{t('Lis. Retiens.\nPartage.')}</Text>
        <Text style={styles.subtext}>{t('Garde les passages qui te marquent, suis tes lectures, découvre des livres à ton image et lis à plusieurs dans un club.')}</Text>
        <View style={styles.lines}>
          {LINES.map((l, i) => (
            <Animated.View key={l.icon} style={[styles.line, { opacity: fades[i], transform: [{ translateY: fades[i].interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
              <View style={styles.lineIcon}><Feather name={l.icon} size={15} color={colors.chambray} /></View>
              <Text style={styles.lineText}>{t(l.text)}</Text>
            </Animated.View>
          ))}
        </View>
      </View>
      <View style={styles.bottom}>
        <PrimaryButton testID="onb-start" title={t('Commencer')} onPress={() => router.push('/onboarding/account')} />
        <GhostButton testID="onb-signin" title={t("J'ai déjà un compte")} onPress={() => router.push('/(auth)/login')} />
      </View>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.glacier, paddingHorizontal: spacing.xl },
  top: { alignItems: 'center', paddingTop: spacing.lg },
  middle: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  promise: { fontFamily: fonts.displayMedium, fontSize: 40, color: colors.espresso, textAlign: 'center', lineHeight: 46 },
  subtext: { fontFamily: fonts.body, fontSize: 15, color: colors.clay, textAlign: 'center', marginTop: spacing.lg, lineHeight: 23, maxWidth: 320 },
  lines: { marginTop: spacing.xxl, gap: spacing.md, alignSelf: 'stretch', alignItems: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, width: 280 },
  lineIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  lineText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.espresso, letterSpacing: 1.6, textTransform: 'uppercase', flex: 1 },
  bottom: { gap: spacing.sm },
});
