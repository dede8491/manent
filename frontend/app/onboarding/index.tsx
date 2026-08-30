import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { PrimaryButton, GhostButton } from '@/src/components/Button';
import { Wordmark, Monogram } from '@/src/components/Wordmark';

export default function Welcome() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.c, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]} testID="onboarding-welcome">
      <View style={styles.top}>
        <Monogram size={76} />
        <Wordmark size={40} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.promise}>Ce que tes lectures{'\n'}te laissent.</Text>
        <Text style={styles.subtext}>
          Photographie tes passages préférés,{'\n'}construis ta bibliothèque intime,{'\n'}partage des citations qui restent.
        </Text>
      </View>
      <View style={styles.bottom}>
        <PrimaryButton testID="onb-start" title="Commencer" onPress={() => router.push('/onboarding/account')} />
        <GhostButton testID="onb-signin" title="J'ai déjà un compte" onPress={() => router.push('/(auth)/login')} />
      </View>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.glacier, paddingHorizontal: spacing.xl },
  top: { alignItems: 'center', gap: spacing.sm },
  middle: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  promise: { fontFamily: fonts.displayMedium, fontSize: 34, color: colors.espresso, textAlign: 'center', lineHeight: 40 },
  subtext: { fontFamily: fonts.body, fontSize: 15, color: colors.clay, textAlign: 'center', marginTop: spacing.lg, lineHeight: 24 },
  bottom: { gap: spacing.sm },
});
