import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { api } from '@/src/api';
import { useT } from '@/src/i18n';

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
  const [myBooks, setMyBooks] = useState<{ book_id: string; title: string }[]>([]);
  const [results, setResults] = useState<{ quotes: Quote[]; books: any[] }>({ quotes: [], books: [] });
  const [loading, setLoading] = useState(true);
  const timer = useRef<any>(null);

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
      const r = await api<{ quotes: Quote[]; books: any[] }>(`/search?${params.toString()}`);
      setResults(r);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(q, scope, theme, bookId), 350);
    return () => clearTimeout(timer.current);
  }, [q, scope, theme, bookId, run]);

  const filtersActive = theme || bookId;
  const showBooks = scope !== 'quotes' && !filtersActive;
  const showQuotes = scope !== 'books';
  const total = (showQuotes ? results.quotes.length : 0) + (showBooks ? results.books.length : 0);

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
              placeholder={t('Une phrase, un livre, un auteur…')}
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
        <Text style={styles.filterLabel}>{t('Par thème')}</Text>
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

        <View style={{ paddingHorizontal: spacing.xl }}>
          {loading ? (
            <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}>
              <ActivityIndicator color={colors.chambray} />
            </View>
          ) : total === 0 ? (
            <View style={{ paddingVertical: spacing.xxxl, alignItems: 'center' }}>
              <Text style={styles.emptyTitle}>{t('Rien pour l’instant.')}</Text>
              <Text style={styles.emptySub}>{t('Essaie un autre mot, ou retire un filtre.')}</Text>
            </View>
          ) : (
            <>
              {showBooks && results.books.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>{t('Livres ({n})', { n: results.books.length })}</Text>
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
  bookInitial: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  bookTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.espresso },
  bookAuthor: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 2 },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
});
