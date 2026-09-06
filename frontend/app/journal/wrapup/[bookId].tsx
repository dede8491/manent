import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { api } from '@/src/api';
import { fonts, radius, spacing, colors as brand } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import { BookCover } from '@/src/components/BookCover';
import ManentLoader from '@/src/components/ManentLoader';
import { MoodTimeline, MoodPoint } from '@/src/components/MoodTimeline';
import { Mood, moodOf } from '@/src/journal';

type Wrap = {
  book: { book_id: string; title: string; author?: string; cover?: string | null; status?: string; pages?: number };
  is_premium: boolean; entries_count: number; days: number | null; started?: string | null; finished?: string | null;
  mood_avg: number | null; mood_dominant: Mood | null; moods: MoodPoint[];
  highlights: { entry_id: string; date: string; mood?: number | null; page?: number | null; excerpt: string }[];
  favorite_quotes: { quote_id: string; text: string; page?: number | null }[];
  rating: number; review: string; lessons: string[]; read_count: number;
};

// Fiche de fin de livre : humeurs au fil des sessions, moments forts, citations favorites, note, enseignements.
// Export en image format Stories (1080×1920) : version simple en gratuit (filigrane), complète en Premium.
export default function WrapUp() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const [w, setW] = useState<Wrap | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const cardRef = useRef<View>(null);

  useEffect(() => { api<Wrap>(`/journal/books/${bookId}/wrapup`).then(setW).catch(() => setMsg(t('Fiche indisponible.'))); }, [bookId, t]);

  const share = async () => {
    if (!w || busy) return;
    setBusy(true); setMsg(null);
    try {
      if (Platform.OS === 'web') { setMsg(t('L’image se partage depuis l’application mobile.')); return; }
      const uri = await captureRef(cardRef, { format: 'png', quality: w.is_premium ? 1 : 0.8, result: 'tmpfile', width: 1080, height: 1920 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('Partager ma fiche de fin') });
    } catch { setMsg(t('Le partage a échoué. Réessaie.')); }
    finally { setBusy(false); }
  };

  const dom = w?.mood_dominant;
  const stars = (n: number, size = 14, color = colors.chambray) => (
    <View style={{ flexDirection: 'row', gap: 3 }}>{[1, 2, 3, 4, 5].map(i => <Feather key={i} name="star" size={size} color={color} style={{ opacity: i <= n ? 1 : 0.25 }} />)}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-wrapup">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="wrapup-back" style={styles.iconBtn}><Feather name="chevron-left" size={22} color={colors.espresso} /></Pressable>
        <Text style={styles.headerLabel}>{t('Fiche de fin de livre')}</Text>
        <View style={{ width: 40 }} />
      </View>
      {!w ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{msg ? <Text style={styles.msg}>{msg}</Text> : <ManentLoader size={56} />}</View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
          <View style={styles.hero}>
            <BookCover uri={w.book.cover || undefined} title={w.book.title} width={76} height={110} radius={8} initialSize={26} />
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>{w.book.status === 'termine' ? t('Terminé') : t('En cours')}</Text>
              <Text style={styles.title} numberOfLines={3}>{w.book.title}</Text>
              {!!w.book.author && <Text style={styles.author}>{w.book.author}</Text>}
              {w.rating > 0 && <View style={{ marginTop: 6 }}>{stars(w.rating)}</View>}
            </View>
          </View>

          <View style={styles.statsRow}>
            <Stat label={t('entrées')} value={String(w.entries_count)} styles={styles} />
            <Stat label={t('jours')} value={w.days ? String(w.days) : '–'} styles={styles} />
            <Stat label={t('humeur')} value={dom ? t(dom.label) : '–'} styles={styles} color={dom?.color} />
          </View>

          {w.moods.length >= 2 && (
            <View style={styles.box}>
              <Text style={styles.boxLabel}>{t('Humeur au fil des sessions')}</Text>
              <MoodTimeline points={w.moods} height={100} />
            </View>
          )}
          {w.favorite_quotes.length > 0 && (
            <View style={styles.box}>
              <Text style={styles.boxLabel}>{t('Citations favorites')}</Text>
              {w.favorite_quotes.map(q => <Text key={q.quote_id} style={styles.quote}>« {q.text} »{q.page ? <Text style={styles.quotePage}>  p. {q.page}</Text> : null}</Text>)}
            </View>
          )}
          {w.highlights.length > 0 && (
            <View style={styles.box}>
              <Text style={styles.boxLabel}>{t('Moments forts')}</Text>
              {w.highlights.map(h => {
                const m = moodOf(h.mood);
                return (
                  <Pressable key={h.entry_id} onPress={() => router.push({ pathname: '/journal/[id]', params: { id: h.entry_id } })} style={styles.highlight}>
                    {m && <View style={[styles.dot, { backgroundColor: m.color }]} />}
                    <Text style={styles.highlightText} numberOfLines={3}>{h.excerpt}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {(!!w.review || w.lessons.length > 0) && (
            <View style={styles.box}>
              <Text style={styles.boxLabel}>{t('Ce que j’en garde')}</Text>
              {!!w.review && <Text style={styles.review}>{w.review}</Text>}
              {w.lessons.map((l, i) => <Text key={i} style={styles.lesson}>– {l}</Text>)}
            </View>
          )}
          {w.entries_count === 0 && (
            <Text style={styles.msg}>{t('Sans entrée de journal, la fiche reste sommaire. Note tes prochaines sessions et reviens.')}</Text>
          )}

          <Pressable testID="wrapup-share" onPress={share} disabled={busy} style={[styles.shareBtn, busy && { opacity: 0.6 }]}>
            {busy ? <ManentLoader size={18} variant="sombre" /> : <Feather name="share" size={16} color={colors.creme} />}
            <Text style={styles.shareText}>{t('Partager en image (Stories)')}</Text>
          </Pressable>
          {!w.is_premium && (
            <Pressable testID="wrapup-premium" onPress={() => router.push('/premium')} style={{ alignSelf: 'center', marginTop: spacing.sm }}>
              <Text style={styles.premiumHint}>{t('Version complète et sans filigrane avec Premium')}</Text>
            </Pressable>
          )}
          {!!msg && <Text style={styles.msg}>{msg}</Text>}

          {/* Carte capturée hors écran (1080×1920) */}
          <View style={{ position: 'absolute', left: -4000, top: 0 }} pointerEvents="none">
            <View ref={cardRef} collapsable={false} style={styles.card} testID="wrapup-card">
              <View>
                <Text style={styles.cardBrand}>Manent</Text>
                <Text style={styles.cardBrandSub}>{t('journal de lecture')}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 40, alignItems: 'center' }}>
                <BookCover uri={w.book.cover || undefined} title={w.book.title} width={260} height={380} radius={20} initialSize={90} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardKicker}>{w.book.status === 'termine' ? t('Terminé') : t('En cours')}</Text>
                  <Text style={styles.cardTitle} numberOfLines={4}>{w.book.title}</Text>
                  {!!w.book.author && <Text style={styles.cardAuthor} numberOfLines={2}>{w.book.author}</Text>}
                  {w.rating > 0 && <View style={{ marginTop: 18 }}>{stars(w.rating, 34, brand.chambray)}</View>}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 30 }}>
                <CardStat label={t('entrées')} value={String(w.entries_count)} styles={styles} />
                <CardStat label={t('jours')} value={w.days ? String(w.days) : '–'} styles={styles} />
                <CardStat label={t('humeur')} value={dom ? t(dom.label) : '–'} styles={styles} color={dom?.color} />
              </View>
              {w.is_premium ? (
                <>
                  {w.moods.length >= 2 && (
                    <View>
                      <Text style={styles.cardLabel}>{t('Humeur au fil des sessions')}</Text>
                      <View style={{ transform: [{ scaleY: 2.4 }], transformOrigin: 'bottom', marginBottom: 130 }}>
                        <MoodTimeline points={w.moods} height={110} compact colorsOverride={{ line: 'rgba(58,33,25,0.15)', label: brand.clay }} />
                      </View>
                    </View>
                  )}
                  {w.favorite_quotes.slice(0, 2).map(q => <Text key={q.quote_id} style={styles.cardQuote} numberOfLines={4}>« {q.text} »</Text>)}
                  {!!w.review && <Text style={styles.cardReview} numberOfLines={4}>{w.review}</Text>}
                </>
              ) : (
                <>
                  {w.favorite_quotes[0] && <Text style={styles.cardQuote} numberOfLines={5}>« {w.favorite_quotes[0].text} »</Text>}
                  <Text style={styles.cardWatermark}>manent · {t('journal de lecture')}</Text>
                </>
              )}
              <Text style={styles.cardFoot}>verba volant, scripta manent</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ label, value, styles, color }: { label: string; value: string; styles: any; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function CardStat({ label, value, styles, color }: { label: string; value: string; styles: any; color?: string }) {
  return (
    <View style={styles.cardStat}>
      <Text style={[styles.cardStatValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.cardStatLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  hero: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  kicker: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.chambray, letterSpacing: 1.6, textTransform: 'uppercase' },
  title: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, lineHeight: 29, marginTop: 2 },
  author: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, alignItems: 'center' },
  statValue: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.clay, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  box: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, marginTop: spacing.md },
  boxLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing.sm },
  quote: { fontFamily: fonts.display, fontSize: 17, color: colors.espresso, lineHeight: 24, marginBottom: spacing.sm },
  quotePage: { fontFamily: fonts.body, fontSize: 11, color: colors.clay },
  highlight: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  highlightText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.espresso, lineHeight: 20 },
  review: { fontFamily: fonts.display, fontSize: 17, color: colors.espresso, lineHeight: 24, marginBottom: 6 },
  lesson: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso, lineHeight: 21 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.pill, backgroundColor: colors.chambray, marginTop: spacing.xl },
  shareText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.creme },
  premiumHint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.chambray, textDecorationLine: 'underline' },
  msg: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, textAlign: 'center', marginTop: spacing.md, lineHeight: 19 },
  // carte 1080×1920 — palette de marque fixe (indépendante du mode sombre)
  card: { width: 1080, height: 1920, backgroundColor: brand.glacier, padding: 84, justifyContent: 'space-between' },
  cardBrand: { fontFamily: fonts.displayMedium, fontSize: 64, color: brand.espresso },
  cardBrandSub: { fontFamily: fonts.bodyMedium, fontSize: 22, color: brand.clay, letterSpacing: 5, textTransform: 'uppercase', marginTop: 6 },
  cardKicker: { fontFamily: fonts.bodyMedium, fontSize: 24, color: brand.chambray, letterSpacing: 4, textTransform: 'uppercase' },
  cardTitle: { fontFamily: fonts.displayMedium, fontSize: 68, color: brand.espresso, lineHeight: 76, marginTop: 10 },
  cardAuthor: { fontFamily: fonts.body, fontSize: 32, color: brand.clay, marginTop: 10 },
  cardStat: { flex: 1, backgroundColor: brand.creme, borderRadius: 24, padding: 30, alignItems: 'center' },
  cardStatValue: { fontFamily: fonts.displayMedium, fontSize: 60, color: brand.espresso },
  cardStatLabel: { fontFamily: fonts.bodyMedium, fontSize: 22, color: brand.clay, letterSpacing: 3, textTransform: 'uppercase', marginTop: 4 },
  cardLabel: { fontFamily: fonts.bodyMedium, fontSize: 22, color: brand.clay, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 },
  cardQuote: { fontFamily: fonts.display, fontSize: 44, color: brand.espresso, lineHeight: 58 },
  cardReview: { fontFamily: fonts.body, fontSize: 30, color: brand.espresso, lineHeight: 44 },
  cardWatermark: { fontFamily: fonts.bodyMedium, fontSize: 26, color: brand.clay, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.7 },
  cardFoot: { fontFamily: fonts.bodyMedium, fontSize: 22, color: brand.clay, letterSpacing: 5, textTransform: 'uppercase' },
});
