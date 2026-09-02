import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import { QuotesManager } from '@/src/components/QuotesManager';
import { InfoTooltip } from '@/src/components/InfoTooltip';
import { AddReadingSheet } from '@/src/components/AddReadingSheet';
import { useT } from '@/src/i18n';

type Book = {
  book_id: string;
  type: 'papier' | 'wattpad' | 'etude';
  title: string;
  author?: string;
  cover?: string | null;
  pages?: number | null;
  chapters?: number | null;
  status: 'a_lire' | 'en_cours' | 'termine';
  rating: number;
  progress_page?: number;
  progress_chapter?: number;
  quotes_count?: number;
  exam_date?: string | null;
};

const FILTERS = [
  { id: null as any, label: 'Tous' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'termine', label: 'Terminés' },
  { id: 'a_lire', label: 'Liste de lecture' },
];

function BookCard({ b, onPress }: { b: Book; onPress: () => void }) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const isWattpad = b.type === 'wattpad';
  const isEtude = b.type === 'etude';
  const total = isWattpad ? b.chapters : b.pages;
  const progress = isWattpad ? b.progress_chapter : b.progress_page;
  const pct = total && progress ? Math.min(100, Math.round((progress / total) * 100)) : 0;
  return (
    <Pressable onPress={onPress} testID={`book-card-${b.book_id}`} style={styles.card}>
      <BookCover uri={(b as any).cover} title={b.title} width={52} height={72} initialSize={22} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {isWattpad && <Text style={styles.badge}>WATTPAD</Text>}
          {isEtude && <Text style={styles.badge}>{t('ÉTUDES')}</Text>}
          <Text style={styles.statusMeta}>{b.status === 'en_cours' ? t('EN COURS') : b.status === 'termine' ? t('TERMINÉ') : t('À LIRE')}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{b.title}</Text>
        {b.author ? <Text style={styles.author} numberOfLines={1}>{b.author}</Text> : null}
        {b.status === 'en_cours' && total ? (
          <View style={{ marginTop: spacing.sm }}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>{progress || 0} / {total} {isWattpad ? 'chap.' : 'p.'} · {pct}%</Text>
          </View>
        ) : null}
        <Text style={styles.footer}>{t((b.quotes_count || 0) > 1 ? '{n} citations' : '{n} citation', { n: b.quotes_count || 0 })}</Text>
      </View>
    </Pressable>
  );
}

export default function Library() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [seg, setSeg] = useState<'livres' | 'citations'>('livres');
  const [addSheet, setAddSheet] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      const r = await api<{ books: Book[] }>(`/books${filter ? `?status=${filter}` : ''}`);
      setBooks(r.books); setLoading(false);
    })();
  }, [filter]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-library">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={styles.h1}>{t('Bibliothèque')}</Text>
            <InfoTooltip
              testID="info-library"
              title={t('Comment ça marche')}
              text={t("Le « + » ajoute une lecture par titre, ISBN ou Wattpad. Tes livres se rangent en trois étapes : Liste de lecture, En cours, Terminés. La liste de lecture s'ordonne dans « Lecture suivante », le prochain livre en tête. Sur l'onglet Citations, le « + » sert à écrire un passage ; sélectionnes-en plusieurs pour changer leur visibilité d'un geste.")}
            />
          </View>
          <Pressable testID="btn-library-add" onPress={() => (seg === 'citations' ? router.push('/capture?mode=write' as any) : setAddSheet(true))} style={styles.addBtn}>
            <Feather name="plus" size={22} color={colors.creme} />
          </Pressable>
        </View>
        <View style={styles.segRow}>
          {([['livres', 'Livres'], ['citations', 'Citations']] as const).map(([s, lbl]) => (
            <Pressable key={s} testID={`lib-seg-${s}`} onPress={() => setSeg(s)} style={[styles.seg, seg === s && styles.segActive]}>
              <Text style={[styles.segText, seg === s && styles.segTextActive]}>{t(lbl)}</Text>
            </Pressable>
          ))}
        </View>
        {seg === 'livres' && (
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl }}>
            {FILTERS.map(f => (
              <Pressable key={String(f.id)} testID={`lib-filter-${f.id ?? 'all'}`} onPress={() => setFilter(f.id)} style={[styles.chip, filter === f.id && styles.chipActive]}>
                <Text style={[styles.chipText, filter === f.id && styles.chipTextActive]}>{t(f.label)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        )}
      </View>
      {seg === 'citations' ? (
        <QuotesManager />
      ) : (
      <FlatList
        data={books}
        keyExtractor={x => x.book_id}
        renderItem={({ item }) => <BookCard b={item} onPress={() => router.push({ pathname: '/book/[id]', params: { id: item.book_id } })} />}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 80 }}
        ListHeaderComponent={filter === 'a_lire' && books.length > 0 ? (
          <Pressable testID="btn-open-queue" onPress={() => router.push('/queue')} style={styles.queueBtn}>
            <Feather name="list" size={16} color={colors.chambray} />
            <View style={{ flex: 1 }}>
              <Text style={styles.queueTitle}>{t('Lecture suivante')}</Text>
              <Text style={styles.queueSub}>{t('Ordonne ta file : le prochain livre en tête.')}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.clay} />
          </Pressable>
        ) : null}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={loading ? null : (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
            <Text style={styles.emptyTitle}>{t("Ta bibliothèque t'attend.")}</Text>
            <Text style={styles.emptySub}>{t('Ajoute ton premier livre ou une histoire Wattpad.')}</Text>
            <Pressable testID="empty-add-book" onPress={() => setAddSheet(true)} style={[styles.addBtn, { marginTop: spacing.lg }]}>
              <Feather name="plus" size={22} color={colors.creme} />
            </Pressable>
          </View>
        )}
      />
      )}
      <AddReadingSheet visible={addSheet} onClose={() => setAddSheet(false)} />
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { paddingBottom: spacing.sm, backgroundColor: colors.glacier, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl },
  h1: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.espresso },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  filterRow: { height: 44 },
  segRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl },
  seg: { flex: 1, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  segText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  segTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  card: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSoft },
  cover: { width: 72, height: 108, borderRadius: radius.sm, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  coverInitial: { fontFamily: fonts.displayMedium, fontSize: 40, color: colors.espresso },
  badge: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.creme, backgroundColor: colors.clay, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, letterSpacing: 1 },
  statusMeta: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1.5 },
  title: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, marginTop: 2 },
  author: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 2 },
  progressBar: { height: 3, backgroundColor: colors.borderSoft, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: colors.chambray },
  progressText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1, marginTop: 4, textTransform: 'uppercase' },
  footer: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1.5, marginTop: spacing.sm, textTransform: 'uppercase' },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
  queueBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  queueTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso },
  queueSub: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 1 },
});
