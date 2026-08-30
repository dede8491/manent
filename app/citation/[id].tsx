import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, EmptyState, Screen, ScreenHeader, Text } from '@/components';
import { copyLink, publicQuoteUrl } from '@/services/share';
import { useStore } from '@/store/useStore';
import { colors, fonts, radii, spacing } from '@/theme';

export default function DetailCitation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const quote = useStore((s) => s.quotes.find((q) => q.id === id));
  const book = useStore((s) => s.books.find((b) => b.id === quote?.bookId));
  const boards = useStore((s) => s.boards);
  const pins = useStore((s) => s.pins);
  const togglePin = useStore((s) => s.togglePin);
  const removeQuote = useStore((s) => s.removeQuote);

  const [pinnerOpen, setPinnerOpen] = useState(false);

  if (!quote) {
    return (
      <Screen>
        <ScreenHeader title="Citation" />
        <EmptyState emoji="🕯" title="Citation introuvable" body="Elle a peut-être été supprimée." />
      </Screen>
    );
  }

  const isWattpad = book?.kind === 'wattpad';
  const locatorLabel = isWattpad ? 'CHAP.' : 'PAGE';

  const confirmDelete = () =>
    Alert.alert('Supprimer cette citation ?', 'Action définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          removeQuote(quote.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen background={colors.paper}>
      <ScreenHeader title="Citation" />

      <View style={styles.hero}>
        <Text style={styles.mark}>“</Text>
        <Text style={styles.quoteText}>{quote.text}</Text>

        <View style={styles.heroFooter}>
          <View style={styles.heroSource}>
            <Text style={styles.heroTitle}>{book?.title ?? 'Lecture'}</Text>
            <Text style={styles.heroAuthor}>{book?.author ?? ''}</Text>
          </View>
          {quote.locator != null ? (
            <View style={styles.heroLocator}>
              <Text style={styles.heroLocatorLabel}>{locatorLabel}</Text>
              <Text style={styles.heroLocatorValue}>{quote.locator}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {quote.themes.length > 0 ? (
        <View style={styles.themes}>
          {quote.themes.map((t) => (
            <Chip key={t} label={`#${t}`} onPress={() => router.push(`/theme/${encodeURIComponent(t)}`)} />
          ))}
        </View>
      ) : null}

      {quote.note ? (
        <Card>
          <Text variant="overline">MA NOTE</Text>
          <Text variant="body" style={styles.note}>
            {quote.note}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text variant="overline">VISIBILITÉ</Text>
        <Text variant="body" style={styles.note}>
          {quote.isPublic
            ? '🌍 Publique — visible dans le fil et sur ta page manent.app.'
            : '🔒 Privée — visible de toi seule.'}
        </Text>
        {quote.sourceImageUri ? (
          <Text variant="small" style={styles.photoNote}>
            La photo d’origine reste privée dans tous les cas : seul le texte transcrit circule.
          </Text>
        ) : null}
      </Card>

      <Button
        label="Partager en image"
        icon="🖼"
        onPress={() => router.push(`/partager?id=${quote.id}`)}
        style={styles.action}
      />
      <Button
        label="📌 Épingler sur un tableau"
        variant="secondary"
        onPress={() => setPinnerOpen(true)}
        style={styles.action}
      />
      <Button
        label="🔗 Copier le lien"
        variant="secondary"
        onPress={() => copyLink(publicQuoteUrl(quote.id), 'Lien de la citation copié')}
        style={styles.action}
      />
      <Button label="Supprimer" variant="danger" onPress={confirmDelete} style={styles.action} />

      <Modal visible={pinnerOpen} animationType="slide" transparent onRequestClose={() => setPinnerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPinnerOpen(false)} accessibilityRole="button">
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text variant="sectionTitle" style={styles.sheetTitle}>
              Épingler sur…
            </Text>
            <ScrollView style={styles.sheetList}>
              {boards.map((b) => {
                const pinned = pins.some((p) => p.boardId === b.id && p.quoteId === quote.id);
                return (
                  <Pressable
                    key={b.id}
                    accessibilityRole="button"
                    onPress={() => togglePin(b.id, quote.id)}
                    style={styles.boardRow}
                  >
                    <View style={styles.boardInfo}>
                      <Text variant="label" color={colors.green}>
                        {b.name}
                      </Text>
                      <Text variant="small">
                        {b.visibility === 'prive' ? '🔒 privé' : b.visibility === 'public' ? '🌍 public' : '👥 collaboratif'}
                      </Text>
                    </View>
                    <Text variant="label" color={pinned ? colors.green : colors.muted}>
                      {pinned ? '✓ épinglée' : '＋'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button
              label="+ Nouveau tableau"
              variant="dashed"
              onPress={() => {
                setPinnerOpen(false);
                router.push('/tableau/nouveau');
              }}
            />
            <Button label="Terminé" variant="ghost" onPress={() => setPinnerOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.ink,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    minHeight: 300,
  },
  mark: { fontFamily: fonts.serifBlack, fontSize: 64, lineHeight: 66, color: colors.amber },
  quoteText: {
    fontFamily: fonts.serifSemi,
    fontSize: 23,
    lineHeight: 33,
    color: colors.paper,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.inkSoft,
    paddingTop: spacing.md,
  },
  heroSource: { flex: 1, paddingRight: spacing.md },
  heroTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.paper },
  heroAuthor: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 2 },
  heroLocator: { alignItems: 'flex-end' },
  heroLocatorLabel: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.4, color: colors.amber },
  heroLocatorValue: { fontFamily: fonts.serifBlack, fontSize: 30, color: colors.amber },
  themes: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  note: { marginTop: spacing.xs, fontStyle: 'italic' },
  photoNote: { marginTop: spacing.sm },
  action: { marginBottom: spacing.sm },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    maxHeight: '75%',
  },
  sheetTitle: { marginBottom: spacing.md },
  sheetList: { marginBottom: spacing.md },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  boardInfo: { flex: 1 },
});
