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
  const [data, setData] = useState<{ stats: { quotes: number; readers: number; books: number }; quotes: Quote[]; suggested_books?: any[] } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<any>(`/themes/${encodeURIComponent(name)}/page`);
        setData(r);
      } catch {}
    })();
  }, [name]);

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
        <Text style={styles.headerLabel}>{t('Thème')}</Text>
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
            <Text style={styles.suggestLabel}>{t('Des livres pour ce thème')}</Text>
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

        {data && (
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
            {data.quotes.length === 0 ? (
              <View style={{ paddingVertical: spacing.xxxl, alignItems: 'center' }}>
                <Text style={styles.emptyTitle}>{t('Personne n’a encore écrit ici.')}</Text>
                <Text style={styles.emptySub}>{t('Capture une citation sur ce thème et rends-la publique.')}</Text>
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
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
});
