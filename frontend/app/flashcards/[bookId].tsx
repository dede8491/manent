import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { PrimaryButton } from '@/src/components/Button';
import { useT } from '@/src/i18n';

type Card = { card_id: string; question: string; answer: string; due: string };

export default function FlashcardsReview() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ cards: Card[] }>(`/flashcards?book_id=${bookId}`);
        const now = Date.now();
        const due = r.cards.filter(c => new Date(c.due).getTime() <= now);
        setQueue(due);
      } catch { setQueue([]); }
    })();
  }, [bookId]);

  const current = queue && index < queue.length ? queue[index] : null;
  const grade = async (g: 'again' | 'hard' | 'good' | 'easy') => {
    if (!current || !queue) return;
    api(`/flashcards/${current.card_id}/review`, { method: 'POST', body: JSON.stringify({ grade: g }) }).catch(() => {});
    setRevealed(false);
    if (g === 'again') {
      // on remet la carte en fin de session
      setQueue([...queue.slice(0, index), ...queue.slice(index + 1), current]);
    } else {
      setDone(d => d + 1);
      setIndex(i => i + 1);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-flashcards">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="fc-back" style={styles.iconBtn}>
          <Feather name="x" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Révision')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {queue === null ? (
        <View style={styles.center}><ActivityIndicator color={colors.chambray} /></View>
      ) : !current ? (
        <View style={styles.center} testID="fc-done">
          <Feather name="check-circle" size={40} color={colors.chambray} />
          <Text style={styles.doneTitle}>{done > 0 ? t('Session terminée.') : t('Rien à réviser pour le moment.')}</Text>
          <Text style={styles.doneSub}>
            {done > 0
              ? t(done > 1 ? '{n} cartes révisées. Les prochaines reviendront au bon moment.' : '{n} carte révisée. Les prochaines reviendront au bon moment.', { n: done })
              : t('Reviens quand tes cartes seront dues — la répétition espacée fait le reste.')}
          </Text>
          <View style={{ width: '100%', marginTop: spacing.xl }}>
            <PrimaryButton testID="fc-close" title={t('Retour au livre')} onPress={() => router.back()} />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, padding: spacing.xl }}>
          <Text style={styles.progress}>{done + 1} / {done + (queue.length - index)}</Text>
          <Pressable testID="fc-card" onPress={() => setRevealed(true)} style={styles.card}>
            <Text style={styles.cardLabel}>{revealed ? t('RÉPONSE') : t('QUESTION')}</Text>
            <Text style={styles.cardText}>{revealed ? current.answer : current.question}</Text>
            {!revealed && (
              <Text style={styles.tapHint}>{t('Touche la carte pour révéler la réponse')}</Text>
            )}
          </Pressable>

          {revealed ? (
            <View style={styles.gradeRow}>
              {([
                ['again', 'Encore', colors.clay],
                ['hard', 'Difficile', colors.espresso],
                ['good', 'Bien', colors.chambray],
                ['easy', 'Facile', colors.chambray],
              ] as const).map(([g, label, color]) => (
                <Pressable key={g} testID={`fc-grade-${g}`} onPress={() => grade(g)} style={[styles.gradeBtn, { borderColor: color }, (g === 'good' || g === 'easy') && { backgroundColor: color }]}>
                  <Text style={[styles.gradeText, { color }, (g === 'good' || g === 'easy') && { color: colors.creme }]}>{t(label)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable testID="fc-reveal" onPress={() => setRevealed(true)} style={styles.revealBtn}>
              <Text style={styles.revealText}>{t('Voir la réponse')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  doneTitle: { fontFamily: fonts.displayMedium, fontSize: 26, color: colors.espresso, marginTop: spacing.md, textAlign: 'center' },
  doneSub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  progress: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.md },
  card: { flex: 1, backgroundColor: colors.bisque, borderRadius: radius.lg, padding: spacing.xl, justifyContent: 'center' },
  cardLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 2, position: 'absolute', top: spacing.lg, left: spacing.xl },
  cardText: { fontFamily: fonts.display, fontSize: 22, color: colors.espresso, lineHeight: 32 },
  tapHint: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, position: 'absolute', bottom: spacing.lg, alignSelf: 'center' },
  revealBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  revealText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.creme },
  gradeRow: { flexDirection: 'row', gap: 8, marginTop: spacing.lg },
  gradeBtn: { flex: 1, height: 54, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  gradeText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
});
