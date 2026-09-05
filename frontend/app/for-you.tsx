import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import ManentLoader from '@/src/components/ManentLoader';
import { useT } from '@/src/i18n';

// « Pour toi », en entier : toutes les propositions, leur raison, et « Pas pour moi ».
export default function ForYou() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [books, setBooks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const cardW = (width - spacing.xl * 2 - spacing.sm * 2) / 3;

  const fetchPage = async (p: number) => api<{ books: any[]; total: number }>(`/catalog/for-you?page=${p}&size=12`);

  useEffect(() => {
    (async () => {
      try { const r = await fetchPage(1); setBooks(r.books || []); setTotal(r.total || 0); } catch {}
      setLoading(false);
    })();
  }, []);

  const loadMore = async () => {
    if (more) return;
    setMore(true);
    try { const p = page + 1; const r = await fetchPage(p); setBooks(prev => [...prev, ...(r.books || [])]); setPage(p); } catch {}
    finally { setMore(false); }
  };

  const dismiss = async (catalogId: string) => {
    setBooks(prev => prev.filter(b => b.catalog_id !== catalogId));
    setTotal(x => Math.max(0, x - 1));
    try { await api('/catalog/for-you/dismiss', { method: 'POST', body: JSON.stringify({ catalog_id: catalogId }) }); } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-for-you">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="for-you-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Découverte')}</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}><ManentLoader size={48} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
          <Text style={styles.title}>{t('Pour toi')}</Text>
          <Text style={styles.sub}>{t('Choisis d’après tes sujets, les origines de tes auteurs, tes clubs et les lectrices que tu suis. Renouvelé chaque jour.')}</Text>
          {books.length === 0 ? (
            <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
              <Text style={styles.emptyTitle}>{t('Rien à proposer pour l’instant.')}</Text>
              <Text style={styles.emptySub}>{t('Ajoute des livres, note-les, suis des lectrices : les propositions arriveront.')}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {books.map((b: any) => (
                <View key={b.catalog_id} style={[styles.card, { width: cardW }]} testID={`for-you-card-${b.catalog_id}`}>
                  <Pressable onPress={() => router.push({ pathname: '/discover/book', params: { title: b.title, author: b.author || '', cover: b.cover || '', year: b.year || '', summary: b.summary || '', catalog_id: b.catalog_id } })}>
                    <BookCover uri={b.cover} title={b.title} width={cardW - 12} height={(cardW - 12) * 1.45} radius={6} initialSize={26} />
                    <Text style={styles.bookTitle} numberOfLines={2}>{b.title}</Text>
                    {!!b.author && <Text style={styles.bookAuthor} numberOfLines={1}>{b.author}</Text>}
                    {!!b.reason && <Text style={styles.reason} numberOfLines={2}>{b.reason}</Text>}
                  </Pressable>
                  <Pressable testID={`for-you-dismiss-${b.catalog_id}`} onPress={() => dismiss(b.catalog_id)} hitSlop={6} style={{ marginTop: 6 }}>
                    <Text style={styles.dismiss}>{t('Pas pour moi')}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          {books.length < total && (
            <Pressable testID="for-you-more" onPress={loadMore} style={styles.moreBtn}>
              <Feather name="plus" size={15} color={colors.chambray} />
              <Text style={styles.moreBtnText}>{more ? '…' : t('Voir plus de livres')}</Text>
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
  title: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.espresso },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, lineHeight: 19, marginTop: 4, marginBottom: spacing.lg },
  card: { backgroundColor: colors.creme, borderRadius: radius.md, padding: 6, borderWidth: 1, borderColor: colors.borderSoft },
  bookTitle: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.espresso, marginTop: 6 },
  bookAuthor: { fontFamily: fonts.body, fontSize: 10.5, color: colors.clay, marginTop: 1 },
  reason: { fontFamily: fonts.body, fontSize: 10, color: colors.chambray, lineHeight: 13.5, marginTop: 3 },
  dismiss: { fontFamily: fonts.body, fontSize: 10.5, color: colors.clay, textDecorationLine: 'underline' },
  moreBtn: { marginTop: spacing.md, height: 46, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, backgroundColor: colors.creme, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  moreBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.chambray },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
});
