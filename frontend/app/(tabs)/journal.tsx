import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
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

// Onglet Journal : toutes les entrées, par jour, filtrables par livre. Les entrées en attente de réseau apparaissent en tête.
export default function JournalTab() {
  const t = useT();
  const lang = useLang();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pending, flush } = useOutbox();
  const params = useLocalSearchParams<{ book_id?: string }>();
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
        <View>
          <Text style={styles.h1}>{t('Journal')}</Text>
          {total > 0 && <Text style={styles.sub}>{t(total > 1 ? '{n} entrées' : '{n} entrée', { n: total })}</Text>}
        </View>
        <Pressable testID="journal-write" onPress={() => router.push({ pathname: '/journal/new', params: bookFilter ? { book_id: bookFilter } : {} })} style={styles.writeBtn}>
          <Feather name="feather" size={15} color={colors.creme} /><Text style={styles.writeText}>{t('Écrire')}</Text>
        </Pressable>
      </View>

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
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await flush(); await load(); setRefreshing(false); }} tintColor={colors.chambray} />}>
          {loadError && all.length > 0 && <View style={{ marginTop: spacing.sm }}><ErrorState compact onRetry={load} testID="journal-error" /></View>}
          {loadError && all.length === 0 ? (
            <ErrorState onRetry={load} testID="journal-error" />
          ) : all.length === 0 ? (
            <View style={{ paddingVertical: spacing.xxxl, alignItems: 'center' }}>
              <Text style={styles.emptyTitle}>{t('Ton journal commence ici.')}</Text>
              <Text style={styles.emptySub}>{t('Une page lue, une humeur, une phrase qui reste : note-les au fil des jours.')}</Text>
              <Pressable testID="journal-empty-write" onPress={() => router.push('/journal/new')} style={[styles.writeBtn, { marginTop: spacing.lg }]}>
                <Feather name="feather" size={15} color={colors.creme} /><Text style={styles.writeText}>{t('Écrire ma première entrée')}</Text>
              </Pressable>
            </View>
          ) : days.map(d => (
            <View key={d.day} style={{ marginBottom: spacing.md }}>
              <Text style={styles.day}>{dayLabel(d.day, lang)}</Text>
              {d.items.map(e => {
                const mood = moodOf(e.mood);
                return (
                  <Pressable key={e.entry_id} testID={`journal-entry-${e.entry_id}`} disabled={e.pending} onPress={() => router.push({ pathname: '/journal/[id]', params: { id: e.entry_id } })} style={[styles.card, e.pending && { opacity: 0.7 }]}>
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
              })}
            </View>
          ))}
          {hasMore && (
            <Pressable testID="journal-more" onPress={loadMore} style={styles.moreBtn}>
              <Text style={styles.moreText}>{more ? '…' : t('Voir plus')}</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  h1: { fontFamily: fonts.displayMedium, fontSize: 28, color: colors.espresso },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.clay },
  writeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.chambray },
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
