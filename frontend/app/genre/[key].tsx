import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { BookCover } from '@/src/components/BookCover';
import ManentLoader from '@/src/components/ManentLoader';
import { useT } from '@/src/i18n';

// Page d'un genre (Polar et thriller, Imaginaire, Jeunesse…) : livres du catalogue, croisables
// avec une origine (continent) via les chips.
export default function GenrePage() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { key } = useLocalSearchParams<{ key: string }>();
  const [data, setData] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [area, setArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const gridCardW = (width - spacing.xl * 2 - spacing.sm * 2) / 3;

  const fetchPage = (pg: number) => api<any>(`/catalog/genres/${encodeURIComponent(key)}?page=${pg}&size=12${area ? `&area=${encodeURIComponent(area)}` : ''}`);

  useEffect(() => {
    api<{ areas: any[] }>('/catalog/areas').then(r => setAreas(r.areas || [])).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try { const r = await fetchPage(1); setData(r); setBooks(r.books || []); setPage(1); } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, area]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try { const p = page + 1; const r = await fetchPage(p); setBooks(prev => [...prev, ...(r.books || [])]); setPage(p); }
    finally { setLoadingMore(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-genre">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="genre-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Genre')}</Text>
        <View style={{ width: 40 }} />
      </View>
      {!data ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
          <View style={styles.hero}>
            <Text style={styles.title} testID="genre-title">{data.label}</Text>
            <Text style={styles.baseline}>{data.total} {t(data.total > 1 ? 'livres' : 'livre')}</Text>
          </View>
          {areas.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>
              <Pressable testID="genre-area-all" onPress={() => setArea(null)} style={[styles.chip, !area && styles.chipActive]}>
                <Text style={[styles.chipText, !area && { color: colors.creme }]}>{t('Toutes les origines')}</Text>
              </Pressable>
              {areas.map((a: any) => (
                <Pressable key={a.key} testID={`genre-area-${a.key}`} onPress={() => setArea(area === a.key ? null : a.key)} style={[styles.chip, area === a.key && styles.chipActive]}>
                  <Text style={[styles.chipText, area === a.key && { color: colors.creme }]}>{a.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {(data.top_subjects || []).length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
              {data.top_subjects.map((s: string) => (
                <Pressable key={s} testID={`genre-subject-${s}`} onPress={() => router.push({ pathname: '/theme/[name]', params: { name: s } })} style={styles.chipSoft}>
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {books.length === 0 ? (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Text style={styles.emptyTitle}>{t('Rien dans ce genre pour l’instant.')}</Text>
              <Text style={styles.emptySub}>{t('Le catalogue s’enrichit chaque jour : reviens bientôt, ou retire un filtre.')}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.xl }}>
              {books.map((b: any, i: number) => (
                <Pressable
                  key={b.catalog_id || i}
                  testID={`genre-book-${i}`}
                  onPress={() => router.push({ pathname: '/discover/book', params: { title: b.title, author: b.author || '', cover: b.cover || '', year: b.year || '', summary: b.summary || '', catalog_id: b.catalog_id || '' } })}
                  style={[styles.card, { width: gridCardW }]}
                >
                  <BookCover uri={b.cover} title={b.title} width={gridCardW - 12} height={(gridCardW - 12) * 1.45} radius={6} initialSize={26} />
                  <Text style={styles.bookTitle} numberOfLines={2}>{b.title}</Text>
                  {!!b.author && <Text style={styles.bookAuthor} numberOfLines={1}>{b.author}</Text>}
                  {!!(b.country_labels || [])[0] && <Text style={styles.bookCountry} numberOfLines={1}>{b.country_labels.join(' · ')}</Text>}
                </Pressable>
              ))}
            </View>
          )}
          {books.length < (data.total || 0) && (
            <Pressable testID="genre-see-more" onPress={loadMore} style={styles.moreBtn}>
              <Feather name="plus" size={15} color={colors.chambray} />
              <Text style={styles.moreBtnText}>{loadingMore ? '…' : t('Voir plus de livres')}</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  hero: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.espresso },
  baseline: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 4 },
  chip: { paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipSoft: { paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.espresso },
  card: { backgroundColor: colors.creme, borderRadius: radius.md, padding: 6, borderWidth: 1, borderColor: colors.borderSoft },
  bookTitle: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.espresso, marginTop: 6 },
  bookAuthor: { fontFamily: fonts.body, fontSize: 10.5, color: colors.clay, marginTop: 1 },
  bookCountry: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.chambray, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 2 },
  moreBtn: { marginTop: spacing.md, marginHorizontal: spacing.xl, height: 46, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, backgroundColor: colors.creme, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  moreBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.chambray },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
});
