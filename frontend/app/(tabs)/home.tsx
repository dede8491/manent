import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { api } from '@/src/api';
import { Wordmark } from '@/src/components/Wordmark';

export default function Home() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ quotes: Quote[] }>('/feed');
      setQuotes(r.quotes);
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
        <View style={{ paddingHorizontal: spacing.xl }}>
          <Wordmark size={19} variant="horizontal" />
        </View>
        <View style={styles.searchRow}>
          <Pressable testID="home-search" onPress={() => router.push('/search')} style={styles.search}>
            <Feather name="search" size={16} color={colors.clay} />
            <Text style={styles.searchPlaceholder}>Cherche une citation, un livre…</Text>
          </Pressable>
        </View>
        <View style={styles.chipRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl }}>
            <View style={[styles.chip, styles.chipActive]}>
              <Text style={[styles.chipText, styles.chipTextActive]}>Pour toi</Text>
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
        {loading ? (
          <Text style={styles.empty}>Chargement…</Text>
        ) : shown.length === 0 ? (
          <View style={{ paddingVertical: spacing.xxxl, alignItems: 'center' }}>
            <Text style={styles.emptyTitle}>Le fil est encore silencieux.</Text>
            <Text style={styles.emptySub}>Ta première citation illuminera cet écran.</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ width: colWidth, gap: spacing.md }}>
              {col1.map(x => (
                <View key={x.quote_id}>
                  <QuoteCard quote={x} compact onPress={() => router.push({ pathname: '/quote/[id]', params: { id: x.quote_id } })} onPressAuthor={x.author?.handle ? () => router.push({ pathname: '/reader/[handle]', params: { handle: x.author!.handle! } }) : undefined} />
                </View>
              ))}
            </View>
            <View style={{ width: colWidth, gap: spacing.md }}>
              {col2.map(x => (
                <View key={x.quote_id}>
                  <QuoteCard quote={x} compact onPress={() => router.push({ pathname: '/quote/[id]', params: { id: x.quote_id } })} onPressAuthor={x.author?.handle ? () => router.push({ pathname: '/reader/[handle]', params: { handle: x.author!.handle! } }) : undefined} />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { paddingHorizontal: 0, paddingBottom: spacing.sm, backgroundColor: colors.glacier, gap: spacing.md },
  searchRow: { paddingHorizontal: spacing.xl },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: spacing.md, backgroundColor: colors.creme, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft },
  searchPlaceholder: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.clay },
  chipRow: { height: 44 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  empty: { fontFamily: fonts.body, color: colors.clay, textAlign: 'center', paddingTop: spacing.xxxl },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
});
