import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import { BookHero, AreaLine } from '@/src/components/BookHero';
import { Toast } from '@/src/components/Toast';
import { useT, useI18n } from '@/src/i18n';
import ManentLoader from '@/src/components/ManentLoader';

type Discover = {
  book: { title: string; author?: string; isbn?: string; pages?: number; year?: string; cover?: string; catalog_id?: string; summary?: string | null; area_labels?: string[]; country_labels?: string[] };
  readers: number;
  avg_rating: number | null;
  ratings_count: number;
  quotes: Quote[];
  in_library: boolean;
};

// Résultat d'un scan (en librairie, chez une amie) : un tap pour l'ajouter à la liste de
// lecture, un second bouton pour le parcours complet si on le lit déjà.
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
  const [adding, setAdding] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await api<Discover>(`/discover/isbn/${isbn}`);
        setData(d);
        if (d.book.summary) setSummary(d.book.summary);
      } catch {
        setNotFound(true);
      }
    })();
  }, [isbn]);

  useEffect(() => {
    if (!data?.book?.title || summary) return;
    let alive = true;
    (async () => {
      try {
        const r = await api<{ summary: string | null }>(`/books-summary?title=${encodeURIComponent(data.book.title)}&author=${encodeURIComponent(data.book.author || '')}&lang=${lang}`);
        if (alive && r.summary) setSummary(r.summary);
      } catch {}
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.book?.title]);

  const addToReadingList = async () => {
    if (!data || adding) return;
    setAdding(true);
    try {
      const b = await api<{ book_id: string }>('/books', {
        method: 'POST',
        body: JSON.stringify({
          type: 'papier', title: data.book.title, author: data.book.author || undefined, cover: data.book.cover || undefined,
          isbn: data.book.isbn || String(isbn), pages: data.book.pages || undefined, year: data.book.year || undefined,
          catalog_id: data.book.catalog_id || undefined, summary: summary || undefined, status: 'a_lire',
        }),
      });
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setAddedId(b.book_id);
      setToast(true);
    } catch {}
    finally { setAdding(false); }
  };

  const goFullAdd = () => {
    if (!data) return;
    router.push({ pathname: '/book/add', params: { title: data.book.title || '', author: data.book.author || '', cover: data.book.cover || '', isbn: data.book.isbn || String(isbn), pages: data.book.pages ? String(data.book.pages) : '', year: data.book.year || '', catalog_id: data.book.catalog_id || '' } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-discover">
      {notFound ? (
        <>
          <BookHero label={t('Découverte')} testID="discover-back"><View /></BookHero>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
            <Text style={styles.emptyTitle}>{t('Ce livre reste introuvable.')}</Text>
          </View>
        </>
      ) : !data ? (
        <>
          <BookHero label={t('Découverte')} testID="discover-back"><View /></BookHero>
          <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}><ManentLoader size={48} /></View>
        </>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
          <BookHero label={t('Découverte')} testID="discover-back">
            <View style={styles.heroRow}>
              <BookCover uri={data.book.cover} title={data.book.title} width={96} height={140} radius={10} initialSize={40} />
              <View style={{ flex: 1, justifyContent: 'center', gap: 3 }}>
                {!!data.book.year && <Text style={styles.year}>{data.book.year}</Text>}
                <Text style={styles.title}>{data.book.title}</Text>
                {!!data.book.author && <Text style={styles.meta}>{data.book.author}</Text>}
                <AreaLine areas={data.book.area_labels} countries={data.book.country_labels} />
                {!!data.book.pages && <Text style={styles.metaSmall}>{t('{n} pages', { n: data.book.pages })}</Text>}
              </View>
            </View>
          </BookHero>

          <View style={{ paddingHorizontal: spacing.xl }}>
            {addedId || data.in_library ? (
              <Pressable testID="discover-in-library" onPress={() => addedId && router.push({ pathname: '/book/[id]', params: { id: addedId } })} style={styles.inLib}>
                <Feather name="check" size={14} color={colors.chambray} />
                <Text style={styles.inLibText}>{addedId ? t('Ajouté à ta liste de lecture') : t('Dans ta bibliothèque')}</Text>
              </Pressable>
            ) : (
              <>
                <Pressable testID="discover-add-list" onPress={addToReadingList} disabled={adding} style={({ pressed }) => [styles.addBtn, (pressed || adding) && { opacity: 0.85 }]}>
                  {adding ? <ManentLoader size={18} variant="sombre" /> : <Feather name="bookmark" size={16} color={colors.creme} />}
                  <Text style={styles.addBtnText}>{t('Ajouter à ma liste de lecture')}</Text>
                </Pressable>
                <Pressable testID="discover-add" onPress={goFullAdd} style={styles.secondaryBtn}>
                  <Feather name="book-open" size={15} color={colors.espresso} />
                  <Text style={styles.secondaryText}>{t('Je le lis déjà')}</Text>
                </Pressable>
              </>
            )}

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

            {summary ? (
              <View style={styles.summaryBox} testID="discover-summary">
                <Text style={styles.sectionLabel}>{t('Résumé')}</Text>
                <Text style={styles.summaryText}>{summary}</Text>
              </View>
            ) : null}

            <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>{t('Ce que les lecteurs en retiennent')}</Text>
            {data.quotes.length === 0 ? (
              <Text style={styles.emptySub}>{t('Aucune citation publique pour ce livre — sois la première à en partager une.')}</Text>
            ) : (
              <View style={{ gap: spacing.md }}>
                {data.quotes.map(x => (
                  <QuoteCard key={x.quote_id} quote={x} onPress={() => router.push({ pathname: '/quote/[id]', params: { id: x.quote_id } })} onPressAuthor={x.author?.handle ? () => router.push({ pathname: '/reader/[handle]', params: { handle: x.author!.handle! } }) : undefined} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
      <Toast
        visible={toast}
        text={t('Ajouté à ta liste de lecture')}
        actionLabel={t('Voir')}
        onAction={() => { setToast(false); router.push('/queue'); }}
        onHide={() => setToast(false)}
        testID="toast-reading-list"
      />
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  heroRow: { flexDirection: 'row', gap: spacing.lg },
  year: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5 },
  title: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, lineHeight: 28 },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.clay },
  metaSmall: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 2 },
  summaryBox: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, marginTop: spacing.md },
  summaryText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: spacing.lg },
  statCard: { flex: 1, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', paddingVertical: spacing.md, gap: 2 },
  statNum: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  statLbl: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.pill, backgroundColor: colors.chambray, marginTop: spacing.sm },
  addBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.creme },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, marginTop: spacing.sm },
  secondaryText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.espresso },
  inLib: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md, height: 44 },
  inLibText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.chambray },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay },
});
