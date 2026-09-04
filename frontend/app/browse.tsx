import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import ManentLoader from '@/src/components/ManentLoader';
import { BottomSheet } from '@/src/components/BottomSheet';
import { CatalogBookRow } from '@/src/components/CatalogBookRow';
import { SORTS, Sel, countSel, labelOf, parseSel, selToQuery, toggleSel, useTaxonomy } from '@/src/classification';

// Résultats filtrés du catalogue : chips actives (×), « Filtres », « Trier par », pagination.
export default function BrowseScreen() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ f?: string; sort?: string; q?: string; title?: string }>();
  const tax = useTaxonomy();
  const sel: Sel = useMemo(() => parseSel(params.f), [params.f]);
  const sort = params.sort || 'pertinence';
  const [books, setBooks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [exactTotal, setExactTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [sortSheet, setSortSheet] = useState(false);

  const fetchPage = useCallback((pg: number) => api<any>(`/catalog/browse?${selToQuery(sel, { sort, page: pg, size: 20, q: params.q })}`), [sel, sort, params.q]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPage(1).then(r => { if (!alive) return; setBooks(r.results || []); setTotal(r.total || 0); setExactTotal(typeof r.exact_total === 'number' ? r.exact_total : null); setPage(1); })
      .catch(() => { if (alive) { setBooks([]); setTotal(0); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fetchPage]);

  const loadMore = async () => {
    if (more) return;
    setMore(true);
    try { const p = page + 1; const r = await fetchPage(p); setBooks(prev => [...prev, ...(r.results || [])]); setPage(p); }
    finally { setMore(false); }
  };

  const setSelection = (next: Sel) => router.setParams({ f: JSON.stringify(next) });
  const chips = Object.entries(sel).flatMap(([dim, keys]) => keys.map(k => ({ dim, key: k, label: labelOf(tax, dim, k) })));
  const n = countSel(sel);

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-browse">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="browse-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{params.title || t('Livres')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.toolbar}>
        <Pressable testID="browse-filters" onPress={() => router.push({ pathname: '/filters', params: { f: params.f || '', sort, q: params.q || '', from: 'browse' } })} style={styles.toolBtn}>
          <Feather name="sliders" size={15} color={colors.espresso} />
          <Text style={styles.toolText}>{t('Filtres')}</Text>
          {n > 0 && <View style={styles.countPill}><Text style={styles.countText}>{n}</Text></View>}
        </Pressable>
        <Pressable testID="browse-sort" onPress={() => setSortSheet(true)} style={styles.toolBtn}>
          <Feather name="arrow-down" size={15} color={colors.espresso} />
          <Text style={styles.toolText}>{t('Trier par')}</Text>
          <Text style={[styles.toolText, { color: colors.chambray }]} numberOfLines={1}>· {t(SORTS.find(s => s.key === sort)?.label || 'Pertinence')}</Text>
        </Pressable>
      </View>

      {chips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, alignItems: 'center' }}>
          {chips.map(c => (
            <Pressable key={`${c.dim}:${c.key}`} testID={`browse-chip-${c.dim}-${c.key}`} onPress={() => setSelection(toggleSel(sel, c.dim, c.key))} style={styles.selChip}>
              <Text style={styles.selChipText} numberOfLines={1}>{c.label}</Text>
              <Feather name="x" size={12} color={colors.creme} />
            </Pressable>
          ))}
          <Pressable testID="browse-reset" onPress={() => setSelection({})} style={styles.resetChip}>
            <Text style={styles.resetText}>{t('Réinitialiser')}</Text>
          </Pressable>
        </ScrollView>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
          <Text style={styles.total} testID="browse-total">
            {total === 0 ? t('Aucun livre')
              : exactTotal !== null && exactTotal < total ? t('{e} correspondances exactes · {n} livres proches', { e: exactTotal, n: total - exactTotal })
              : t(total > 1 ? '{n} livres' : '{n} livre', { n: total })}
          </Text>
          {books.length === 0 ? (
            <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
              <Text style={styles.emptyTitle}>{t('Rien pour ces filtres.')}</Text>
              <Text style={styles.emptySub}>{t('Retire un filtre, ou essaie « Je cherche un livre qui… » pour formuler ton envie.')}</Text>
              <Pressable testID="browse-intent" onPress={() => router.push('/intent')} style={styles.moreBtn}>
                <Text style={styles.moreBtnText}>✨ {t('Je cherche un livre qui…')}</Text>
              </Pressable>
            </View>
          ) : books.map((b: any, i: number) => {
            const partial = typeof b.match_of === 'number' && b.match_score < b.match_of;
            const firstPartial = partial && (i === 0 || !(typeof books[i - 1].match_of === 'number' && books[i - 1].match_score < books[i - 1].match_of));
            return (
              <View key={b.catalog_id || i}>
                {firstPartial && (
                  <View style={styles.sep} testID="browse-partial-sep">
                    <Text style={styles.sepText}>{t('Proches de ta recherche')}</Text>
                    <Text style={styles.sepSub}>{t('Ces livres remplissent une partie des filtres, les plus proches d’abord.')}</Text>
                  </View>
                )}
                <CatalogBookRow book={b} testID={`browse-book-${i}`} />
              </View>
            );
          })}
          {books.length < total && (
            <Pressable testID="browse-see-more" onPress={loadMore} style={styles.moreBtn}>
              <Feather name="plus" size={15} color={colors.chambray} />
              <Text style={styles.moreBtnText}>{more ? '…' : t('Voir plus de livres')}</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      <BottomSheet visible={sortSheet} onClose={() => setSortSheet(false)} title={t('Trier par')} testID="browse-sort-sheet">
        {SORTS.map(s => (
          <Pressable key={s.key} testID={`browse-sort-${s.key}`} onPress={() => { setSortSheet(false); router.setParams({ sort: s.key }); }} style={styles.sortRow}>
            <Text style={[styles.sortText, s.key === sort && { color: colors.chambray, fontFamily: fonts.bodyMedium }]}>{t(s.label)}</Text>
            {s.key === sort && <Feather name="check" size={18} color={colors.chambray} />}
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase', flex: 1, textAlign: 'center' },
  toolbar: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, flexShrink: 1 },
  toolText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso },
  countPill: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.creme },
  selChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingLeft: 10, paddingRight: 8, borderRadius: radius.pill, backgroundColor: colors.chambray, maxWidth: 180 },
  selChipText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.creme },
  resetChip: { height: 28, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay },
  total: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: spacing.sm, marginBottom: spacing.sm },
  sep: { marginTop: spacing.md, marginBottom: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  sepText: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso },
  sepSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, marginTop: 2 },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  moreBtn: { marginTop: spacing.md, height: 46, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, backgroundColor: colors.creme, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  moreBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.chambray },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  sortText: { fontFamily: fonts.body, fontSize: 15, color: colors.espresso },
});
