import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '@/src/theme';
import { PrimaryButton, GhostButton } from '@/src/components/Button';
import { Wordmark } from '@/src/components/Wordmark';

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.c, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]} testID="onboarding-welcome">
      <View style={styles.top}>
        <View style={styles.monogram}><Text style={styles.mText}>M<Text style={{ color: colors.chambray }}>.</Text></Text></View>
        <Wordmark size={54} />
        <Text style={styles.baseline}>verba volant, scripta manent</Text>
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

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.glacier, paddingHorizontal: spacing.xl },
  top: { alignItems: 'center', gap: spacing.md },
  monogram: {
    width: 76, height: 76, borderRadius: 16, backgroundColor: colors.espresso,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  mText: { fontFamily: fonts.displayMedium, fontSize: 44, color: colors.creme, lineHeight: 52 },
  baseline: { fontFamily: fonts.display, fontSize: 14, color: colors.clay, letterSpacing: 0.5 },
  middle: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  promise: { fontFamily: fonts.displayMedium, fontSize: 34, color: colors.espresso, textAlign: 'center', lineHeight: 40 },
  subtext: { fontFamily: fonts.body, fontSize: 15, color: colors.clay, textAlign: 'center', marginTop: spacing.lg, lineHeight: 24 },
  bottom: { gap: spacing.sm },
});
