import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import { BookCover } from '@/src/components/BookCover';
import { ErrorState } from '@/src/components/ErrorState';
import ManentLoader from '@/src/components/ManentLoader';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { MOODS, Mood } from '@/src/journal';

type Retro = {
  year: number; is_premium: boolean; locked: boolean; years: number[];
  books_count: number; entries_count: number; quotes_count: number; pages_total: number; active_days: number; longest_streak: number;
  books?: { book_id: string; title: string; author?: string; cover?: string | null; rating: number; finished_at?: string | null }[];
  mood_distribution?: Record<string, number>; mood_dominant?: Mood | null; top_authors?: { name: string; count: number }[];
  months?: number[]; best_book?: { book_id: string; title: string; author?: string; cover?: string | null; rating: number } | null;
};

// Rétrospective annuelle (Premium) : livres terminés, pages, entrées, humeurs, auteurs de l'année.
// En gratuit : les compteurs, et une invitation à découvrir Premium pour le détail.
export default function Retrospective() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ year?: string }>();
  const [year, setYear] = useState<number>(params.year ? parseInt(params.year, 10) : new Date().getFullYear());
  const [r, setR] = useState<Retro | null>(null);
  const [error, setError] = useState(false);

  const load = () => { setR(null); setError(false); api<Retro>(`/journal/retrospective?year=${year}`).then(setR).catch(() => setError(true)); };
  useEffect(load, [year]);

  const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const maxMonth = Math.max(1, ...(r?.months || [0]));
  const totalMoods = Object.values(r?.mood_distribution || {}).reduce((a, b) => a + b, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-retrospective">
      <ScreenHeader title={t('Rétrospective')} backTestID="retro-back" />
      {error ? <ErrorState onRetry={load} testID="retro-error" /> : !r ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader size={56} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={styles.year}>{r.year}</Text>
            {r.years.length > 1 && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {r.years.slice(0, 4).map(y => (
                  <Pressable key={y} testID={`retro-year-${y}`} onPress={() => setYear(y)} accessibilityRole="button" accessibilityState={{ selected: y === year }} style={[styles.yearChip, y === year && styles.yearChipOn]}>
                    <Text style={[styles.yearChipText, y === year && { color: colors.creme }]}>{y}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <Text style={styles.lede}>{t('Ton année de lecture, en chiffres et en humeurs.')}</Text>

          <View style={styles.grid}>
            {([[r.books_count, r.books_count > 1 ? 'livres terminés' : 'livre terminé'], [r.pages_total, 'pages lues'], [r.entries_count, r.entries_count > 1 ? 'entrées de journal' : 'entrée de journal'], [r.quotes_count, r.quotes_count > 1 ? 'citations gardées' : 'citation gardée'], [r.active_days, 'jours de lecture'], [r.longest_streak, 'jours d’affilée au mieux']] as const).map(([n, l]) => (
              <View key={l} style={styles.stat}><Text style={styles.statNum}>{n}</Text><Text style={styles.statLbl}>{t(l)}</Text></View>
            ))}
          </View>

          {r.locked ? (
            <View style={styles.lockBox} testID="retro-locked">
              <Feather name="lock" size={18} color={colors.chambray} />
              <Text style={styles.lockTitle}>{t('Le détail de ton année est réservé à Premium.')}</Text>
              <Text style={styles.lockSub}>{t('Tes livres de l’année, tes humeurs mois par mois, tes auteurs les plus lus et ton livre préféré.')}</Text>
              <Pressable testID="retro-premium" onPress={() => router.push('/premium')} accessibilityRole="button" style={styles.primary}><Text style={styles.primaryText}>{t('Découvrir Premium')}</Text></Pressable>
            </View>
          ) : (
            <>
              {r.best_book && (
                <Pressable testID="retro-best" onPress={() => router.push({ pathname: '/book/[id]', params: { id: r.best_book!.book_id } })} style={styles.best}>
                  <BookCover uri={r.best_book.cover || undefined} title={r.best_book.title} width={64} height={94} radius={8} initialSize={24} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{t('Ton coup de cœur')}</Text>
                    <Text style={styles.bestTitle} numberOfLines={2}>{r.best_book.title}</Text>
                    {!!r.best_book.author && <Text style={styles.sub}>{r.best_book.author}</Text>}
                    <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>{[1, 2, 3, 4, 5].map(i => <Feather key={i} name="star" size={13} color={colors.chambray} style={{ opacity: i <= r.best_book!.rating ? 1 : 0.25 }} />)}</View>
                  </View>
                </Pressable>
              )}

              {totalMoods > 0 && (
                <View style={styles.box}>
                  <Text style={styles.label}>{t('Tes humeurs de lecture')}</Text>
                  {r.mood_dominant && <Text style={styles.sub}>{t('Le plus souvent : {m}', { m: t(r.mood_dominant.label) })}</Text>}
                  <View style={styles.moodBar} accessibilityLabel={t('Répartition des humeurs')}>
                    {MOODS.map(m => { const n = r.mood_distribution?.[String(m.value)] || 0; return n > 0 ? <View key={m.value} style={{ flex: n, backgroundColor: m.color, height: 12 }} /> : null; })}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                    {MOODS.map(m => { const n = r.mood_distribution?.[String(m.value)] || 0; return n > 0 ? <View key={m.value} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} /><Text style={styles.legend}>{t(m.label)} · {n}</Text></View> : null; })}
                  </View>
                </View>
              )}

              {(r.months || []).some(n => n > 0) && (
                <View style={styles.box}>
                  <Text style={styles.label}>{t('Entrées mois par mois')}</Text>
                  <View style={styles.months}>
                    {(r.months || []).map((n, i) => (
                      <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                        <View style={{ height: 56, justifyContent: 'flex-end' }}><View style={{ width: 10, height: Math.max(3, Math.round((n / maxMonth) * 56)), borderRadius: 3, backgroundColor: n ? colors.chambray : colors.borderSoft }} /></View>
                        <Text style={styles.legend}>{MONTHS[i]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {(r.top_authors || []).length > 0 && (
                <View style={styles.box}>
                  <Text style={styles.label}>{t('Auteurs les plus lus')}</Text>
                  {r.top_authors!.map(a => <Text key={a.name} style={styles.line}>{a.name}<Text style={styles.sub}>  · {t(a.count > 1 ? '{n} livres' : '{n} livre', { n: a.count })}</Text></Text>)}
                </View>
              )}

              {(r.books || []).length > 0 && (
                <View style={styles.box}>
                  <Text style={styles.label}>{t('Tes livres de l’année')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 4 }}>
                    {r.books!.map(b => (
                      <Pressable key={b.book_id} testID={`retro-book-${b.book_id}`} onPress={() => router.push({ pathname: '/book/[id]', params: { id: b.book_id } })} style={{ width: 72 }} accessibilityRole="button" accessibilityLabel={b.title}>
                        <BookCover uri={b.cover || undefined} title={b.title} width={72} height={104} radius={6} initialSize={22} />
                        <Text style={styles.legend} numberOfLines={2}>{b.title}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              {r.books_count === 0 && r.entries_count === 0 && <Text style={styles.sub}>{t('Rien encore cette année. Chaque livre terminé et chaque entrée viendront s’ajouter ici.')}</Text>}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  year: { fontFamily: fonts.displayMedium, fontSize: 48, color: colors.espresso },
  yearChip: { height: 30, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, justifyContent: 'center' },
  yearChipOn: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  yearChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.espresso },
  lede: { fontFamily: fonts.body, fontSize: 13.5, color: colors.clay, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '31%', flexGrow: 1, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, alignItems: 'center' },
  statNum: { fontFamily: fonts.displayMedium, fontSize: 26, color: colors.espresso },
  statLbl: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.clay, letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center', marginTop: 2 },
  lockBox: { alignItems: 'center', gap: 8, backgroundColor: colors.bisque, borderRadius: radius.lg, padding: spacing.xl, marginTop: spacing.lg },
  lockTitle: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, textAlign: 'center' },
  lockSub: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, textAlign: 'center', lineHeight: 19 },
  primary: { height: 44, paddingHorizontal: 22, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  primaryText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
  best: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.bisque, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg },
  bestTitle: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, lineHeight: 24 },
  box: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, marginTop: spacing.md },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay },
  line: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso, marginTop: 4 },
  legend: { fontFamily: fonts.body, fontSize: 11, color: colors.clay },
  moodBar: { flexDirection: 'row', borderRadius: 6, overflow: 'hidden', marginTop: 8 },
  months: { flexDirection: 'row', gap: 2, marginTop: 4 },
});
