import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, fonts, radius, spacing } from '@/src/theme';
import { useAuth } from '@/src/auth';
import { api } from '@/src/api';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [premium, setPremium] = useState<{ is_premium: boolean; plan?: string | null; captures_used: number; captures_limit: number } | null>(null);
  const [stats, setStats] = useState({ books: 0, quotes: 0, boards: 0 });

  useFocusEffect(React.useCallback(() => {
    (async () => {
      try { setPremium(await api('/premium/status')); } catch {}
      try {
        const [b, q, t] = await Promise.all([
          api<{ books: any[] }>('/books'),
          api<{ quotes: any[] }>('/quotes'),
          api<{ boards: any[] }>('/boards'),
        ]);
        setStats({ books: b.books.length, quotes: q.quotes.length, boards: t.boards.length });
      } catch {}
    })();
  }, []));
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.glacier }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 80 }} testID="screen-profile">
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.pseudo?.[0] || 'M').toUpperCase()}</Text></View>
        <Text style={styles.pseudo}>{user?.pseudo}</Text>
        <Text style={styles.handle}>@{user?.handle}</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statNum}>{stats.books}</Text><Text style={styles.statLbl}>livres</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{stats.quotes}</Text><Text style={styles.statLbl}>citations</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{stats.boards}</Text><Text style={styles.statLbl}>tableaux</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{user?.themes?.length || 0}</Text><Text style={styles.statLbl}>thèmes</Text></View>
      </View>

      <View style={styles.premium}>
        {premium?.is_premium ? (
          <>
            <Text style={styles.premiumTitle}>Premium actif</Text>
            <Text style={styles.premiumText}>Formule {premium.plan === 'annuel' ? 'annuelle' : 'mensuelle'} — captures IA illimitées, exports débloqués, sans filigrane.</Text>
            <Pressable testID="btn-premium" onPress={() => router.push('/premium')} style={styles.premiumBtn}><Text style={styles.premiumBtnText}>Gérer mon abonnement</Text></Pressable>
          </>
        ) : (
          <>
            <Text style={styles.premiumTitle}>Manent Premium</Text>
            <Text style={styles.premiumText}>Captures IA illimitées, export PDF, quote cards sans filigrane.</Text>
            {premium ? <Text style={styles.premiumUsage}>Captures IA ce mois-ci : {premium.captures_used}/{premium.captures_limit}</Text> : null}
            <Text style={styles.premiumPrice}>3,99 €/mois  ·  34,99 €/an (−27%)</Text>
            <Pressable testID="btn-premium" onPress={() => router.push('/premium')} style={styles.premiumBtn}><Text style={styles.premiumBtnText}>Découvrir Premium</Text></Pressable>
          </>
        )}
      </View>

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, marginTop: spacing.lg }}>
        <Pressable testID="row-settings" style={styles.row}><Feather name="settings" size={18} color={colors.espresso} /><Text style={styles.rowLabel}>Paramètres</Text></Pressable>
        <Pressable testID="row-signout" onPress={signOut} style={styles.row}><Feather name="log-out" size={18} color={colors.espresso} /><Text style={styles.rowLabel}>Se déconnecter</Text></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.xs },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarText: { fontFamily: fonts.displayMedium, fontSize: 34, color: colors.espresso },
  pseudo: { fontFamily: fonts.displayMedium, fontSize: 26, color: colors.espresso },
  handle: { fontFamily: fonts.body, fontSize: 13, color: colors.clay },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, marginTop: spacing.xl, gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.creme, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.borderSoft },
  statNum: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  statLbl: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },
  premium: { margin: spacing.xl, padding: spacing.lg, backgroundColor: colors.bisque, borderRadius: radius.md },
  premiumTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso },
  premiumText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso, marginTop: spacing.xs, lineHeight: 20 },
  premiumUsage: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.sm },
  premiumPrice: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.sm },
  premiumBtn: { marginTop: spacing.md, alignSelf: 'flex-start', paddingHorizontal: 18, height: 42, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  premiumBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme, letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, backgroundColor: colors.creme, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.borderSoft },
  rowLabel: { fontFamily: fonts.body, fontSize: 15, color: colors.espresso },
});
