import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { api } from '@/src/api';
import { useT } from '@/src/i18n';
import ManentLoader from '@/src/components/ManentLoader';

export default function ThemePage() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { name } = useLocalSearchParams<{ name: string }>();
  const [data, setData] = useState<{ stats: { quotes: number; readers: number; books: number }; quotes: Quote[]; suggested_books?: any[]; discover_books?: any[]; discover_total?: number } | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [genres, setGenres] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const gridCardW = (width - spacing.xl * 2 - spacing.sm * 2) / 3;

  useEffect(() => {
    (async () => {
      try {
        const r = await api<any>(`/themes/${encodeURIComponent(name)}/page?page=1&size=12${areaFilter ? `&area=${encodeURIComponent(areaFilter)}` : ''}${genreFilter ? `&genre=${encodeURIComponent(genreFilter)}` : ''}`);
        setData(r);
        setBooks(r.discover_books || []);
        setTotal(r.discover_total || 0);
        setPage(1);
      } catch {}
    })();
  }, [name, areaFilter, genreFilter]);

  useEffect(() => {
    api<{ areas: any[] }>('/catalog/areas').then(r => setAreas(r.areas || [])).catch(() => {});
    api<{ genres: any[] }>('/catalog/genres').then(r => setGenres((r.genres || []).filter((g: any) => g.count > 0))).catch(() => {});
  }, []);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const p = page + 1;
      const r = await api<any>(`/themes/${encodeURIComponent(name)}/page?page=${p}&size=12${areaFilter ? `&area=${encodeURIComponent(areaFilter)}` : ''}${genreFilter ? `&genre=${encodeURIComponent(genreFilter)}` : ''}`);
      setBooks(prev => [...prev, ...(r.discover_books || [])]);
      setPage(p);
    } finally { setLoadingMore(false); }
  };

  const colWidth = (width - spacing.xl * 2 - spacing.md) / 2;
  const col1: Quote[] = [], col2: Quote[] = [];
  (data?.quotes || []).forEach((x, i) => (i % 2 === 0 ? col1 : col2).push(x));

  const goQuote = (id: string) => router.push({ pathname: '/quote/[id]', params: { id } });
  const goAuthor = (handle?: string) => { if (handle) router.push({ pathname: '/reader/[handle]', params: { handle } }); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-theme">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="theme-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Sujet')}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={styles.hero}>
          <Text style={styles.title} testID="theme-title">{name}</Text>
          <Text style={styles.baseline}>{t('Ce que les lecteurs en retiennent.')}</Text>
        </View>

        {data ? (
          <View style={styles.statsRow} testID="theme-stats">
            {[
              { n: data.stats.quotes, l: t(data.stats.quotes > 1 ? 'citations' : 'citation') },
              { n: data.stats.readers, l: t(data.stats.readers > 1 ? 'lecteurs' : 'lecteur') },
              { n: data.stats.books, l: t(data.stats.books > 1 ? 'livres' : 'livre') },
            ].map(s => (
              <View key={s.l} style={styles.statCard}>
                <Text style={styles.statNum}>{s.n}</Text>
                <Text style={styles.statLbl}>{s.l}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
            <ManentLoader size={48} />
          </View>
        )}

        {data && (data.suggested_books?.length || 0) > 0 && (
          <View style={{ marginTop: spacing.lg }} testID="theme-books">
            <Text style={styles.suggestLabel}>{t('Des livres pour ce sujet')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
              {data.suggested_books!.map((b: any) => (
                <Pressable
                  key={b.book_id}
                  testID={`theme-book-${b.book_id}`}
                  onPress={() => b.is_mine
                    ? router.push({ pathname: '/book/[id]', params: { id: b.book_id } })
                    : router.push({ pathname: '/book/add', params: { title: b.title, author: b.author || '', cover: b.cover || '' } })}
                  style={styles.suggestCard}
                >
                  {b.cover ? (
                    <Image source={{ uri: b.cover }} style={styles.suggestCover} resizeMode="cover" />
                  ) : (
                    <View style={[styles.suggestCover, { alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={styles.suggestInitial}>{(b.title?.[0] || 'M').toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.suggestTitle} numberOfLines={2}>{b.title}</Text>
                  {!!b.author && <Text style={styles.suggestAuthor} numberOfLines={1}>{b.author}</Text>}
                  <Text style={styles.suggestCta}>{b.is_mine ? t('Dans ta bibliothèque') : t('Ajouter')}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {(books.length > 0 || areas.length > 0 || genres.length > 0) && (
          <View style={{ marginTop: spacing.lg }} testID="theme-discover">
            <Text style={styles.suggestLabel}>{t('À découvrir sur ce sujet')}</Text>
            {genres.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>
                <Pressable testID="genre-filter-all" onPress={() => setGenreFilter(null)} style={[styles.areaChip, !genreFilter && styles.areaChipActive]}>
                  <Text style={[styles.areaChipText, !genreFilter && styles.areaChipTextActive]}>{t('Tous les genres')}</Text>
                </Pressable>
                {genres.map((g: any) => (
                  <Pressable key={g.key} testID={`genre-filter-${g.key}`} onPress={() => setGenreFilter(genreFilter === g.key ? null : g.key)} style={[styles.areaChip, genreFilter === g.key && styles.areaChipActive]}>
                    <Text style={[styles.areaChipText, genreFilter === g.key && styles.areaChipTextActive]}>{g.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {areas.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
                <Pressable testID="area-filter-all" onPress={() => setAreaFilter(null)} style={[styles.areaChip, !areaFilter && styles.areaChipActive]}>
                  <Text style={[styles.areaChipText, !areaFilter && styles.areaChipTextActive]}>{t('Toutes les littératures')}</Text>
                </Pressable>
                {areas.map((a: any) => (
                  <Pressable key={a.key} testID={`area-filter-${a.key}`} onPress={() => setAreaFilter(areaFilter === a.key ? null : a.key)} style={[styles.areaChip, areaFilter === a.key && styles.areaChipActive]}>
                    <Text style={[styles.areaChipText, areaFilter === a.key && styles.areaChipTextActive]}>{a.label.replace(/^(Autres littératures |Littératures |Littérature )/, '')}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.xl }}>
              {books.map((b: any, i: number) => (
                <Pressable
                  key={b.catalog_id || i}
                  testID={`theme-discover-${i}`}
                  onPress={() => router.push({ pathname: '/discover/book', params: { title: b.title, author: b.author || '', cover: b.cover || '', year: b.year || '', summary: b.summary || '' } })}
                  style={[styles.suggestCard, { width: gridCardW }]}
                >
                  <Image source={{ uri: b.cover }} style={[styles.suggestCover, { height: gridCardW * 1.4 }]} resizeMode="cover" />
                  <Text style={styles.suggestTitle} numberOfLines={2}>{b.title}</Text>
                  {!!b.author && <Text style={styles.suggestAuthor} numberOfLines={1}>{b.author}</Text>}
                  {!!b.summary && <Text style={styles.suggestSummary} numberOfLines={2}>{b.summary}</Text>}
                </Pressable>
              ))}
            </View>
            {books.length < total && (
              <Pressable testID="theme-see-more" onPress={loadMore} style={styles.moreBtn}>
                <Feather name="plus" size={15} color={colors.chambray} />
                <Text style={styles.moreBtnText}>{loadingMore ? '…' : t('Voir plus de livres')}</Text>
              </Pressable>
            )}
          </View>
        )}

        {data && (
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
            {data.quotes.length === 0 ? (
              <View style={{ paddingVertical: spacing.xxxl, alignItems: 'center' }}>
                <Text style={styles.emptyTitle}>{t('Personne n’a encore écrit ici.')}</Text>
                <Text style={styles.emptySub}>{t('Capture une citation sur ce sujet et rends-la publique.')}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ width: colWidth, gap: spacing.md }}>
                  {col1.map(x => (
                    <QuoteCard key={x.quote_id} quote={x} compact onPress={() => goQuote(x.quote_id)} onPressAuthor={() => goAuthor(x.author?.handle)} />
                  ))}
                </View>
                <View style={{ width: colWidth, gap: spacing.md }}>
                  {col2.map(x => (
                    <QuoteCard key={x.quote_id} quote={x} compact onPress={() => goQuote(x.quote_id)} onPressAuthor={() => goAuthor(x.author?.handle)} />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  hero: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, alignItems: 'center' },
  title: { fontFamily: fonts.displayMedium, fontSize: 40, color: colors.espresso, textTransform: 'capitalize' },
  baseline: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl },
  statCard: { flex: 1, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', paddingVertical: spacing.md },
  statNum: { fontFamily: fonts.displayMedium, fontSize: 28, color: colors.espresso },
  statLbl: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },
  suggestLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  suggestCard: { width: 120, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.sm },
  suggestCover: { width: '100%', height: 120, borderRadius: radius.sm, backgroundColor: colors.bisque, marginBottom: spacing.xs },
  suggestInitial: { fontFamily: fonts.displayMedium, fontSize: 34, color: colors.espresso },
  suggestTitle: { fontFamily: fonts.displayMedium, fontSize: 14, color: colors.espresso, lineHeight: 17 },
  suggestAuthor: { fontFamily: fonts.body, fontSize: 11, color: colors.clay, marginTop: 1 },
  suggestCta: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.chambray, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.xs },
  moreBtn: { marginTop: spacing.md, marginHorizontal: spacing.xl, height: 46, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, backgroundColor: colors.creme, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  moreBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.chambray },
  suggestSummary: { fontFamily: fonts.body, fontSize: 10.5, color: colors.clay, lineHeight: 14, marginTop: 3 },
  areaChip: { paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  areaChipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  areaChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.espresso },
  areaChipTextActive: { color: colors.creme },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
});
