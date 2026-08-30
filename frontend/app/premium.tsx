import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radius, spacing } from '@/src/theme';
import { Monogram } from '@/src/components/Wordmark';
import { api } from '@/src/api';

type Status = { is_premium: boolean; plan?: string | null; captures_used: number; captures_limit: number };

const FEATURES = [
  'Captures IA illimitées (10/mois en gratuit)',
  'Export PDF de tes fiches d\u2019études',
  'Enregistrement des quote cards dans ta galerie',
  'Quote cards sans filigrane',
  'Soutien à une app calme, sans publicité',
];

export default function Premium() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [plan, setPlan] = useState<'mensuel' | 'annuel'>('annuel');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setStatus(await api<Status>('/premium/status')); } catch {}
  };
  useEffect(() => { load(); }, []);

  const activate = async () => {
    setBusy(true);
    try {
      const r = await api<Status>('/premium/activate', { method: 'POST', body: JSON.stringify({ plan }) });
      setStatus(r);
    } finally { setBusy(false); }
  };
  const deactivate = async () => {
    setBusy(true);
    try {
      const r = await api<Status>('/premium/deactivate', { method: 'POST' });
      setStatus(r);
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.espresso }} testID="screen-premium">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="premium-back" style={styles.iconBtn}>
          <Feather name="x" size={22} color={colors.creme} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <Monogram size={64} />
          <Text style={styles.title}>Manent Premium</Text>
          <Text style={styles.baseline}>Ce que tes lectures te laissent, sans limite.</Text>
        </View>

        {status?.is_premium ? (
          <View style={styles.activeBox} testID="premium-active">
            <Feather name="check-circle" size={22} color={colors.chambray} />
            <Text style={styles.activeTitle}>Tu es Premium</Text>
            <Text style={styles.activeSub}>Formule {status.plan === 'annuel' ? 'annuelle' : 'mensuelle'} — captures IA illimitées, exports débloqués.</Text>
            <Pressable testID="btn-premium-deactivate" onPress={deactivate} disabled={busy} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>Désactiver (test)</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.features}>
              {FEATURES.map(f => (
                <View key={f} style={styles.featureRow}>
                  <Feather name="check" size={16} color={colors.chambray} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {status && !status.is_premium ? (
              <Text style={styles.usage}>Ce mois-ci : {status.captures_used}/{status.captures_limit} captures IA utilisées</Text>
            ) : null}

            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              <Pressable testID="plan-annuel" onPress={() => setPlan('annuel')} style={[styles.plan, plan === 'annuel' && styles.planActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>Annuel</Text>
                  <Text style={styles.planPrice}>34,99 € / an — soit 2,92 €/mois</Text>
                </View>
                <View style={styles.badge}><Text style={styles.badgeText}>−27%</Text></View>
              </Pressable>
              <Pressable testID="plan-mensuel" onPress={() => setPlan('mensuel')} style={[styles.plan, plan === 'mensuel' && styles.planActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>Mensuel</Text>
                  <Text style={styles.planPrice}>3,99 € / mois, sans engagement</Text>
                </View>
              </Pressable>
            </View>

            <Pressable testID="btn-premium-activate" onPress={activate} disabled={busy} style={styles.cta}>
              {busy ? <ActivityIndicator color={colors.creme} /> : <Text style={styles.ctaText}>Activer Premium</Text>}
            </Pressable>
            <Text style={styles.note}>Paiement in-app bientôt disponible — pendant la bêta, l&rsquo;activation est immédiate et gratuite.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.displayMedium, fontSize: 34, color: colors.creme, marginTop: spacing.md },
  baseline: { fontFamily: fonts.display, fontSize: 16, color: colors.bisque, marginTop: 4, textAlign: 'center' },
  features: { backgroundColor: colors.darkCard, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  featureText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.creme, lineHeight: 20 },
  usage: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.bisque, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', marginTop: spacing.lg },
  plan: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.clay, backgroundColor: colors.darkCard },
  planActive: { borderColor: colors.chambray, backgroundColor: 'rgba(121,163,195,0.14)' },
  planName: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.creme },
  planPrice: { fontFamily: fonts.body, fontSize: 13, color: colors.bisque, marginTop: 2 },
  badge: { backgroundColor: colors.chambray, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.creme },
  cta: { height: 54, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  ctaText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.creme, letterSpacing: 0.3 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },
  activeBox: { alignItems: 'center', backgroundColor: colors.darkCard, borderRadius: radius.md, padding: spacing.xl, gap: spacing.sm },
  activeTitle: { fontFamily: fonts.displayMedium, fontSize: 26, color: colors.creme },
  activeSub: { fontFamily: fonts.body, fontSize: 14, color: colors.bisque, textAlign: 'center', lineHeight: 20 },
  ghostBtn: { marginTop: spacing.md, height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.clay, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.bisque },
});
