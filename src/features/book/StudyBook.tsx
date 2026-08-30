import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  Button, Card, Field, Pill, ProgressBar, QuoteSheet, Screen, ScreenHeader,
  SectionHeader, Text,
} from '@/components';
import { daysUntil, formatDay, percent, plural } from '@/lib/format';
import { exportBookSheetPdf } from '@/features/book/exportPdf';
import { generateFlashcards } from '@/services/flashcards';
import { useStore } from '@/store/useStore';
import { colors, radii, spacing } from '@/theme';
import type { Book, Quote, StudySheetSection } from '@/types';

export function StudyBook({ book, quotes }: { book: Book; quotes: Quote[] }) {
  const router = useRouter();
  const updateStudySection = useStore((s) => s.updateStudySection);
  const clubs = useStore((s) => s.clubs);
  const premium = useStore((s) => s.user.premium);
  const [open, setOpen] = useState<StudySheetSection['key'] | null>(null);

  const done = book.studySheet.filter((s) => s.done).length;
  const completion = percent(done, book.studySheet.length);
  const classClub = clubs.find((c) => c.id === book.classClubId);

  const exportPdf = () => {
    if (!premium) {
      Alert.alert(
        'Export PDF — Premium',
        'Exporter ta fiche de lecture en PDF fait partie de Manent Premium.',
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

      <Card style={styles.head}>
        <View style={styles.badgeRow}>
          <Pill
            label={`🎓 ${book.schoolLevel ?? 'Œuvre au programme'}`}
            bg={colors.studyPale}
            fg={colors.study}
          />
          {book.examDate ? (
            <Pill
              label={`oral le ${formatDay(book.examDate)}`}
              bg={colors.amberPale}
              fg={colors.amber}
            />
          ) : null}
        </View>
        {book.examDate ? (
          <Text variant="bodySoft" style={styles.countdown}>
            Dans {plural(daysUntil(book.examDate), 'jour', 'jours')}.
          </Text>
        ) : null}

        <Text variant="overline" style={styles.label}>
          FICHE DE LECTURE · {completion} % COMPLÉTÉE
        </Text>
        <ProgressBar value={done} total={book.studySheet.length} color={colors.study} />
      </Card>

      <SectionHeader title="Fiche de lecture" />
      {book.studySheet.map((section) => {
        const isOpen = open === section.key;
        return (
          <Card key={section.key} style={styles.section}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              onPress={() => setOpen(isOpen ? null : section.key)}
              style={styles.sectionHead}
            >
              <Text variant="label" style={styles.sectionTitle}>
                {section.label}
              </Text>
              <Text variant="small" color={section.done ? colors.green : colors.amber}>
                {section.done ? '✅ fait' : '✍️ à compléter'}
              </Text>
            </Pressable>

            {isOpen ? (
              <View style={styles.sectionBody}>
                <Field
                  value={section.content}
                  onChangeText={(v) => updateStudySection(book.id, section.key, v)}
                  multiline
                  placeholder="Écris ta fiche ici…"
                />
              </View>
            ) : section.content ? (
              <Text variant="small" numberOfLines={2} style={styles.preview}>
                {section.content}
              </Text>
            ) : null}
          </Card>
        );
      })}

      <SectionHeader title="Flashcards de révision" />
      <Flashcards bookId={book.id} />

      {classClub ? (
        <>
          <SectionHeader title="Groupe de classe" />
          <Card onPress={() => router.push(`/club/${classClub.id}`)}>
            <Text variant="sectionTitle" color={colors.study}>
              {classClub.name}
            </Text>
            <Text variant="small">
              {classClub.memberCount} membres · animé par {classClub.hostPseudo}
            </Text>
            {classClub.events[0] ? (
              <Text variant="body" style={styles.classEvent}>
                📌 {classClub.events[0].title} pour {formatDay(classClub.events[0].startsAt)} :{' '}
                {classClub.events[0].scope}
              </Text>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionHeader title={`Citations clés (${quotes.length})`} />
      {quotes.map((q) => (
        <QuoteSheet
          key={q.id}
          text={q.text}
          locator={q.locator}
          bookTitle={book.title}
          bookAuthor={book.author}
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
        label={premium ? '📄 Exporter ma fiche en PDF' : '📄 Exporter ma fiche en PDF · Premium'}
        variant="study"
        onPress={exportPdf}
        style={styles.export}
      />
      <Text variant="small" center style={styles.exportHint}>
        Le PDF reprend la fiche complète et tes citations — le devoir à rendre.
      </Text>
    </Screen>
  );
}

/** Répétition espacée : tap pour retourner, « À revoir » / « Je sais ». */
function Flashcards({ bookId }: { bookId: string }) {
  const cards = useStore((s) => s.flashcards);
  const review = useStore((s) => s.reviewFlashcard);
  const addFlashcards = useStore((s) => s.addFlashcards);
  const premium = useStore((s) => s.user.premium);
  const router = useRouter();

  const deck = useMemo(() => cards.filter((c) => c.bookId === bookId), [cards, bookId]);
  const limit = premium ? deck.length : Math.min(deck.length, 3);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);

  /** Fabrique des cartes depuis la fiche et les citations déjà saisies. */
  const generate = async () => {
    setGenerating(true);
    try {
      const added = addFlashcards(bookId, await generateFlashcards(bookId));
      Alert.alert(
        added > 0 ? 'Cartes ajoutées' : 'Rien de nouveau',
        added > 0
          ? `${added} carte(s) fabriquée(s) à partir de ta fiche et de tes citations.`
          : 'Toutes les cartes proposées étaient déjà dans ton paquet.',
      );
    } catch (error) {
      Alert.alert(
        'Génération impossible',
        error instanceof Error ? error.message : 'Réessaie dans un moment.',
      );
    } finally {
      setGenerating(false);
    }
  };

  const generateButton = (
    <Button
      label={generating ? 'Génération…' : '✨ Générer des cartes depuis ma fiche'}
      variant="dashed"
      loading={generating}
      onPress={generate}
      style={styles.generate}
    />
  );

  if (deck.length === 0) {
    return (
      <Card>
        <Text variant="bodySoft" style={styles.emptyDeck}>
          Les flashcards se fabriquent à partir de ta fiche et de tes citations. Complète une
          rubrique ou capture une citation, puis lance la génération.
        </Text>
        {generateButton}
      </Card>
    );
  }

  const card = deck[index % Math.max(1, limit)];
  const answer = (known: boolean) => {
    review(card.id, known);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  return (
    <>
      <Card
        onPress={() => setFlipped((f) => !f)}
        accessibilityLabel={flipped ? 'Réponse, taper pour revenir à la question' : 'Question, taper pour retourner'}
        style={[styles.flashcard, flipped && styles.flashcardBack]}
      >
        <Text variant="overline" color={flipped ? colors.amber : colors.study}>
          {flipped ? 'RÉPONSE' : `QUESTION ${(index % limit) + 1} / ${limit}`}
        </Text>
        <Text variant="quote" style={styles.flashText}>
          {flipped ? card.answer : card.question}
        </Text>
        <Text variant="small" center style={styles.flashHint}>
          {flipped ? '' : 'Tape la carte pour retourner'}
        </Text>
      </Card>

      {flipped ? (
        <View style={styles.flashActions}>
          <Button label="🔁 À revoir" variant="secondary" full={false} onPress={() => answer(false)} />
          <Button label="✓ Je sais" full={false} onPress={() => answer(true)} />
        </View>
      ) : null}

      {!premium && deck.length > limit ? (
        <Text variant="small" center style={styles.flashLimit}>
          {deck.length - limit} carte(s) de plus avec Premium ·{' '}
          <Text variant="small" color={colors.green} onPress={() => router.push('/premium')}>
            découvrir
          </Text>
        </Text>
      ) : null}

      {generateButton}
    </>
  );
}

const styles = StyleSheet.create({
  head: { borderColor: colors.studyPale },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  countdown: { marginTop: spacing.sm },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
  section: { paddingVertical: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { flex: 1, paddingRight: spacing.sm },
  sectionBody: { marginTop: spacing.md },
  preview: { marginTop: spacing.sm },
  classEvent: { marginTop: spacing.sm },
  flashcard: { minHeight: 170, justifyContent: 'center', borderColor: colors.study, borderRadius: radii.lg },
  flashcardBack: { backgroundColor: colors.studyPale, borderColor: colors.study },
  flashText: { marginTop: spacing.md, marginBottom: spacing.md },
  flashHint: { color: colors.muted },
  flashActions: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  flashLimit: { marginTop: spacing.md },
  emptyDeck: { marginBottom: spacing.md },
  generate: { marginTop: spacing.md },
  export: { marginTop: spacing.xl },
  exportHint: { marginTop: spacing.sm },
});
