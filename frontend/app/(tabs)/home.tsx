import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Modal, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import { Wordmark } from '@/src/components/Wordmark';
import { BookCover } from '@/src/components/BookCover';
import ManentLoader from '@/src/components/ManentLoader';
import { ErrorState } from '@/src/components/ErrorState';
import { InfoTooltip } from '@/src/components/InfoTooltip';
import { WelcomeTour } from '@/src/components/WelcomeTour';
import { BottomSheet } from '@/src/components/BottomSheet';
import { useT, useLang } from '@/src/i18n';
import { dayLabel, JournalHome, moodOf, useOutbox } from '@/src/journal';

const BIRTH_PROMPT_KEY = 'manent_birth_prompted';

// Accueil recentré : le livre en cours, « Écrire mon entrée du jour » (1 tap), la dernière entrée, une série douce.
// La découverte (fil, Pour toi, collections, clubs) vit dans l'onglet Découvrir.
export default function Home() {
  const t = useT();
  const lang = useLang();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { pending, flush } = useOutbox();
  const [home, setHome] = useState<JournalHome | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [nextUp, setNextUp] = useState<any>(null);
  const [reading, setReading] = useState<any>(null);
  const [goalSheet, setGoalSheet] = useState(false);
  const [unread, setUnread] = useState(0);
  const [goalInput, setGoalInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [birthModal, setBirthModal] = useState(false);
  const [birth, setBirth] = useState('');
  const [birthSaving, setBirthSaving] = useState(false);

  const load = useCallback(async () => {
    const [h, d, r, n] = await Promise.allSettled([api<JournalHome>('/journal/home'), api<any>('/home/discover'), api<any>('/stats/reading'), api<{ unread: number }>('/notifications/badge')]);
    if (h.status === 'fulfilled') { setHome(h.value); setLoadError(false); } else setLoadError(true);
    if (d.status === 'fulfilled') setNextUp(d.value?.next_up || null);
    if (r.status === 'fulfilled') setReading(r.value);
    if (n.status === 'fulfilled') setUnread(n.value.unread || 0);
  }, []);
  useFocusEffect(useCallback(() => { flush().then(load); }, [load, flush]));
  const onRefresh = async () => { setRefreshing(true); await flush(); await load(); setRefreshing(false); };

  // Comptes existants sans date de naissance : demandée une seule fois
  useEffect(() => {
    (async () => {
      if (!user || (user as any).birthdate) return;
      const prompted = await AsyncStorage.getItem(BIRTH_PROMPT_KEY).catch(() => null);
      if (!prompted) setBirthModal(true);
    })();
  }, [user]);
  const onBirthChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setBirth(out);
  };
  const birthIso = (() => {
    const m = birth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [, d, mo, y] = m;
    const dt = new Date(`${y}-${mo}-${d}T00:00:00Z`);
    if (isNaN(dt.getTime()) || dt.getUTCDate() !== parseInt(d, 10) || dt > new Date() || parseInt(y, 10) < 1900) return null;
    return `${y}-${mo}-${d}`;
  })();
  const saveBirth = async () => {
    if (!birthIso) return;
    setBirthSaving(true);
    try {
      await api('/me/settings', { method: 'PATCH', body: JSON.stringify({ birthdate: birthIso }) });
      await AsyncStorage.setItem(BIRTH_PROMPT_KEY, '1').catch(() => {});
      await refresh();
      setBirthModal(false);
    } finally { setBirthSaving(false); }
  };
  const skipBirth = async () => { await AsyncStorage.setItem(BIRTH_PROMPT_KEY, '1').catch(() => {}); setBirthModal(false); };

  const book = home?.current_book;
  const entry = home?.latest_entry;
  const mood = moodOf(entry?.mood);
  const firstName = (user?.pseudo || '').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 5 ? t('Bonne nuit') : hour < 12 ? t('Bonjour') : hour < 18 ? t('Bon après-midi') : t('Bonsoir');
  const streakText = (() => {
    if (!home) return '';
    if (home.streak >= 2) return t('{n} jours de lecture d’affilée.', { n: home.streak });
    if (home.active_days_week >= 2) return t('{n} jours de lecture cette semaine.', { n: home.active_days_week });
    if (home.active_days_week === 1) return t('Un jour de lecture cette semaine. Chaque page compte.');
    return t('Une page suffit pour commencer aujourd’hui.');
  })();
  const writeEntry = () => router.push({ pathname: '/journal/new', params: book ? { book_id: book.book_id, from: 'home' } : { from: 'home' } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-home">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Wordmark size={19} variant="horizontal" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable testID="home-search" onPress={() => router.push('/search')} accessibilityRole="button" accessibilityLabel={t('Rechercher')} style={styles.iconBtn} hitSlop={6}>
            <Feather name="search" size={19} color={colors.espresso} />
          </Pressable>
          <Pressable testID="home-notifications" onPress={() => router.push('/inbox')} accessibilityRole="button" accessibilityLabel={unread > 0 ? t('{n} notifications non lues', { n: unread }) : t('Notifications')} style={styles.iconBtn} hitSlop={6}>
            <Feather name="bell" size={19} color={colors.espresso} />
            {unread > 0 && <View style={styles.bellBadge} testID="home-notifications-badge"><Text style={styles.bellBadgeText}>{unread > 99 ? '99+' : unread}</Text></View>}
          </Pressable>
          <InfoTooltip
            testID="info-home"
            title={t('Ton journal de lecture')}
            text={t('Manent garde une trace de tout ce que tu lis et ressens. Chaque jour : ton livre en cours, une entrée de journal en un geste, ta dernière note. Tes citations sont dans Journal ; la découverte, le fil des lectrices et les clubs dans Découvrir.')}
          />
        </View>
      </View>

      {!home ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{loadError ? <ErrorState onRetry={load} testID="home-error" /> : <ManentLoader size={56} />}</View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: insets.bottom + 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.chambray} />}>
          <Text style={styles.greeting}>{firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}</Text>
          <Text style={styles.streak} testID="home-streak">{streakText}</Text>
          {loadError && <View style={{ marginBottom: spacing.md }}><ErrorState compact onRetry={load} testID="home-error" /></View>}

          {pending > 0 && (
            <Pressable testID="home-outbox" onPress={() => flush().then(load)} style={styles.outbox}>
              <Feather name="cloud-off" size={14} color={colors.espresso} />
              <Text style={styles.outboxText}>{t(pending > 1 ? '{n} entrées attendent le réseau.' : 'Une entrée attend le réseau.', { n: pending })}</Text>
              <Text style={styles.outboxAction}>{t('Réessayer')}</Text>
            </Pressable>
          )}

          {/* Livre en cours */}
          {book ? (
            <Pressable testID="home-current-book" onPress={() => router.push({ pathname: '/book/[id]', params: { id: book.book_id } })} style={({ pressed }) => [styles.bookCard, pressed && { opacity: 0.92 }]}>
              <BookCover uri={book.cover || undefined} title={book.title} width={92} height={134} radius={8} initialSize={30} />
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <View>
                  <Text style={styles.kicker}>{t('En cours')}</Text>
                  <Text style={styles.bookTitle} numberOfLines={3}>{book.title}</Text>
                  {!!book.author && <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>}
                </View>
                <View>
                  {book.progress?.pct != null ? (
                    <>
                      <View style={styles.barBg}><View style={[styles.barFg, { width: `${Math.max(2, Math.min(100, book.progress.pct))}%` }]} /></View>
                      <Text style={styles.progressText}>{t('{p} % · {u} {c} sur {n}', { p: book.progress.pct, u: book.progress.unit, c: book.progress.current, n: book.progress.total ?? 0 })}</Text>
                    </>
                  ) : (
                    <Text style={styles.progressText}>{book.progress?.current ? t('{u} {c}', { u: book.progress.unit === 'chapitre' ? t('Chapitre') : t('Page'), c: book.progress.current }) : t('Indique le nombre de pages pour suivre ta progression.')}</Text>
                  )}
                  {home.books_in_progress > 1 && <Text style={styles.moreBooks}>{t('+ {n} autres en cours', { n: home.books_in_progress - 1 })}</Text>}
                </View>
              </View>
            </Pressable>
          ) : (
            <View style={styles.bookCard} testID="home-no-book">
              <View style={styles.emptyCover}><Feather name="book-open" size={26} color={colors.chambray} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>{t('Aucun livre en cours')}</Text>
                <Text style={styles.bookTitle}>{nextUp ? t('Commencer « {t} » ?', { t: nextUp.title }) : t('Quel livre lis-tu en ce moment ?')}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                  {nextUp && (
                    <Pressable testID="home-start-next" onPress={() => router.push({ pathname: '/book/[id]', params: { id: nextUp.book_id } })} style={styles.smallBtn}>
                      <Text style={styles.smallBtnText}>{t('Commencer')}</Text>
                    </Pressable>
                  )}
                  <Pressable testID="home-add-book" onPress={() => router.push('/book/add')} style={styles.smallGhost}>
                    <Feather name="plus" size={13} color={colors.espresso} /><Text style={styles.smallGhostText}>{t('Ajouter un livre')}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Écrire */}
          <Pressable testID="home-write" onPress={writeEntry} style={({ pressed }) => [styles.writeBtn, pressed && { opacity: 0.9 }]}>
            <View style={styles.writeIcon}><Feather name="feather" size={18} color={colors.chambray} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.writeTitle}>{t('Écrire mon entrée du jour')}</Text>
              <Text style={styles.writeSub} numberOfLines={2}>{home.prompt?.text || t('Une phrase, une humeur, une page : ça suffit.')}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.creme} />
          </Pressable>
          {home.quota.limit != null && (
            <Text style={styles.quota} testID="home-quota">
              {home.quota.remaining === 0 ? t('Tes trois entrées de la semaine sont écrites. Premium pour continuer.') : t(home.quota.remaining === 1 ? 'Encore une entrée cette semaine.' : 'Encore {n} entrées cette semaine.', { n: home.quota.remaining ?? 0 })}
            </Text>
          )}

          {/* Dernière entrée */}
          <Text style={styles.sectionLabel}>{t('Dernière entrée')}</Text>
          {entry ? (
            <Pressable testID="home-last-entry" onPress={() => router.push({ pathname: '/journal/[id]', params: { id: entry.entry_id } })} style={styles.entryCard}>
              <View style={styles.entryMeta}>
                {mood && <View style={[styles.moodDot, { backgroundColor: mood.color }]} />}
                <Text style={styles.entryDate}>{dayLabel(entry.date, lang)}{mood ? ` · ${t(mood.label)}` : ''}{entry.page ? ` · p. ${entry.page}` : ''}</Text>
              </View>
              {!!entry.book?.title && entry.book.book_id !== book?.book_id && <Text style={styles.entryBook} numberOfLines={1}>{entry.book.title}</Text>}
              {entry.content ? <Text style={styles.entryText} numberOfLines={4}>{entry.content}</Text>
                : entry.quotes?.[0] ? <Text style={styles.entryQuote} numberOfLines={3}>« {entry.quotes[0].text} »</Text>
                : <Text style={styles.entryText}>{t('Une humeur notée, sans mots.')}</Text>}
            </Pressable>
          ) : (
            <View style={styles.entryCard} testID="home-no-entry">
              <Text style={styles.entryText}>{t('Ton journal est encore vide. La première entrée est souvent la plus courte.')}</Text>
            </View>
          )}

          {/* Mon évolution : série, semaine, objectif de l'année, rétrospective (les compteurs d'inventaire restent au profil) */}
          {reading && (
            <>
              <Text style={styles.sectionLabel}>{t('Mon évolution')}</Text>
              <View style={styles.evoCard} testID="home-evolution">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={styles.streakBox}>
                    <Text style={styles.streakNum}>{reading.streak}</Text>
                    <Text style={styles.streakLbl}>{t(reading.streak > 1 ? 'jours d’affilée' : 'jour d’affilée')}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.evoTitle}>{t('Ta semaine de lecture')}</Text>
                    <Text style={styles.evoSub}>{`${reading.week_pages} ${t(reading.week_pages > 1 ? 'pages lues' : 'page lue')} · ${reading.active_days_month} ${t(reading.active_days_month > 1 ? 'jours actifs' : 'jour actif')} ${t('ce mois-ci')}`}</Text>
                  </View>
                </View>
                <View style={styles.weekRow} accessibilityLabel={t('Pages lues par jour cette semaine')}>
                  {(reading.week || []).map((d: any, i: number) => {
                    const max = Math.max(1, ...reading.week.map((x: any) => x.pages));
                    const h = d.pages > 0 ? Math.max(8, Math.round((d.pages / max) * 40)) : (d.active ? 8 : 3);
                    return (
                      <View key={i} style={styles.dayCol}>
                        <View style={styles.barTrack}><View style={[styles.bar, { height: h }, d.active && { backgroundColor: colors.chambray }]} /></View>
                        <Text style={styles.dayLbl}>{d.label}</Text>
                      </View>
                    );
                  })}
                </View>
                <Pressable testID="home-goal" onPress={() => { setGoalInput(reading.yearly_goal ? String(reading.yearly_goal) : ''); setGoalSheet(true); }} accessibilityRole="button" style={styles.goalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.evoSub}>{t('Objectif {year}', { year: reading.year })}{reading.yearly_goal ? ` · ${t('{done} / {goal} livres terminés', { done: reading.books_year, goal: reading.yearly_goal })}${reading.books_year >= reading.yearly_goal ? t('  ·  Objectif atteint.') : ''}` : ` · ${t('Fixer un objectif')}`}</Text>
                    {reading.yearly_goal ? <View style={styles.goalBar}><View style={[styles.goalFill, { width: `${Math.min(100, Math.round((reading.books_year / reading.yearly_goal) * 100))}%` }]} /></View> : null}
                  </View>
                  <Feather name="chevron-right" size={14} color={colors.clay} />
                </Pressable>
                <Pressable testID="home-retro" onPress={() => router.push({ pathname: '/journal/retrospective', params: { year: String(reading.year) } })} accessibilityRole="button" style={styles.retroRow}>
                  <Feather name="calendar" size={14} color={colors.chambray} />
                  <Text style={styles.retroText}>{t('Ma rétrospective {year}', { year: reading.year })}</Text>
                  <Feather name="chevron-right" size={14} color={colors.clay} />
                </Pressable>
              </View>
            </>
          )}

        </ScrollView>
      )}

      <BottomSheet visible={goalSheet} onClose={() => setGoalSheet(false)} title={t('Objectif de l’année')} subtitle={t('Un cap réaliste vaut mieux qu’un record : combien de livres cette année ?')} testID="sheet-goal" scroll={false}>
        <TextInput testID="goal-input" value={goalInput} onChangeText={v => setGoalInput(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="12" placeholderTextColor={colors.clay} style={styles.goalInput} autoFocus accessibilityLabel={t('Nombre de livres')} />
        <Pressable
          testID="goal-save"
          disabled={!goalInput || parseInt(goalInput, 10) < 1}
          accessibilityRole="button"
          onPress={async () => {
            const g = parseInt(goalInput, 10);
            if (!g || g < 1) return;
            try { await api('/me/goal', { method: 'PATCH', body: JSON.stringify({ yearly_goal: g }) }); setReading((r: any) => ({ ...r, yearly_goal: g })); setGoalSheet(false); } catch {}
          }}
          style={[styles.goalSaveBtn, (!goalInput || parseInt(goalInput, 10) < 1) && { opacity: 0.5 }]}
        >
          <Text style={styles.goalSaveText}>{t('Enregistrer')}</Text>
        </Pressable>
      </BottomSheet>

      <Modal visible={birthModal} transparent animationType="fade" onRequestClose={skipBirth}>
        <View style={styles.birthOverlay}>
          <View style={styles.birthModal} testID="birthdate-modal">
            <Text style={styles.birthTitle}>{t('Ta date de naissance')}</Text>
            <Text style={styles.birthSub}>{t('Elle sert uniquement à filtrer les contenus sensibles selon ton âge. Sans elle, ils resteront masqués.')}</Text>
            <TextInput testID="birthdate-input" value={birth} onChangeText={onBirthChange} placeholder={t('JJ/MM/AAAA')} placeholderTextColor={colors.clay} keyboardType="number-pad" maxLength={10} style={styles.birthInput} />
            <Pressable testID="birthdate-save" onPress={saveBirth} disabled={!birthIso || birthSaving} style={[styles.birthBtn, (!birthIso || birthSaving) && { opacity: 0.5 }]}>
              <Text style={styles.birthBtnText}>{t('Enregistrer')}</Text>
            </Pressable>
            <Pressable testID="birthdate-skip" onPress={skipBirth} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <Text style={styles.birthSkip}>{t('Plus tard')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {!birthModal && <WelcomeTour />}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: 4, right: 2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  bellBadgeText: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.creme },
  greeting: { fontFamily: fonts.displayMedium, fontSize: 28, color: colors.espresso },
  streak: { fontFamily: fonts.body, fontSize: 13.5, color: colors.clay, marginTop: 2, marginBottom: spacing.lg },
  outbox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  outboxText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.espresso },
  outboxAction: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.chambray },
  bookCard: { flexDirection: 'row', gap: spacing.lg, backgroundColor: colors.creme, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.lg },
  emptyCover: { width: 92, height: 134, borderRadius: 8, backgroundColor: colors.glacier, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.chambray, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 4 },
  bookTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, lineHeight: 27 },
  bookAuthor: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 3 },
  barBg: { height: 5, borderRadius: 3, backgroundColor: colors.glacier, overflow: 'hidden', marginTop: spacing.sm },
  barFg: { height: 5, borderRadius: 3, backgroundColor: colors.chambray },
  progressText: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 6 },
  moreBooks: { fontFamily: fonts.body, fontSize: 11, color: colors.chambray, marginTop: 3 },
  smallBtn: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.creme },
  smallGhost: { height: 34, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  smallGhostText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.espresso },
  writeBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.chambray, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  writeIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  writeTitle: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.creme },
  writeSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.creme, opacity: 0.85, marginTop: 2, lineHeight: 17 },
  quota: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, marginTop: 6, textAlign: 'center' },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  entryCard: { backgroundColor: colors.creme, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.lg },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  moodDot: { width: 10, height: 10, borderRadius: 5 },
  entryDate: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.clay, textTransform: 'capitalize' },
  entryBook: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.chambray, marginBottom: 4 },
  entryText: { fontFamily: fonts.body, fontSize: 14.5, color: colors.espresso, lineHeight: 22 },
  entryQuote: { fontFamily: fonts.display, fontSize: 17, color: colors.espresso, lineHeight: 24 },
  evoCard: { backgroundColor: colors.creme, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.lg },
  streakBox: { width: 76, alignItems: 'center', paddingVertical: spacing.sm, backgroundColor: colors.bisque, borderRadius: radius.md },
  streakNum: { fontFamily: fonts.displayMedium, fontSize: 28, color: colors.espresso, lineHeight: 32 },
  streakLbl: { fontFamily: fonts.bodyMedium, fontSize: 8.5, color: colors.clay, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' },
  evoTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso },
  evoSub: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 2, lineHeight: 17 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingHorizontal: spacing.xs },
  dayCol: { alignItems: 'center', gap: 4, flex: 1 },
  barTrack: { height: 40, justifyContent: 'flex-end' },
  bar: { width: 12, borderRadius: 3, backgroundColor: colors.borderSoft },
  dayLbl: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.clay, letterSpacing: 0.5, textTransform: 'uppercase' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  goalBar: { height: 6, backgroundColor: colors.glacier, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  goalFill: { height: 6, backgroundColor: colors.chambray },
  goalInput: { height: 56, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, backgroundColor: colors.creme, textAlign: 'center' },
  goalSaveBtn: { height: 48, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  goalSaveText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.creme },
  retroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  retroText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso },
  birthOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.4)', justifyContent: 'center', padding: spacing.xl },
  birthModal: { backgroundColor: colors.glacier, borderRadius: 20, padding: spacing.xl },
  birthTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  birthSub: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, lineHeight: 19, marginTop: spacing.xs },
  birthInput: { height: 56, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, backgroundColor: colors.creme, marginTop: spacing.md, textAlign: 'center' },
  birthBtn: { height: 50, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  birthBtnText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.creme },
  birthSkip: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, textDecorationLine: 'underline' },
});
