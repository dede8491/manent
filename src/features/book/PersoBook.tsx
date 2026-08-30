import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import {
  Button, Card, Field, Pill, ProgressBar, QuoteSheet, Screen, ScreenHeader,
  SectionHeader, Segmented, StarRating, Text,
} from '@/components';
import { percent } from '@/lib/format';
import { AFFILIATE_DISCLOSURE, affiliateLinks, LANG_LAW_NOTICE } from '@/services/affiliate';
import { exportBookSheetPdf } from '@/features/book/exportPdf';
import { useStore } from '@/store/useStore';
import { colors, radii, spacing } from '@/theme';
import type { Book, BookStatus, Quote } from '@/types';

const STATUSES: { value: BookStatus; label: string }[] = [
  { value: 'a-lire', label: 'À lire' },
  { value: 'en-cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
];

export function PersoBook({ book, quotes }: { book: Book; quotes: Quote[] }) {
  const router = useRouter();
  const updateBook = useStore((s) => s.updateBook);
  const setProgress = useStore((s) => s.setProgress);
  const addLesson = useStore((s) => s.addLesson);
  const removeLesson = useStore((s) => s.removeLesson);
  const removeBook = useStore((s) => s.removeBook);
  const premium = useStore((s) => s.user.premium);

  const [lesson, setLesson] = useState('');
  const [pageInput, setPageInput] = useState(String(book.progressUnits));

  const links = affiliateLinks({ title: book.title, author: book.author, isbn: book.isbn });

  const openLink = (url: string, label: string) => {
    Alert.alert(
      `Acheter chez ${label}`,
      `${AFFILIATE_DISCLOSURE}\n\n${LANG_LAW_NOTICE}`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Continuer', onPress: () => Linking.openURL(url).catch(() => {}) },
      ],
    );
  };

  const confirmDelete = () =>
    Alert.alert('Retirer ce livre ?', 'Ses citations seront supprimées aussi. Action définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => {
          removeBook(book.id);
          router.replace('/(tabs)/bibliotheque');
        },
      },
    ]);

  const exportPdf = () => {
    if (!premium) {
      Alert.alert(
        'Export PDF — Premium',
        "L'export de fiche en PDF fait partie de Manent Premium.",
        [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Découvrir Premium', onPress: () => router.push('/premium') },
        ],
      );
      return;
    }
    exportBookSheetPdf(book, quotes).catch(() =>
      Alert.alert('Export impossible', "Le PDF n'a pas pu être généré."),
    );
  };

  return (
    <Screen>
      <ScreenHeader title={book.title} subtitle={book.author} />

      <Card>
        <View style={styles.ratingRow}>
          <StarRating value={book.rating} onChange={(rating) => updateBook(book.id, { rating })} size={26} />
          {book.genre ? <Pill label={book.genre} /> : null}
        </View>

        <Text variant="overline" style={styles.label}>
          STATUT
        </Text>
        <Segmented
          options={STATUSES}
          value={book.status}
          onChange={(status) => updateBook(book.id, { status })}
        />

        {book.totalUnits ? (
          <View style={styles.progressBlock}>
            <ProgressBar value={book.progressUnits} total={book.totalUnits} />
            <View style={styles.progressRow}>
              <Text variant="small">
                p. {book.progressUnits} / {book.totalUnits} ·{' '}
                {percent(book.progressUnits, book.totalUnits)} %
              </Text>
            </View>
            <View style={styles.pageRow}>
              <View style={styles.pageField}>
                <Field
                  value={pageInput}
                  onChangeText={setPageInput}
                  keyboardType="number-pad"
                  placeholder="Page"
                />
              </View>
              <Button
                label="Mettre à jour"
                variant="secondary"
                small
                full={false}
                onPress={() => {
                  const n = Number(pageInput);
                  if (Number.isNaN(n)) return;
                  setProgress(book.id, n);
                }}
                style={styles.pageBtn}
              />
            </View>
          </View>
        ) : null}
      </Card>

      <SectionHeader title="Mon récapitulatif" />
      <Field
        value={book.summary}
        onChangeText={(summary) => updateBook(book.id, { summary })}
        multiline
        placeholder="Ce que ce livre m'a fait, en quelques lignes…"
      />

      <SectionHeader title="Enseignements tirés" />
      <Card>
        {book.lessons.length === 0 ? (
          <Text variant="bodySoft" style={styles.emptyLessons}>
            Rien encore. Note ce que tu veux garder de ce livre dans un an.
          </Text>
        ) : (
          book.lessons.map((l, i) => (
            <View key={`${l}-${i}`} style={styles.lesson}>
              <Text style={styles.bullet}>•</Text>
              <Text variant="body" style={styles.lessonText}>
                {l}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Supprimer cet enseignement"
                onPress={() => removeLesson(book.id, i)}
                hitSlop={8}
              >
                <Text variant="small" color={colors.brick}>
                  ✕
                </Text>
              </Pressable>
            </View>
          ))
        )}
        <View style={styles.lessonAdd}>
          <View style={styles.lessonField}>
            <Field
              value={lesson}
              onChangeText={setLesson}
              placeholder="Ajouter un enseignement…"
              onSubmitEditing={() => {
                if (lesson.trim()) addLesson(book.id, lesson);
                setLesson('');
              }}
            />
          </View>
          <Button
            label="Ajouter"
            variant="secondary"
            small
            full={false}
            onPress={() => {
              if (lesson.trim()) addLesson(book.id, lesson);
              setLesson('');
            }}
            style={styles.lessonBtn}
          />
        </View>
      </Card>

      <SectionHeader title="Où trouver ce livre" />
      <Card>
        {links.map((link) => (
          <Pressable
            key={link.merchant}
            accessibilityRole="link"
            accessibilityLabel={`${link.label}, ${link.price}, lien affilié`}
            onPress={() => openLink(link.url, link.label)}
            style={styles.merchant}
          >
            <View style={styles.merchantInfo}>
              <Text variant="label">{link.label}</Text>
              <Text variant="small">{link.note}</Text>
            </View>
            <View style={styles.merchantRight}>
              <Text variant="label" color={colors.green}>
                {link.price}
              </Text>
              <Pill label="lien affilié" bg={colors.amberPale} fg={colors.amber} />
            </View>
          </Pressable>
        ))}
        <Text variant="small" style={styles.disclosure}>
          {LANG_LAW_NOTICE} {AFFILIATE_DISCLOSURE}
        </Text>
      </Card>

      <SectionHeader title={`Citations (${quotes.length})`} />
      {quotes.map((q) => (
        <QuoteSheet
          key={q.id}
          text={q.text}
          locator={q.locator}
          bookTitle={book.title}
          bookAuthor={book.author}
          bookKind={book.kind}
          themes={q.themes}
          note={q.note}
          isPrivate={!q.isPublic}
          onPress={() => router.push(`/citation/${q.id}`)}
        />
      ))}
      <Button
        label="+ Capturer une citation"
        variant="dashed"
        onPress={() => router.push(`/capture?bookId=${book.id}`)}
      />

      <Button
        label={premium ? '📄 Exporter la fiche en PDF' : '📄 Exporter la fiche en PDF · Premium'}
        variant="secondary"
        onPress={exportPdf}
        style={styles.export}
      />
      <Button label="Retirer ce livre" variant="danger" onPress={confirmDelete} style={styles.delete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
  progressBlock: { marginTop: spacing.lg },
  progressRow: { marginTop: spacing.sm },
  pageRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.md },
  pageField: { flex: 1 },
  pageBtn: { marginLeft: spacing.sm, marginTop: 1 },
  emptyLessons: { marginBottom: spacing.md },
  lesson: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  bullet: { color: colors.amber, marginRight: spacing.sm, fontSize: 18, lineHeight: 22 },
  lessonText: { flex: 1 },
  lessonAdd: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm },
  lessonField: { flex: 1 },
  lessonBtn: { marginLeft: spacing.sm, marginTop: 1 },
  merchant: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  merchantInfo: { flex: 1, paddingRight: spacing.md },
  merchantRight: { alignItems: 'flex-end', gap: 4 },
  disclosure: { marginTop: spacing.md },
  export: { marginTop: spacing.xl, borderRadius: radii.lg },
  delete: { marginTop: spacing.md },
});
