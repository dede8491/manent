import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, SectionList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT, useLang } from '@/src/i18n';
import { BookCover } from '@/src/components/BookCover';
import ManentLoader from '@/src/components/ManentLoader';
import { ErrorState } from '@/src/components/ErrorState';
import { Entry, dayLabel, groupByDay, moodOf, outboxAsEntries, readOutbox, useOutbox } from '@/src/journal';
import { QuotesManager } from '@/src/components/QuotesManager';
import { BottomSheet } from '@/src/components/BottomSheet';
import { InfoTooltip } from '@/src/components/InfoTooltip';

// Onglet Journal : mes traces de lecture. Deux segments — Entrées (par jour, filtrables par livre) et Citations —
// et un « + » commun : écrire une entrée, photographier une page, écrire une citation.
export default function JournalTab() {
  const t = useT();
  const lang = useLang();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pending, flush } = useOutbox();
  const params = useLocalSearchParams<{ book_id?: string; segment?: string }>();
  const [segment, setSegment] = useState<'entries' | 'quotes'>(params.segment === 'citations' ? 'quotes' : 'entries');
  useEffect(() => { if (params.segment) setSegment(params.segment === 'citations' ? 'quotes' : 'entries'); }, [params.segment]);
  const [addSheet, setAddSheet] = useState(false);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [local, setLocal] = useState<Entry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [bookFilter, setBookFilter] = useState<string | null>(null);
  useEffect(() => { if (params.book_id) setBookFilter(params.book_id); }, [params.book_id]);
  const [books, setBooks] = useState<Record<string, any>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ entries: Entry[]; has_more: boolean; total: number }>(`/journal/entries?size=40${bookFilter ? `&book_id=${bookFilter}` : ''}`);
      setEntries(r.entries); setHasMore(r.has_more); setTotal(r.total); setLoadError(false);
      setBooks(prev => { const next = { ...prev }; r.entries.forEach(e => { if (e.book?.book_id) next[e.book.book_id] = e.book; }); return next; });
    } catch { setLoadError(true); setEntries(prev => prev || []); }
    setLocal(outboxAsEntries(await readOutbox(), books).filter(e => !bookFilter || e.book_id === bookFilter));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookFilter]);
  useFocusEffect(useCallback(() => { flush().then(load); }, [load, flush]));
  useEffect(() => { load(); }, [pending, load]);

  const loadMore = async () => {
    if (!entries?.length || more) return;
    setMore(true);
    try {
      const last = entries[entries.length - 1];
      const r = await api<{ entries: Entry[]; has_more: boolean }>(`/journal/entries?size=40&before=${encodeURIComponent(last.created_at)}${bookFilter ? `&book_id=${bookFilter}` : ''}`);
      setEntries(prev => [...(prev || []), ...r.entries]); setHasMore(r.has_more);
    } finally { setMore(false); }
  };

  const all = useMemo(() => [...local, ...(entries || [])], [local, entries]);
  const days = useMemo(() => groupByDay(all), [all]);
  const bookList = Object.values(books).filter((b: any) => b.book_id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-journal">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={styles.h1}>{t('Journal')}</Text>
          <InfoTooltip testID="info-journal" title={t('Tes traces de lecture')} text={t('Entrées : ce que tu as lu et ressenti, jour par jour. Citations : les passages que tu as photographiés ou écrits. Le « + » fait les deux. Tout est privé par défaut.')} />
        </View>
        <Pressable testID="journal-add" onPress={() => setAddSheet(true)} accessibilityRole="button" accessibilityLabel={t('Ajouter')} style={styles.addBtn}>
          <Feather name="plus" size={22} color={colors.creme} />
        </Pressable>
      </View>
      <View style={styles.segments} accessibilityRole="tablist">
        <Pressable testID="journal-seg-entries" onPress={() => setSegment('entries')} accessibilityRole="tab" accessibilityState={{ selected: segment === 'entries' }} style={[styles.seg, segment === 'entries' && styles.segOn]}>
          <Text style={[styles.segText, segment === 'entries' && styles.segTextOn]}>{t('Entrées')}{total > 0 ? ` · ${total}` : ''}</Text>
        </Pressable>
        <Pressable testID="journal-seg-quotes" onPress={() => setSegment('quotes')} accessibilityRole="tab" accessibilityState={{ selected: segment === 'quotes' }} style={[styles.seg, segment === 'quotes' && styles.segOn]}>
          <Text style={[styles.segText, segment === 'quotes' && styles.segTextOn]}>{t('Citations')}</Text>
        </Pressable>
      </View>
      {segment === 'quotes' ? <QuotesManager initialBookId={bookFilter} /> : (
      <>

      {bookList.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
          <Pressable testID="journal-filter-all" onPress={() => setBookFilter(null)} style={[styles.chip, !bookFilter && styles.chipOn]}><Text style={[styles.chipText, !bookFilter && styles.chipTextOn]}>{t('Tous')}</Text></Pressable>
          {bookList.map((b: any) => (
            <Pressable key={b.book_id} testID={`journal-filter-${b.book_id}`} onPress={() => setBookFilter(bookFilter === b.book_id ? null : b.book_id)} style={[styles.chip, bookFilter === b.book_id && styles.chipOn]}>
              <Text style={[styles.chipText, bookFilter === b.book_id && styles.chipTextOn]} numberOfLines={1}>{b.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {entries === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader size={56} /></View>
      ) : (
        <SectionList
          sections={days.map(d => ({ title: dayLabel(d.day, lang), data: d.items }))}
          keyExtractor={e => e.entry_id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 90 }}
          initialNumToRender={12}
          windowSize={7}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await flush(); await load(); setRefreshing(false); }} tintColor={colors.chambray} />}
          ListHeaderComponent={loadError && all.length > 0 ? <View style={{ marginTop: spacing.sm }}><ErrorState compact onRetry={load} testID="journal-error" /></View> : null}
          ListEmptyComponent={loadError ? (
            <ErrorState onRetry={load} testID="journal-error" />
          ) : (
            <View style={{ paddingVertical: spacing.xxxl, alignItems: 'center' }}>
              <Text style={styles.emptyTitle}>{t('Ton journal commence ici.')}</Text>
              <Text style={styles.emptySub}>{t('Une page lue, une humeur, une phrase qui reste : note-les au fil des jours.')}</Text>
              <Pressable testID="journal-empty-write" onPress={() => router.push('/journal/new')} accessibilityRole="button" style={[styles.writeBtn, { marginTop: spacing.lg }]}>
                <Feather name="feather" size={15} color={colors.creme} /><Text style={styles.writeText}>{t('Écrire ma première entrée')}</Text>
              </Pressable>
            </View>
          )}
          renderSectionHeader={({ section }) => <Text style={styles.day}>{section.title}</Text>}
          renderItem={({ item: e }) => {
            const mood = moodOf(e.mood);
            return (
              <Pressable testID={`journal-entry-${e.entry_id}`} disabled={e.pending} onPress={() => router.push({ pathname: '/journal/[id]', params: { id: e.entry_id } })} accessibilityRole="button" style={[styles.card, e.pending && { opacity: 0.7 }]}>
                <BookCover uri={e.book?.cover || undefined} title={e.book?.title || ''} width={34} height={48} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {mood && <View style={[styles.moodDot, { backgroundColor: mood.color }]} />}
                    <Text style={styles.cardMeta} numberOfLines={1}>{e.book?.title || t('Livre')}{e.page ? ` · p. ${e.page}` : ''}{e.pending ? ` · ${t('en attente du réseau')}` : e.is_public ? ` · ${t('publiée')}` : ''}</Text>
                  </View>
                  {e.content ? <Text style={styles.cardText} numberOfLines={3}>{e.content}</Text>
                    : e.quotes?.[0] ? <Text style={styles.cardQuote} numberOfLines={2}>« {e.quotes[0].text} »</Text>
                    : <Text style={styles.cardText}>{mood ? t(mood.label) : ''}</Text>}
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={hasMore ? (
            <Pressable testID="journal-more" onPress={loadMore} accessibilityRole="button" style={styles.moreBtn}>
              <Text style={styles.moreText}>{more ? '…' : t('Voir plus')}</Text>
            </Pressable>
          ) : null}
          onEndReached={() => { if (hasMore) loadMore(); }}
          onEndReachedThreshold={0.6}
        />
      )}
      </>
      )}

      <BottomSheet visible={addSheet} onClose={() => setAddSheet(false)} title={t('Garder une trace')} testID="journal-add-sheet" scroll={false}>
        {([
          ['entry', 'feather', 'Écrire mon entrée du jour', 'Page atteinte, humeur, quelques mots.'],
          ['camera', 'camera', 'Photographier une page', 'L’IA transcrit le passage et retrouve la page.'],
          ['write', 'edit-3', 'Écrire une citation', 'Saisis ou colle le passage, choisis le livre.'],
        ] as const).map(([key, icon, title, sub]) => (
          <Pressable key={key} testID={`journal-add-${key}`} accessibilityRole="button" onPress={() => { setAddSheet(false); if (key === 'entry') router.push({ pathname: '/journal/new', params: bookFilter ? { book_id: bookFilter } : {} }); else router.push({ pathname: '/capture', params: { mode: key, ...(bookFilter ? { book_id: bookFilter } : {}) } }); }} style={styles.option}>
            <View style={[styles.optionIcon, key !== 'entry' && { backgroundColor: colors.espresso }]}><Feather name={icon} size={20} color={colors.creme} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>{t(title)}</Text>
              <Text style={styles.optionSub}>{t(sub)}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.clay} />
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  h1: { fontFamily: fonts.displayMedium, fontSize: 32, color: colors.espresso },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.clay },
  writeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.chambray },
  addBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  segments: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  seg: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, justifyContent: 'center' },
  segOn: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  segText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.espresso },
  segTextOn: { color: colors.creme, fontFamily: fonts.bodyMedium },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  optionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso },
  optionSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, marginTop: 2 },
  writeText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.creme },
  chip: { height: 30, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, justifyContent: 'center', maxWidth: 180 },
  chipOn: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.espresso },
  chipTextOn: { color: colors.creme, fontFamily: fonts.bodyMedium },
  day: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm },
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, marginBottom: 8 },
  moodDot: { width: 9, height: 9, borderRadius: 5 },
  cardMeta: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, flexShrink: 1 },
  cardText: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso, lineHeight: 20, marginTop: 4 },
  cardQuote: { fontFamily: fonts.display, fontSize: 16, color: colors.espresso, lineHeight: 22, marginTop: 4 },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  moreBtn: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  moreText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.chambray },
});
