import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components';
import { colors, spacing } from '@/theme';

export default function Bienvenue() {
  const router = useRouter();

  return (
    <Screen scroll={false} contentStyle={styles.wrap}>
      <View style={styles.center}>
        <View style={styles.logo}>
          <Text style={styles.logoMark}>❧</Text>
        </View>
        <Text variant="display" center style={styles.name}>
          Manent
        </Text>
        <Text variant="quoteLarge" center color={colors.inkSoft} style={styles.tagline}>
          Ce que tes lectures laissent derrière elles
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Commencer" onPress={() => router.push('/onboarding/personnalisation')} />
        <Button
          label="J'ai déjà un compte"
          variant="ghost"
          onPress={() => router.push('/onboarding/compte')}
          style={styles.secondary}
        />
        <Text variant="small" center style={styles.legal}>
          En continuant, tu acceptes les conditions d’utilisation et la politique de
          confidentialité de Manent.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xl, justifyContent: 'space-between', paddingVertical: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logoMark: { fontSize: 46, color: colors.amber },
  name: { fontSize: 42, lineHeight: 48, marginBottom: spacing.md },
  tagline: { maxWidth: 300 },
  actions: { gap: spacing.sm },
  secondary: { marginTop: spacing.xs },
  legal: { marginTop: spacing.md },
});
