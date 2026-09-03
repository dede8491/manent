import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { api } from '@/src/api';
import { useT } from '@/src/i18n';
import ManentLoader from '@/src/components/ManentLoader';
import { AreaCard } from '@/src/components/AreaCard';
import { ClassificationLines } from '@/src/components/ClassificationLines';

type Scope = 'all' | 'quotes' | 'books';

export default function SearchScreen() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [theme, setTheme] = useState<string | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const [themes, setThemes] = useState<string[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [myBooks, setMyBooks] = useState<{ book_id: string; title: string }[]>([]);
  const [results, setResults] = useState<{ quotes: Quote[]; books: any[]; readers: any[] }>({ quotes: [], books: [], readers: [] });
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [matched, setMatched] = useState<{ dim: string; key: string; label: string }[]>([]);
  const [matchedSel, setMatchedSel] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const timer = useRef<any>(null);
  const catalogTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [t, b] = await Promise.all([
          api<{ themes: string[] }>('/themes'),
          api<{ books: any[] }>('/books'),
        ]);
        setThemes(t.themes);
        setMyBooks(b.books.map((x: any) => ({ book_id: x.book_id, title: x.title })));
      } catch {}
      try {
        const ar = await api<{ areas: any[] }>('/catalog/areas');
        setAreas(ar.areas || []);
      } catch {}
      try {
        const g = await api<{ genres: any[] }>('/catalog/genres');
        setGenres((g.genres || []).filter((x: any) => x.count > 0));
      } catch {}
    })();
  }, []);

  const run = useCallback(async (qv: string, scopeV: Scope, themeV: string | null, bookV: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (qv.trim()) params.set('q', qv.trim());
      if (themeV) params.set('theme', themeV);
      if (bookV) params.set('book_id', bookV);
      params.set('scope', scopeV);
      const r = await api<{ quotes: Quote[]; books: any[]; readers: any[] }>(`/search?${params.toString()}`);
      setResults({ quotes: r.quotes || [], books: r.books || [], readers: r.readers || [] });
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(q, scope, theme, bookId), 350);
    return () => clearTimeout(timer.current);
  }, [q, scope, theme, bookId, run]);

  // Recherche internet (catalogue) en parallèle de la recherche locale
  useEffect(() => {
    if (catalogTimer.current) clearTimeout(catalogTimer.current);
    const qv = q.trim();
    if (qv.length < 2 || scope === 'quotes' || theme || bookId) {
      setCatalog([]);
      setCatalogLoading(false);
      return;
    }
    setCatalogLoading(true);
    catalogTimer.current = setTimeout(async () => {
      try {
        const r = await api<{ results: any[]; total: number; matched_chips?: any[]; matched_filters?: Record<string, string[]> }>(`/catalog/search?q=${encodeURIComponent(qv)}&page=1&size=10`);
        setCatalog(r.results || []);
        setCatalogTotal(r.total || 0);
        setCatalogPage(1);
        setMatched(r.matched_chips || []);
        setMatchedSel(r.matched_filters || {});
      } catch {
        setCatalog([]);
        setMatched([]);
      }
      setCatalogLoading(false);
    }, 450);
    return () => clearTimeout(catalogTimer.current);
  }, [q, scope, theme, bookId]);

  const catalogMore = async () => {
    try {
      const p = catalogPage + 1;
      const r = await api<{ results: any[] }>(`/catalog/search?q=${encodeURIComponent(q.trim())}&page=${p}&size=10`);
      setCatalog(prev => [...prev, ...(r.results || [])]);
      setCatalogPage(p);
    } catch {}
  };

  const filtersActive = theme || bookId;
  const showBooks = scope !== 'quotes' && !filtersActive;
  const showQuotes = scope !== 'books';
  const showReaders = scope === 'all' && !filtersActive;
  const total = (showQuotes ? results.quotes.length : 0) + (showBooks ? results.books.length : 0) + (showReaders ? results.readers.length : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-search">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.searchRow}>
          <Pressable onPress={() => router.back()} testID="search-back" style={styles.iconBtn}>
            <Feather name="chevron-left" size={22} color={colors.espresso} />
          </Pressable>
          <View style={styles.searchBox}>
            <Feather name="search" size={16} color={colors.clay} />
            <TextInput
              testID="search-input"
              value={q} onChangeText={setQ}
              autoFocus
              placeholder={t('Une phrase, un livre, un lecteur…')}
              placeholderTextColor={colors.clay}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {q ? (
              <Pressable testID="search-clear" onPress={() => setQ('')} hitSlop={8}>
                <Feather name="x" size={16} color={colors.clay} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.segmentRow}>
          {([['all', 'Tout'], ['quotes', 'Citations'], ['books', 'Livres']] as [Scope, string][]).map(([s, label]) => (
            <Pressable key={s} testID={`search-scope-${s}`} onPress={() => setScope(s)} style={[styles.segment, scope === s && styles.segmentActive]}>
              <Text style={[styles.segmentText, scope === s && styles.segmentTextActive]}>{t(label)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <Pressable testID="search-intent" onPress={() => router.push('/intent')} style={[styles.chip, { flex: 1, maxWidth: undefined, backgroundColor: colors.bisque, borderColor: colors.bisque }]}>
            <Text style={styles.chipText} numberOfLines={1}>✨ {t('Je cherche un livre qui…')}</Text>
          </Pressable>
          <Pressable testID="search-filters" onPress={() => router.push({ pathname: '/filters', params: { q: q.trim() } })} style={[styles.chip, { flexDirection: 'row', gap: 6 }]}>
            <Feather name="sliders" size={13} color={colors.espresso} />
            <Text style={styles.chipText}>{t('Filtres')}</Text>
          </Pressable>
        </View>
        {matched.length > 0 && q.trim().length >= 2 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipScroll, { marginTop: spacing.sm }]}>
            {matched.map((c: any) => (
              <Pressable key={`${c.dim}:${c.key}`} testID={`search-matched-${c.dim}-${c.key}`} onPress={() => router.push({ pathname: '/browse', params: { f: JSON.stringify({ [c.dim]: [c.key] }), title: c.label } })} style={[styles.chip, styles.chipActive, { flexDirection: 'row', gap: 6 }]}>
                <Text style={[styles.chipText, styles.chipTextActive]}>{c.label}</Text>
                <Feather name="arrow-right" size={12} color={colors.creme} />
              </Pressable>
            ))}
            {matched.length > 1 && (
              <Pressable testID="search-matched-all" onPress={() => router.push({ pathname: '/browse', params: { f: JSON.stringify(matchedSel), title: q.trim() } })} style={styles.chip}>
                <Text style={styles.chipText}>{t('Combiner')}</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
        <Text style={styles.filterLabel}>{t('Par sujet')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {themes.map(t => (
            <Pressable key={t} testID={`search-theme-${t}`} onPress={() => setTheme(theme === t ? null : t)} style={[styles.chip, theme === t && styles.chipActive]}>
              <Text style={[styles.chipText, theme === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {myBooks.length > 0 && (
          <>
            <Text style={styles.filterLabel}>{t('Par livre')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {myBooks.map(b => (
                <Pressable key={b.book_id} testID={`search-book-${b.book_id}`} onPress={() => setBookId(bookId === b.book_id ? null : b.book_id)} style={[styles.chip, bookId === b.book_id && styles.chipActive]}>
                  <Text style={[styles.chipText, bookId === b.book_id && styles.chipTextActive]} numberOfLines={1}>{b.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {genres.length > 0 && !q.trim() && (
          <>
            <Text style={styles.filterLabel}>{t('Par genre')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {genres.map((g: any) => (
                <Pressable key={g.key} testID={`search-genre-${g.key}`} onPress={() => router.push({ pathname: '/genre/[key]', params: { key: g.key } })} style={styles.chip}>
                  <Text style={styles.chipText}>{g.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
        {areas.length > 0 && !q.trim() && (
          <>
            <Text style={styles.filterLabel}>{t('Littératures')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {areas.map((a: any) => (
                <AreaCard key={a.key} testID={`search-area-${a.key}`} label={a.label} count={a.count} onPress={() => router.push({ pathname: '/area/[key]', params: { key: a.key } })} />
              ))}
            </ScrollView>
          </>
        )}

        <View style={{ paddingHorizontal: spacing.xl }}>
          {loading ? (
            <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}>
              <ManentLoader size={48} />
            </View>
          ) : total === 0 && catalog.length === 0 && !catalogLoading ? (
            <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
              <Text style={styles.emptyTitle}>{t('Rien pour l’instant.')}</Text>
              <Text style={styles.emptySub}>{t('Essaie un autre mot, ou retire un filtre.')}</Text>
            </View>
          ) : (
            <>
              {showReaders && results.readers.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>{t('Lecteurs ({n})', { n: results.readers.length })}</Text>
                  {results.readers.map((r: any) => (
                    <Pressable key={r.handle} testID={`search-reader-${r.handle}`} onPress={() => router.push({ pathname: '/reader/[handle]', params: { handle: r.handle } })} style={styles.bookRow}>
                      <View style={styles.readerAvatar}>
                        {r.picture ? <Image source={{ uri: r.picture }} style={{ width: 40, height: 40, borderRadius: 20 }} /> : <Text style={styles.bookInitial}>{(r.pseudo?.[0] || 'M').toUpperCase()}</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bookTitle} numberOfLines={1}>{r.pseudo}</Text>
                        <Text style={styles.bookAuthor} numberOfLines={1}>@{r.handle}{r.is_following ? `  ·  ${t('Suivi')}` : ''}</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={colors.clay} />
                    </Pressable>
                  ))}
                </>
              )}
              {showBooks && results.books.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>{t('Dans ta bibliothèque ({n})', { n: results.books.length })}</Text>
                  {results.books.map((b: any) => (
                    <Pressable key={b.book_id} testID={`search-result-book-${b.book_id}`} onPress={() => router.push({ pathname: '/book/[id]', params: { id: b.book_id } })} style={styles.bookRow}>
                      <View style={styles.bookCover}><Text style={styles.bookInitial}>{(b.title?.[0] || 'M').toUpperCase()}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bookTitle} numberOfLines={1}>{b.title}</Text>
                        {!!b.author && <Text style={styles.bookAuthor} numberOfLines={1}>{b.author}</Text>}
                      </View>
                      <Feather name="chevron-right" size={18} color={colors.clay} />
                    </Pressable>
                  ))}
                </>
              )}
              {showQuotes && results.quotes.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>{t('Citations ({n})', { n: results.quotes.length })}</Text>
                  {results.quotes.map(x => (
                    <QuoteCard key={x.quote_id} quote={x} onPress={() => router.push({ pathname: '/quote/[id]', params: { id: x.quote_id } })} />
                  ))}
                </>
              )}
              {(catalog.length > 0 || catalogLoading) && (
                <>
                  <View style={styles.catalogHead}>
                    <Feather name="globe" size={13} color={colors.chambray} />
                    <Text style={[styles.sectionLabel, { marginBottom: 0, color: colors.chambray }]}>{t('Catalogue en ligne')}</Text>
                    {catalogLoading && <ManentLoader size={20} />}
                  </View>
                  {catalog.map((b: any, i: number) => (
                    <Pressable
                      key={b.catalog_id || `cat-${i}`}
                      testID={`search-catalog-${i}`}
                      onPress={() => router.push({ pathname: '/book/add', params: { title: b.title || '', author: b.author || '', cover: b.cover || '', isbn: b.isbn || '', pages: b.pages ? String(b.pages) : '', year: b.year || '', catalog_id: b.catalog_id || '' } })}
                      style={styles.bookRow}
                    >
                      {b.cover ? (
                        <Image source={{ uri: b.cover }} style={styles.bookCoverImg} />
                      ) : (
                        <View style={styles.bookCover}><Text style={styles.bookInitial}>{(b.title?.[0] || 'M').toUpperCase()}</Text></View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bookTitle} numberOfLines={1}>{b.title}</Text>
                        <Text style={styles.bookAuthor} numberOfLines={1}>{[b.author, b.year].filter(Boolean).join('  ·  ')}</Text>
                        {(b.lines || []).length > 0 ? <ClassificationLines lines={b.lines} compact style={{ marginTop: 2 }} />
                          : !!b.summary && <Text style={styles.bookSummary} numberOfLines={2}>{b.summary}</Text>}
                      </View>
                      <Feather name="plus-circle" size={19} color={colors.chambray} />
                    </Pressable>
                  ))}
                  {catalog.length < catalogTotal && (
                    <Pressable testID="search-see-more" onPress={catalogMore} style={styles.moreBtn}>
                      <Text style={styles.moreBtnText}>{t('Voir plus de livres')}</Text>
                    </Pressable>
                  )}
                  {q.trim().length >= 2 && (
                    <Pressable testID="open-subject-page" onPress={() => router.push({ pathname: '/theme/[name]', params: { name: q.trim().toLowerCase() } })} style={[styles.moreBtn, { marginTop: spacing.sm }]}>
                      <Feather name="hash" size={13} color={colors.chambray} />
                      <Text style={styles.moreBtnText}>{t('Ouvrir le sujet « {s} »', { s: q.trim().toLowerCase() })}</Text>
                    </Pressable>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { paddingBottom: spacing.sm, backgroundColor: colors.glacier, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: spacing.md, backgroundColor: colors.creme, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.espresso, paddingVertical: 0 },
  segmentRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, marginTop: spacing.md },
  segment: { flex: 1, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  segmentText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  segmentTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  filterLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: spacing.xl, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipScroll: { gap: 8, paddingHorizontal: spacing.xl },
  chip: { height: 34, paddingHorizontal: 14, maxWidth: 200, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 8 },
  bookCover: { width: 40, height: 56, borderRadius: radius.sm, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  bookCoverImg: { width: 40, height: 56, borderRadius: radius.sm, backgroundColor: colors.bisque },
  bookSummary: { fontFamily: fonts.body, fontSize: 11, color: colors.clay, lineHeight: 15, marginTop: 2 },
  moreBtn: { marginTop: spacing.md, height: 42, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, backgroundColor: colors.creme, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  moreBtnText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.chambray },
  readerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  bookInitial: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  bookTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.espresso },
  bookAuthor: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 2 },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
  catalogHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, marginBottom: spacing.sm },
});
