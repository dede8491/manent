import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radius, spacing } from '@/src/theme';
import { PrimaryButton, GhostButton } from '@/src/components/Button';
import { useAuth } from '@/src/auth';

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null); setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      setErr('Identifiants incorrects.');
    } finally { setLoading(false); }
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.glacier }}>
      <ScrollView contentContainerStyle={[styles.c, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} testID="login-back" style={styles.back}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.title}>Bon retour parmi nous</Text>
        <Text style={styles.sub}>Reprends là où tu t'étais arrêtée.</Text>
        <View style={{ height: spacing.xl }} />
        <Text style={styles.label}>E-mail</Text>
        <TextInput testID="login-email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="toi@exemple.com" placeholderTextColor={colors.clay} />
        <Text style={styles.label}>Mot de passe</Text>
        <TextInput testID="login-password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry placeholder="ton mot de passe" placeholderTextColor={colors.clay} />
        {err && <Text style={{ color: colors.espresso, marginTop: spacing.md, fontFamily: fonts.body }}>{err}</Text>}
        <View style={{ height: spacing.xl }} />
        <PrimaryButton testID="btn-login" title="Se connecter" onPress={submit} loading={loading} disabled={!email || !password} />
        <GhostButton testID="btn-goto-signup" title="Créer un compte" onPress={() => router.replace('/onboarding/account')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { paddingHorizontal: spacing.xl },
  back: { width: 40, height: 40, marginLeft: -8, alignItems: 'flex-start', justifyContent: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.espresso },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, marginTop: spacing.xs },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.xs },
  input: { height: 52, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, backgroundColor: colors.creme },
});
