import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles, useScheme, useToggleScheme } from '@/src/themeCtx';
import { useAuth } from '@/src/auth';
import { api } from '@/src/api';

export default function Profile() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const scheme = useScheme();
  const toggle = useToggleScheme();
  const [premium, setPremium] = useState<{ is_premium: boolean; plan?: string | null; captures_used: number; captures_limit: number } | null>(null);
  const [stats, setStats] = useState({ books: 0, quotes: 0, boards: 0 });
  const [reading, setReading] = useState<{ streak: number; week: { label: string; pages: number; active: boolean }[]; week_pages: number; active_days_month: number } | null>(null);

  useFocusEffect(React.useCallback(() => {
    (async () => {
      try { setPremium(await api('/premium/status')); } catch {}
      try { setReading(await api('/stats/reading')); } catch {}
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

      {reading && (
        <View style={styles.readingCard} testID="reading-stats">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={styles.streakBox}>
              <Text style={styles.streakNum}>{reading.streak}</Text>
              <Text style={styles.streakLbl}>jour{reading.streak > 1 ? 's' : ''} d&rsquo;affilée</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.readingTitle}>Ta semaine de lecture</Text>
              <Text style={styles.readingSub}>{reading.week_pages} page{reading.week_pages > 1 ? 's' : ''} lue{reading.week_pages > 1 ? 's' : ''} · {reading.active_days_month} jour{reading.active_days_month > 1 ? 's' : ''} actif{reading.active_days_month > 1 ? 's' : ''} ce mois-ci</Text>
            </View>
          </View>
          <View style={styles.weekRow}>
            {reading.week.map((d, i) => {
              const max = Math.max(1, ...reading.week.map(x => x.pages));
              const h = d.pages > 0 ? Math.max(8, Math.round((d.pages / max) * 44)) : (d.active ? 8 : 3);
              return (
                <View key={i} style={styles.dayCol}>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { height: h }, d.active && { backgroundColor: colors.chambray }]} />
                  </View>
                  <Text style={styles.dayLbl}>{d.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

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
        <Pressable testID="row-darkmode" onPress={toggle} style={styles.row}>
          <Feather name={scheme === 'dark' ? 'sun' : 'moon'} size={18} color={colors.espresso} />
          <Text style={[styles.rowLabel, { flex: 1 }]}>Mode sombre</Text>
          <View style={[styles.switch, scheme === 'dark' && { backgroundColor: colors.chambray }]}>
            <View style={[styles.knob, scheme === 'dark' && { alignSelf: 'flex-end' }]} />
          </View>
        </Pressable>
        <Pressable testID="row-settings" style={styles.row}><Feather name="settings" size={18} color={colors.espresso} /><Text style={styles.rowLabel}>Paramètres</Text></Pressable>
        <Pressable testID="row-signout" onPress={signOut} style={styles.row}><Feather name="log-out" size={18} color={colors.espresso} /><Text style={styles.rowLabel}>Se déconnecter</Text></Pressable>
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.xs },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarText: { fontFamily: fonts.displayMedium, fontSize: 34, color: colors.espresso },
  pseudo: { fontFamily: fonts.displayMedium, fontSize: 26, color: colors.espresso },
  handle: { fontFamily: fonts.body, fontSize: 13, color: colors.clay },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, marginTop: spacing.xl, gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.creme, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.borderSoft },
  statNum: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  statLbl: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },
  readingCard: { marginHorizontal: spacing.xl, marginTop: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  streakBox: { width: 84, alignItems: 'center', paddingVertical: spacing.sm, backgroundColor: colors.bisque, borderRadius: radius.md },
  streakNum: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.espresso, lineHeight: 34 },
  streakLbl: { fontFamily: fonts.bodyMedium, fontSize: 8.5, color: colors.clay, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' },
  readingTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso },
  readingSub: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 2, lineHeight: 17 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingHorizontal: spacing.xs },
  dayCol: { alignItems: 'center', gap: 4, flex: 1 },
  barTrack: { height: 48, justifyContent: 'flex-end' },
  bar: { width: 14, borderRadius: 3, backgroundColor: colors.borderSoft },
  dayLbl: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.clay, letterSpacing: 0.5, textTransform: 'uppercase' },
  premium: { margin: spacing.xl, padding: spacing.lg, backgroundColor: colors.bisque, borderRadius: radius.md },
  premiumTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso },
  premiumText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso, marginTop: spacing.xs, lineHeight: 20 },
  premiumUsage: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.sm },
  premiumPrice: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.sm },
  premiumBtn: { marginTop: spacing.md, alignSelf: 'flex-start', paddingHorizontal: 18, height: 42, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  premiumBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme, letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, backgroundColor: colors.creme, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.borderSoft },
  rowLabel: { fontFamily: fonts.body, fontSize: 15, color: colors.espresso },
  switch: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.borderSoft, padding: 3, justifyContent: 'center' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5EDE4', alignSelf: 'flex-start' },
});
