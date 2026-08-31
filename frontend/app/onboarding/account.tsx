import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { PrimaryButton, GhostButton } from '@/src/components/Button';
import { useAuth } from '@/src/auth';
import { useT } from '@/src/i18n';

export default function Account() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuth();
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birth, setBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // JJ/MM/AAAA avec ajout automatique des « / »
  const onBirthChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setBirth(out);
  };

  const birthIso = React.useMemo(() => {
    const m = birth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [, d, mo, y] = m;
    const dt = new Date(`${y}-${mo}-${d}T00:00:00Z`);
    if (isNaN(dt.getTime()) || dt.getUTCDate() !== parseInt(d, 10) || dt > new Date() || parseInt(y, 10) < 1900) return null;
    return `${y}-${mo}-${d}`;
  }, [birth]);

  const submit = async () => {
    setErr(null); setLoading(true);
    try {
      await signUp(email.trim(), password, pseudo.trim(), birthIso || undefined);
      router.replace('/onboarding/themes');
    } catch (e: any) {
      setErr(e.detail?.detail === 'email_taken' ? t('Cette adresse est déjà utilisée.') : t('Impossible de créer ton compte.'));
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.glacier }}>
      <ScrollView contentContainerStyle={[styles.c, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} testID="onb-back" style={styles.back}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.title}>{t('Créer ton compte')}</Text>
        <Text style={styles.sub}>{t('Rejoins Manent en quelques secondes.')}</Text>

        <View style={{ height: spacing.xl }} />
        <Text style={styles.label}>{t('Pseudo')}</Text>
        <TextInput testID="input-pseudo" value={pseudo} onChangeText={setPseudo} placeholder="Léa" placeholderTextColor={colors.clay} style={styles.input} autoCapitalize="none" />
        <Text style={styles.label}>{t('E-mail')}</Text>
        <TextInput testID="input-email" value={email} onChangeText={setEmail} placeholder="toi@exemple.com" placeholderTextColor={colors.clay} style={styles.input} autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.label}>{t('Mot de passe')}</Text>
        <TextInput testID="input-password" value={password} onChangeText={setPassword} placeholder={t('6 caractères minimum')} placeholderTextColor={colors.clay} style={styles.input} secureTextEntry />
        <Text style={styles.label}>{t('Date de naissance')}</Text>
        <TextInput testID="input-birthdate" value={birth} onChangeText={onBirthChange} placeholder={t('JJ/MM/AAAA')} placeholderTextColor={colors.clay} style={styles.input} keyboardType="number-pad" maxLength={10} />
        <Text style={styles.birthNote}>{t('Sert uniquement à filtrer les contenus sensibles selon ton âge.')}</Text>

        {err && <Text style={styles.err}>{err}</Text>}

        <View style={{ height: spacing.xl }} />
        <PrimaryButton testID="btn-signup" title={t('Créer mon compte')} onPress={submit} loading={loading} disabled={!pseudo || !email || password.length < 6 || !birthIso} />
        <GhostButton testID="btn-goto-login" title={t("J'ai déjà un compte")} onPress={() => router.push('/(auth)/login')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  c: { paddingHorizontal: spacing.xl, gap: spacing.xs },
  back: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center', marginBottom: spacing.md, marginLeft: -8 },
  title: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.espresso },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, marginTop: spacing.xs },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.xs },
  input: { height: 52, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, backgroundColor: colors.creme },
  birthNote: { fontFamily: fonts.body, fontSize: 11, color: colors.clay, marginTop: 6, lineHeight: 15 },
  err: { color: colors.espresso, fontFamily: fonts.body, marginTop: spacing.md },
});
