import { useRouter } from 'expo-router';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';

import {
  Button, Card, Field, Pill, ProgressBar, QuoteSheet, Screen, ScreenHeader,
  SectionHeader, Text,
} from '@/components';
import { percent } from '@/lib/format';
import { useStore } from '@/store/useStore';
import { colors, spacing } from '@/theme';
import type { Book, Quote } from '@/types';

export function WattpadBook({ book, quotes }: { book: Book; quotes: Quote[] }) {
  const router = useRouter();
  const updateBook = useStore((s) => s.updateBook);
  const setProgress = useStore((s) => s.setProgress);

  const total = book.totalUnits ?? 0;

  const openWattpad = () => {
    if (!book.wattpadUrl) return;
    Linking.openURL(book.wattpadUrl).catch(() =>
      Alert.alert('Lien indisponible', "L'histoire n'a pas pu être ouverte."),
    );
  };

  return (
    <Screen>
      <ScreenHeader title={book.title} subtitle={book.author} />

      <Card style={styles.head}>
        <View style={styles.badges}>
          <Pill label="🧡 Histoire Wattpad" bg={colors.wattpadPale} fg={colors.wattpad} />
          {book.genre ? <Pill label={book.genre} /> : null}
        </View>

        <Text variant="overline" style={styles.label}>
          PROGRESSION PAR CHAPITRE
        </Text>
        <ProgressBar value={book.progressUnits} total={total || null} color={colors.wattpad} height={10} />
        <Text variant="small" style={styles.progressText}>
          chap. {book.progressUnits} / {total || '?'} · {percent(book.progressUnits, total || null)} %
        </Text>

        <View style={styles.chapterRow}>
          <Button
            label="− 1 chapitre"
            variant="secondary"
            small
            full={false}
            onPress={() => setProgress(book.id, Math.max(0, book.progressUnits - 1))}
          />
          <Button
            label="Chapitre suivant +1"
            variant="wattpad"
            small
            full={false}
            onPress={() => setProgress(book.id, book.progressUnits + 1)}
          />
        </View>

        <Button
          label="📖 Continuer sur Wattpad"
          variant="wattpad"
          onPress={openWattpad}
          style={styles.continueBtn}
        />

        <View style={styles.notifyRow}>
          <View style={styles.notifyText}>
            <Text variant="label">🔔 M’alerter des nouveaux chapitres</Text>
            <Text variant="small">Une notification dès qu’un chapitre est publié.</Text>
          </View>
          <Switch
            value={book.notifyNewChapters}
            onValueChange={(notifyNewChapters) => updateBook(book.id, { notifyNewChapters })}
            trackColor={{ true: colors.wattpad, false: colors.rule }}
            thumbColor={colors.white}
          />
        </View>
      </Card>

      <SectionHeader title="Mon récapitulatif" />
      <Field
        value={book.summary}
        onChangeText={(summary) => updateBook(book.id, { summary })}
        multiline
        placeholder="Ce que tu retiens de cette histoire…"
      />

      <SectionHeader title={`Citations (${quotes.length})`} />
      {quotes.map((q) => (
        <QuoteSheet
          key={q.id}
          text={q.text}
          locator={q.locator}
          bookTitle={book.title}
          bookAuthor={book.author}
          bookKind="wattpad"
          themes={q.themes}
          note={q.note}
          isPrivate={!q.isPublic}
          onPress={() => router.push(`/citation/${q.id}`)}
        />
      ))}
      <Button
        label="+ Capturer depuis une capture d'écran"
        variant="dashed"
        onPress={() => router.push(`/capture?bookId=${book.id}`)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { borderColor: colors.wattpadPale },
  badges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  label: { marginBottom: spacing.sm },
  progressText: { marginTop: spacing.sm },
  chapterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  continueBtn: { marginTop: spacing.lg },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  notifyText: { flex: 1, paddingRight: spacing.md },
});
