import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useAuth } from '@/src/auth';
import { api, getCachedToken } from '@/src/api';
import * as ImagePicker from 'expo-image-picker';
import { InfoTooltip } from '@/src/components/InfoTooltip';
import { useT } from '@/src/i18n';

export default function Profile() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, updateUser } = useAuth();

  // Photo de profil : galerie -> upload -> PATCH /users/me
  const pickAvatar = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const form = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(asset.uri)).blob();
        form.append('file', new File([blob], 'avatar.jpg', { type: blob.type || 'image/jpeg' }));
      } else {
        form.append('file', { uri: asset.uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
      }
      const r = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getCachedToken()}` },
        body: form,
      });
      const j = await r.json();
      if (j.url) await updateUser({ picture: j.url });
    } catch {}
  };
  const [premium, setPremium] = useState<{ is_premium: boolean; plan?: string | null; captures_used: number; captures_limit: number } | null>(null);
  const [stats, setStats] = useState({ books: 0, quotes: 0, boards: 0 });
  const [clubSummary, setClubSummary] = useState<{ joined: number; reading: number; finished: number } | null>(null);
  const [reading, setReading] = useState<any>(null);
  const [badges, setBadges] = useState<{ id: string; title: string; desc: string; icon: string; earned: boolean }[]>([]);
  const [goalModal, setGoalModal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  useFocusEffect(React.useCallback(() => {
    (async () => {
      try { setPremium(await api('/premium/status')); } catch {}
      try { setClubSummary(await api('/club/me/summary')); } catch {}
      try { setReading(await api('/stats/reading')); } catch {}
      try { const b = await api<{ badges: any[] }>('/badges'); setBadges(b.badges); } catch {}
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
      <View style={{ alignItems: 'flex-end', paddingHorizontal: spacing.xl }}>
        <InfoTooltip
          testID="info-profile"
          title={t('Ton profil')}
          text={t("Ton espace personnel : tes statistiques de lecture, ta série de jours d'affilée, tes tableaux et tes thèmes. Tape sur ton avatar pour changer ta photo, et sur Paramètres pour régler la langue, le thème et la confidentialité.")}
        />
      </View>
      <View style={styles.header}>
        <Pressable testID="avatar-edit" onPress={pickAvatar} style={styles.avatar}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={{ width: 80, height: 80, borderRadius: 40 }} />
          ) : (
            <Text style={styles.avatarText}>{(user?.pseudo?.[0] || 'M').toUpperCase()}</Text>
          )}
          <View style={styles.avatarBadge}><Feather name="camera" size={11} color={colors.creme} /></View>
        </Pressable>
        <Text style={styles.pseudo}>{user?.pseudo}</Text>
        <Text style={styles.handle}>@{user?.handle}</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statNum}>{stats.books}</Text><Text style={styles.statLbl} numberOfLines={1} adjustsFontSizeToFit>{t('livres')}</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{stats.quotes}</Text><Text style={styles.statLbl} numberOfLines={1} adjustsFontSizeToFit>{t('citations')}</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{stats.boards}</Text><Text style={styles.statLbl} numberOfLines={1} adjustsFontSizeToFit>{t('tableaux')}</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{user?.themes?.length || 0}</Text><Text style={styles.statLbl} numberOfLines={1} adjustsFontSizeToFit>{t('sujets')}</Text></View>
      </View>

      {clubSummary && clubSummary.joined > 0 && (
        <Pressable testID="profile-club-card" onPress={() => router.push('/(tabs)/community')} style={styles.clubCard}>
          <View style={styles.clubIcon}><Feather name="users" size={16} color={colors.creme} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.readingTitle}>{t('Club de lecture')}</Text>
            <Text style={styles.readingSub}>
              {t(clubSummary.joined > 1 ? '{n} lectures rejointes' : '{n} lecture rejointe', { n: clubSummary.joined })}
              {clubSummary.finished > 0 ? ` · ${t(clubSummary.finished > 1 ? '{n} terminées' : '{n} terminée', { n: clubSummary.finished })}` : ''}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.clay} />
        </Pressable>
      )}

      {reading && (
        <View style={styles.readingCard} testID="reading-stats">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={styles.streakBox}>
              <Text style={styles.streakNum}>{reading.streak}</Text>
              <Text style={styles.streakLbl}>{t(reading.streak > 1 ? 'jours d’affilée' : 'jour d’affilée')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.readingTitle}>{t('Ta semaine de lecture')}</Text>
              <Text style={styles.readingSub}>{`${reading.week_pages} ${t(reading.week_pages > 1 ? 'pages lues' : 'page lue')} · ${reading.active_days_month} ${t(reading.active_days_month > 1 ? 'jours actifs' : 'jour actif')} ${t('ce mois-ci')}`}</Text>
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

      {reading && (
        <View style={styles.goalCard} testID="goal-card">
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={styles.readingTitle}>{t('Objectif {year}', { year: reading.year })}</Text>
            <Pressable testID="goal-edit" onPress={() => { setGoalInput(reading.yearly_goal ? String(reading.yearly_goal) : ''); setGoalModal(true); }} hitSlop={8}>
              <Text style={styles.goalEdit}>{reading.yearly_goal ? t('Modifier') : t('Fixer un objectif')}</Text>
            </Pressable>
          </View>
          {reading.yearly_goal ? (
            <>
              <View style={styles.goalBar}>
                <View style={[styles.goalFill, { width: `${Math.min(100, Math.round((reading.books_year / reading.yearly_goal) * 100))}%` }]} />
              </View>
              <Text style={styles.goalText} testID="goal-text">
                {t('{done} / {goal} livres terminés', { done: reading.books_year, goal: reading.yearly_goal })}
                {reading.books_year >= reading.yearly_goal ? t('  ·  Objectif atteint.') : ''}
              </Text>
            </>
          ) : (
            <Text style={styles.readingSub}>{t('Combien de livres cette année ? Fixe ton cap, la jauge suivra.')}</Text>
          )}
        </View>
      )}

      {badges.length > 0 && (
        <View style={{ marginTop: spacing.md }} testID="badges-section">
          <Text style={styles.badgesLabel}>{t('Badges · {earned}/{total}', { earned: badges.filter(b => b.earned).length, total: badges.length })}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }} testID="badges-row">
            {[...badges].sort((a, b) => Number(b.earned) - Number(a.earned)).map(b => (
              <View key={b.id} testID={`badge-${b.id}`} style={[styles.badge, !b.earned && styles.badgeLocked]}>
                <View style={[styles.badgeIcon, b.earned && { backgroundColor: colors.chambray }]}>
                  <Feather name={b.icon as any} size={18} color={b.earned ? '#F5EDE4' : colors.clay} />
                </View>
                <Text style={[styles.badgeTitle, !b.earned && { color: colors.clay }]} numberOfLines={1}>{b.title}</Text>
                <Text style={styles.badgeDesc} numberOfLines={2}>{b.desc}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.premium}>
        {premium?.is_premium ? (
          <>
            <Text style={styles.premiumTitle}>{t('Premium actif')}</Text>
            <Text style={styles.premiumText}>{t('Formule {plan} — captures IA illimitées, exports débloqués.', { plan: t(premium.plan === 'annuel' ? 'annuelle' : 'mensuelle') })}</Text>
            <Pressable testID="btn-premium" onPress={() => router.push('/premium')} style={styles.premiumBtn}><Text style={styles.premiumBtnText}>{t('Gérer mon abonnement')}</Text></Pressable>
          </>
        ) : (
          <>
            <Text style={styles.premiumTitle}>Manent Premium</Text>
            <Text style={styles.premiumText}>{t('Captures IA illimitées, export PDF, quote cards sans filigrane.')}</Text>
            {premium ? <Text style={styles.premiumUsage}>{t('Captures IA ce mois-ci : {used}/{limit}', { used: premium.captures_used, limit: premium.captures_limit })}</Text> : null}
            <Pressable testID="btn-premium" onPress={() => router.push('/premium')} style={styles.premiumBtn}><Text style={styles.premiumBtnText}>{t('Découvrir Premium')}</Text></Pressable>
          </>
        )}
      </View>

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, marginTop: spacing.lg }}>
        <Pressable testID="row-quotes" onPress={() => router.push('/quotes')} style={styles.row}><Feather name="feather" size={18} color={colors.espresso} /><Text style={[styles.rowLabel, { flex: 1 }]}>{t('Mes citations')}</Text></Pressable>
        {(user as any)?.is_admin && (
          <Pressable testID="row-admin" onPress={() => router.push('/admin')} style={styles.row}><Feather name="shield" size={18} color={colors.espresso} /><Text style={[styles.rowLabel, { flex: 1 }]}>{t('Dashboard admin')}</Text></Pressable>
        )}
        <Pressable testID="row-carnet" onPress={() => router.push('/carnet')} style={styles.row}><Feather name="book-open" size={18} color={colors.espresso} /><Text style={[styles.rowLabel, { flex: 1 }]}>{t('Carnet de lecture')}</Text><View style={styles.premiumTag}><Text style={styles.premiumTagText}>PREMIUM</Text></View></Pressable>
        <Pressable testID="row-settings" onPress={() => router.push('/settings')} style={styles.row}><Feather name="settings" size={18} color={colors.espresso} /><Text style={styles.rowLabel}>{t('Paramètres')}</Text></Pressable>
        <Pressable testID="row-signout" onPress={signOut} style={styles.row}><Feather name="log-out" size={18} color={colors.espresso} /><Text style={styles.rowLabel}>{t('Se déconnecter')}</Text></Pressable>
      </View>

      <Modal visible={goalModal} transparent animationType="slide" onRequestClose={() => setGoalModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('Objectif de l’année')}</Text>
            <Text style={styles.readingSub}>{t('Un cap réaliste vaut mieux qu’un record : combien de livres cette année ?')}</Text>
            <TextInput
              testID="goal-input"
              value={goalInput} onChangeText={setGoalInput}
              keyboardType="number-pad"
              placeholder="12"
              placeholderTextColor={colors.clay}
              style={styles.goalInput}
              autoFocus
            />
            <Pressable
              testID="goal-save"
              disabled={!goalInput || parseInt(goalInput, 10) < 1}
              onPress={async () => {
                const g = parseInt(goalInput, 10);
                if (!g || g < 1) return;
                await api('/me/goal', { method: 'PATCH', body: JSON.stringify({ yearly_goal: g }) });
                setReading((r: any) => ({ ...r, yearly_goal: g }));
                setGoalModal(false);
              }}
              style={[styles.goalSaveBtn, (!goalInput || parseInt(goalInput, 10) < 1) && { opacity: 0.5 }]}
            >
              <Text style={styles.goalSaveText}>{t('Enregistrer')}</Text>
            </Pressable>
            <Pressable testID="goal-cancel" onPress={() => setGoalModal(false)} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <Text style={styles.goalEdit}>{t('Annuler')}</Text>
            </Pressable>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.xs },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.glacier },
  avatarText: { fontFamily: fonts.displayMedium, fontSize: 34, color: colors.espresso },
  pseudo: { fontFamily: fonts.displayMedium, fontSize: 26, color: colors.espresso },
  handle: { fontFamily: fonts.body, fontSize: 13, color: colors.clay },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, marginTop: spacing.xl, gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.creme, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: colors.borderSoft },
  statNum: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  statLbl: { fontFamily: fonts.bodyMedium, fontSize: 8.5, color: colors.clay, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },
  readingCard: { marginHorizontal: spacing.xl, marginTop: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  clubCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.xl, marginTop: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  clubIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
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
  badgesLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  badge: { width: 128, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, alignItems: 'center' },
  badgeLocked: { opacity: 0.55 },
  badgeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glacier, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  badgeTitle: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.espresso, textAlign: 'center' },
  badgeDesc: { fontFamily: fonts.body, fontSize: 10.5, color: colors.clay, textAlign: 'center', marginTop: 2, lineHeight: 14 },
  goalCard: { marginHorizontal: spacing.xl, marginTop: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  goalEdit: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, textDecorationLine: 'underline' },
  goalBar: { height: 8, backgroundColor: colors.glacier, borderRadius: 4, overflow: 'hidden', marginTop: spacing.sm },
  goalFill: { height: 8, backgroundColor: colors.chambray },
  goalText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.glacier, padding: spacing.xl, paddingBottom: spacing.xxl, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, marginBottom: spacing.xs },
  goalInput: { height: 56, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, backgroundColor: colors.creme, marginTop: spacing.md, textAlign: 'center' },
  goalSaveBtn: { height: 52, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  goalSaveText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.creme },
  premium: { margin: spacing.xl, padding: spacing.lg, backgroundColor: colors.bisque, borderRadius: radius.md },
  premiumTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso },
  premiumText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso, marginTop: spacing.xs, lineHeight: 20 },
  premiumUsage: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.sm },
  premiumPrice: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.sm },
  premiumBtn: { marginTop: spacing.md, alignSelf: 'flex-start', paddingHorizontal: 18, height: 42, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  premiumBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme, letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, backgroundColor: colors.creme, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.borderSoft },
  premiumTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.bisque },
  premiumTagText: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.espresso, letterSpacing: 1.5 },
  rowLabel: { fontFamily: fonts.body, fontSize: 15, color: colors.espresso },
});
