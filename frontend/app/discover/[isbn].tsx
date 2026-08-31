import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import { useT, useI18n } from '@/src/i18n';
import ManentLoader from '@/src/components/ManentLoader';

type Discover = {
  book: { title: string; author?: string; isbn?: string; pages?: number; year?: string; cover?: string };
  readers: number;
  avg_rating: number | null;
  ratings_count: number;
  quotes: Quote[];
  in_library: boolean;
};

export default function DiscoverBook() {
  const t = useT();
  const { lang } = useI18n();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isbn } = useLocalSearchParams<{ isbn: string }>();
  const [data, setData] = useState<Discover | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await api<Discover>(`/discover/isbn/${isbn}`));
      } catch {
        setNotFound(true);
      }
    })();
  }, [isbn]);

  useEffect(() => {
    if (!data?.book?.title) return;
    let alive = true;
    (async () => {
      try {
        const r = await api<{ summary: string | null }>(`/books-summary?title=${encodeURIComponent(data.book.title)}&author=${encodeURIComponent(data.book.author || '')}&lang=${lang}`);
        if (alive && r.summary) setSummary(r.summary);
      } catch {}
    })();
    return () => { alive = false; };
  }, [data?.book?.title]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-discover">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="discover-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Découverte')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {notFound ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={styles.emptyTitle}>{t('Ce livre reste introuvable.')}</Text>
        </View>
      ) : !data ? (
        <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}>
          <ManentLoader size={48} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
          <View style={styles.bookCard}>
            <BookCover uri={data.book.cover} title={data.book.title} width={56} height={78} initialSize={28} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.title}>{data.book.title}</Text>
              {!!data.book.author && <Text style={styles.meta}>{data.book.author}</Text>}
              <Text style={styles.meta}>{[data.book.year, data.book.pages ? t('{n} pages', { n: data.book.pages }) : null].filter(Boolean).join('  ·  ')}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{data.readers}</Text>
              <Text style={styles.statLbl}>{t(data.readers > 1 ? 'lecteurs' : 'lecteur')}</Text>
            </View>
            <View style={styles.statCard}>
              {data.avg_rating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.statNum}>{data.avg_rating}</Text>
                  <Ionicons name="star" size={16} color={colors.chambray} />
                </View>
              ) : (
                <Text style={styles.statNum}>—</Text>
              )}
              <Text style={styles.statLbl}>{t('note moyenne')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{data.quotes.length}</Text>
              <Text style={styles.statLbl}>{t(data.quotes.length > 1 ? 'citations' : 'citation')}</Text>
            </View>
          </View>

          {!data.in_library && (
            <Pressable
              testID="discover-add"
              onPress={() => router.push({ pathname: '/book/add', params: { title: data.book.title || '', author: data.book.author || '', cover: data.book.cover || '', isbn: data.book.isbn || String(isbn), pages: data.book.pages ? String(data.book.pages) : '', year: data.book.year || '' } })}
              style={styles.addBtn}
            >
              <Feather name="plus" size={16} color={colors.creme} />
              <Text style={styles.addBtnText}>{t('Ajouter à ma bibliothèque')}</Text>
            </Pressable>
          )}
          {data.in_library && (
            <View style={styles.inLib}>
              <Feather name="check" size={14} color={colors.chambray} />
              <Text style={styles.inLibText}>{t('Dans ta bibliothèque')}</Text>
            </View>
          )}

          {summary ? (
            <View style={styles.summaryBox} testID="discover-summary">
              <Text style={styles.sectionLabel}>{t('Résumé')}</Text>
              <Text style={styles.summaryText}>{summary}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>{t('Ce que les lecteurs en retiennent')}</Text>
          {data.quotes.length === 0 ? (
            <Text style={styles.emptySub}>{t('Aucune citation publique pour ce livre — sois la première à en partager une.')}</Text>
          ) : (
            <View style={{ gap: spacing.md }}>
              {data.quotes.map(x => (
                <QuoteCard key={x.quote_id} quote={x} onPress={() => router.push({ pathname: '/quote/[id]', params: { id: x.quote_id } })} onPressAuthor={x.author?.handle ? () => router.push({ pathname: '/reader/[handle]', params: { handle: x.author!.handle! } }) : undefined} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  summaryBox: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  summaryText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, lineHeight: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  bookCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, alignItems: 'center' },
  cover: { width: 56, height: 78, borderRadius: 6, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  coverInitial: { fontFamily: fonts.displayMedium, fontSize: 28, color: colors.espresso },
  title: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.clay },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', paddingVertical: spacing.md, gap: 2 },
  statNum: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  statLbl: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.md, backgroundColor: colors.chambray, marginTop: spacing.md },
  addBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
  inLib: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  inLibText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.chambray },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay },
});
