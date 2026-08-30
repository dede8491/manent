import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button, Field, Screen, ScreenHeader, Text } from '@/components';
import { useStore } from '@/store/useStore';
import { colors, spacing } from '@/theme';

export default function CreationCompte() {
  const router = useRouter();
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const canSubmit = pseudo.trim().length >= 2 && emailLooksValid && password.length >= 8;

  const submit = () => {
    completeOnboarding(pseudo, email.trim().toLowerCase());
    router.replace('/(tabs)');
  };

  const oauth = (provider: 'Google' | 'Apple') => {
    // L'authentification réelle passe par Supabase Auth (OAuth Google,
    // expo-apple-authentication) ; sans backend configuré on crée le profil local.
    Alert.alert(
      `Connexion ${provider}`,
      "Le fournisseur n'est pas configuré sur cette installation. On crée ton profil en local pour que tu puisses commencer.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          onPress: () => {
            completeOnboarding(pseudo || 'lecteur', null);
            router.replace('/(tabs)');
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={12}
    >
      <Screen>
        <ScreenHeader
          title="Crée ton compte"
          subtitle="Tes citations te suivent d'un appareil à l'autre."
        />

        <Field
          label="Pseudo"
          value={pseudo}
          onChangeText={setPseudo}
          placeholder="camille"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={24}
        />
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="camille@exemple.fr"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          placeholder="8 caractères minimum"
          secureTextEntry
          autoComplete="new-password"
          hint="8 caractères minimum."
        />

        <Button label="Créer mon compte" disabled={!canSubmit} onPress={submit} />

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text variant="small" style={styles.or}>
            ou
          </Text>
          <View style={styles.line} />
        </View>

        <Button label="Continuer avec Google" icon="🔵" variant="secondary" onPress={() => oauth('Google')} />
        <View style={styles.gap} />
        <Button label="Continuer avec Apple" icon="" variant="secondary" onPress={() => oauth('Apple')} />

        <Text variant="small" center style={styles.rgpd}>
          Conformément au RGPD, tu peux exporter ou supprimer toutes tes données à tout moment
          depuis les paramètres.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.rule },
  or: { marginHorizontal: spacing.md },
  gap: { height: spacing.sm },
  rgpd: { marginTop: spacing.xl },
});
