import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, useWindowDimensions, Modal, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import { Wordmark } from '@/src/components/Wordmark';
import { BookCardFeed, AwardCard, CollectionCard, ResumeCard } from '@/src/components/FeedCards';
import ManentLoader from '@/src/components/ManentLoader';
import { InfoTooltip } from '@/src/components/InfoTooltip';
import { useT } from '@/src/i18n';

const BIRTH_PROMPT_KEY = 'manent_birth_prompted';

export default function Home() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, refresh } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [daily, setDaily] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [discover, setDiscover] = useState<any>(null);
  const [birthModal, setBirthModal] = useState(false);
  const [birth, setBirth] = useState('');
  const [birthSaving, setBirthSaving] = useState(false);

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

  const skipBirth = async () => {
    await AsyncStorage.setItem(BIRTH_PROMPT_KEY, '1').catch(() => {});
    setBirthModal(false);
  };

  const load = useCallback(async () => {
    try {
      const r = await api<{ quotes: Quote[] }>('/feed');
      setQuotes(r.quotes);
    } catch {}
    try {
      const d = await api<{ quote: Quote | null }>('/quotes/daily');
      setDaily(d.quote);
    } catch {}
    try {
      setDiscover(await api<any>('/home/discover'));
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      const t = await api<{ themes: string[] }>('/themes');
      setThemes(t.themes);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // masonry: split into 2 columns
  const colWidth = (width - spacing.xl * 2 - spacing.md) / 2;
  const shown = quotes;
  const col1: Quote[] = [], col2: Quote[] = [];
  shown.forEach((x, i) => (i % 2 === 0 ? col1 : col2).push(x));

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-home">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark size={19} variant="horizontal" />
          <InfoTooltip
            testID="info-home"
            title={t('Ton fil de lecture')}
            text={t("C'est ici que Manent respire : ta citation du matin, les passages des lecteurs que tu suis, les livres primés et les plus lus de la semaine. Tape un thème en haut pour explorer, ou l'icône de scan pour identifier un livre par sa couverture ou son code-barres.")}
          />
        </View>
        <View style={[styles.searchRow, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
          <Pressable testID="home-search" onPress={() => router.push('/search')} style={[styles.search, { flex: 1 }]}>
            <Feather name="search" size={16} color={colors.clay} />
            <Text style={styles.searchPlaceholder}>{t('Cherche une citation, un livre, un lecteur…')}</Text>
          </Pressable>
          <Pressable testID="home-scan" onPress={() => router.push('/discover/scan')} style={styles.scanBtn}>
            <Feather name="maximize" size={17} color={colors.espresso} />
          </Pressable>
        </View>
        <View style={styles.chipRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl }}>
            <View style={[styles.chip, styles.chipActive]}>
              <Text style={[styles.chipText, styles.chipTextActive]}>{t('Pour toi')}</Text>
            </View>
            {themes.map(t => (
              <Pressable key={t} testID={`home-chip-${t}`} onPress={() => router.push({ pathname: '/theme/[name]', params: { name: t } })} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.chambray} />}
      >
        {discover?.resume && (
          <View style={{ marginBottom: spacing.lg }}>
            <ResumeCard
              testID="resume-card"
              book={discover.resume}
              t={t}
              onPress={() => router.push({ pathname: '/book/[id]', params: { id: discover.resume.book_id } })}
              onPhoto={() => router.push({ pathname: '/book/[id]', params: { id: discover.resume.book_id } })}
            />
          </View>
        )}
        {daily && (
          <View style={{ marginBottom: spacing.lg }} testID="daily-quote">
            <Text style={styles.dailyLabel}>{t('Ta citation du matin')}</Text>
            <QuoteCard quote={daily} onPress={() => router.push({ pathname: '/quote/[id]', params: { id: daily.quote_id } })} />
          </View>
        )}
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}><ManentLoader size={56} /></View>
        ) : shown.length === 0 ? (
          <View style={{ paddingVertical: spacing.xxxl, alignItems: 'center' }}>
            <Text style={styles.emptyTitle}>{t('Le fil est encore silencieux.')}</Text>
            <Text style={styles.emptySub}>{t('Ta première citation illuminera cet écran.')}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {[col1, col2].map((col, ci) => (
              <View key={ci} style={{ width: colWidth, gap: spacing.md }}>
                {col.map(x => (
                  <View key={x.quote_id}>
                    {(x as any).is_followed_author ? (
                      <View style={styles.followTag}>
                        <Feather name="user-check" size={10} color={colors.chambray} />
                        <Text style={styles.followTagText}>{t('Suivi')}</Text>
                      </View>
                    ) : null}
                    <QuoteCard quote={x} compact onPress={() => router.push({ pathname: '/quote/[id]', params: { id: x.quote_id } })} onPressAuthor={x.author?.handle ? () => router.push({ pathname: '/reader/[handle]', params: { handle: x.author!.handle! } }) : undefined} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {discover?.awarded?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Livres primés')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {discover.awarded.map((b: any, i: number) => (
                <AwardCard key={i} testID={`award-${i}`} {...b}
                  onPress={() => router.push({ pathname: '/discover/book', params: { title: b.title, author: b.author || '', cover: b.cover || '', year: b.year || '', prize: `${b.prize} ${b.year}` } })} />
              ))}
            </ScrollView>
          </View>
        )}

        {discover?.popular?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Les plus lus cette semaine')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {discover.popular.map((b: any, i: number) => (
                <BookCardFeed key={i} testID={`popular-${i}`} {...b}
                  onPress={() => router.push({ pathname: '/discover/book', params: { title: b.title, author: b.author || '', cover: b.cover || '' } })} />
              ))}
            </ScrollView>
          </View>
        )}

        {discover?.collections?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Collections thématiques')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {discover.collections.map((c: any) => (
                <CollectionCard key={c.theme} testID={`collection-${c.theme}`} theme={c.theme} covers={c.covers}
                  label={t(c.quotes > 1 ? '{n} citations' : '{n} citation', { n: c.quotes })}
                  onPress={() => router.push({ pathname: '/theme/[name]', params: { name: c.theme } })} />
              ))}
            </ScrollView>
          </View>
        )}

        {discover?.new_books?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Nouveautés')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {discover.new_books.map((b: any, i: number) => (
                <BookCardFeed key={i} testID={`new-${i}`} {...b}
                  onPress={() => router.push({ pathname: '/discover/book', params: { title: b.title, author: b.author || '', cover: b.cover || '', year: b.year || '', summary: b.summary || '' } })} />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <Modal visible={birthModal} transparent animationType="fade" onRequestClose={skipBirth}>
        <View style={styles.birthOverlay}>
          <View style={styles.birthModal} testID="birthdate-modal">
            <Text style={styles.birthTitle}>{t('Ta date de naissance')}</Text>
            <Text style={styles.birthSub}>{t('Elle sert uniquement à filtrer les contenus sensibles selon ton âge. Sans elle, ils resteront masqués.')}</Text>
            <TextInput
              testID="birthdate-input"
              value={birth} onChangeText={onBirthChange}
              placeholder={t('JJ/MM/AAAA')}
              placeholderTextColor={colors.clay}
              keyboardType="number-pad" maxLength={10}
              style={styles.birthInput}
            />
            <Pressable testID="birthdate-save" onPress={saveBirth} disabled={!birthIso || birthSaving} style={[styles.birthBtn, (!birthIso || birthSaving) && { opacity: 0.5 }]}>
              <Text style={styles.birthBtnText}>{t('Enregistrer')}</Text>
            </Pressable>
            <Pressable testID="birthdate-skip" onPress={skipBirth} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <Text style={styles.birthSkip}>{t('Plus tard')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { paddingHorizontal: 0, paddingBottom: spacing.sm, backgroundColor: colors.glacier, gap: spacing.md },
  searchRow: { paddingHorizontal: spacing.xl },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: spacing.md, backgroundColor: colors.creme, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft },
  searchPlaceholder: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.clay },
  scanBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  dailyLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing.sm },
  chipRow: { height: 44 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  empty: { fontFamily: fonts.body, color: colors.clay, textAlign: 'center', paddingTop: spacing.xxxl },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
  followTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  followTagText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.chambray, letterSpacing: 1, textTransform: 'uppercase' },
  section: { marginTop: spacing.xl },
  sectionTitle: { fontFamily: fonts.displayMedium, fontSize: 21, color: colors.espresso, marginBottom: spacing.md },
  birthOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.4)', justifyContent: 'center', padding: spacing.xl },
  birthModal: { backgroundColor: colors.glacier, borderRadius: 20, padding: spacing.xl },
  birthTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  birthSub: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, lineHeight: 19, marginTop: spacing.xs },
  birthInput: { height: 56, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, backgroundColor: colors.creme, marginTop: spacing.md, textAlign: 'center' },
  birthBtn: { height: 50, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  birthBtnText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.creme },
  birthSkip: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, textDecorationLine: 'underline' },
});
