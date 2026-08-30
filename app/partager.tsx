import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  Button, EmptyState, Pill, Screen, ScreenHeader, Segmented, ShareQuoteCard, Text,
} from '@/components';
import type { ShareFormat } from '@/components/ShareQuoteCard';
import {
  copyLink, publicQuoteUrl, renderCard, saveToPhotos, shareImage, shareTo,
} from '@/services/share';
import { useStore } from '@/store/useStore';
import { colors, quoteCardStyles, spacing, type QuoteCardStyleKey } from '@/theme';

const FORMATS: { value: ShareFormat | 'lien'; label: string }[] = [
  { value: 'post', label: '◼️ Post carré' },
  { value: 'story', label: '📱 Story' },
  { value: 'lien', label: '🔗 Lien' },
];

const STYLE_KEYS = Object.keys(quoteCardStyles) as QuoteCardStyleKey[];

export default function PartagerCitation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const quote = useStore((s) => s.quotes.find((q) => q.id === id));
  const book = useStore((s) => s.books.find((b) => b.id === quote?.bookId));
  const premium = useStore((s) => s.user.premium);

  const cardRef = useRef<View>(null);
  const [format, setFormat] = useState<ShareFormat | 'lien'>('post');
  const [styleKey, setStyleKey] = useState<QuoteCardStyleKey>('encre');
  const [busy, setBusy] = useState(false);

  if (!quote) {
    return (
      <Screen>
        <ScreenHeader title="Partager" backLabel="Fermer" />
        <EmptyState emoji="🕯" title="Citation introuvable" body="Elle a peut-être été supprimée." />
      </Screen>
    );
  }

  const previewWidth = Math.min(width - spacing.lg * 2, 340);
  const isLink = format === 'lien';
  const caption = `« ${quote.text} » — ${book?.title ?? ''}, ${book?.author ?? ''}`;

  const withCard = async (action: (uri: string) => Promise<void>, successMessage?: string) => {
    setBusy(true);
    try {
      const uri = await renderCard(cardRef);
      await action(uri);
      if (successMessage) Alert.alert(successMessage);
    } catch {
      Alert.alert('Partage impossible', "L'image n'a pas pu être générée. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Partager la citation" backLabel="Fermer" />

      <Segmented options={FORMATS} value={format} onChange={setFormat} />

      {isLink ? (
        <View style={styles.linkBlock}>
          <Text variant="body" style={styles.linkText}>
            Ta citation a une page web publique, lisible sans compte — c’est la porte d’entrée
            vers Manent pour celles et ceux à qui tu l’envoies.
          </Text>
          <Text variant="label" color={colors.green} style={styles.url}>
            {publicQuoteUrl(quote.id)}
          </Text>
          <Button
            label="🔗 Copier le lien"
            onPress={() => copyLink(publicQuoteUrl(quote.id), 'Lien copié')}
          />
          {!quote.isPublic ? (
            <Text variant="small" style={styles.privateWarning}>
              Cette citation est privée : la page ne sera visible qu’après l’avoir passée en
              publique.
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          <Text variant="overline" style={styles.label}>
            STYLE
          </Text>
          <View style={styles.styleRow}>
            {STYLE_KEYS.map((key) => (
              <Button
                key={key}
                label={quoteCardStyles[key].label}
                variant={styleKey === key ? 'primary' : 'secondary'}
                small
                full={false}
                onPress={() => setStyleKey(key)}
                style={styles.styleBtn}
              />
            ))}
          </View>

          <ScrollView
            horizontal={false}
            contentContainerStyle={styles.previewWrap}
            showsVerticalScrollIndicator={false}
          >
            <ShareQuoteCard
              ref={cardRef}
              text={quote.text}
              locator={quote.locator}
              locatorLabel={book?.kind === 'wattpad' ? 'CHAP.' : 'PAGE'}
              bookTitle={book?.title ?? 'Lecture'}
              bookAuthor={book?.author ?? ''}
              styleKey={styleKey}
              format={format}
              watermark={!premium}
              width={previewWidth}
            />
          </ScrollView>

          {!premium ? (
            <Pill
              label="Filigrane retiré avec Premium"
              bg={colors.amberPale}
              fg={colors.amber}
              style={styles.watermarkNote}
            />
          ) : null}

          <Text variant="overline" style={styles.label}>
            ENVOYER VERS
          </Text>
          <Button
            label="WhatsApp"
            icon="💬"
            variant="secondary"
            loading={busy}
            onPress={() => withCard((uri) => shareTo('whatsapp', uri, caption))}
            style={styles.destination}
          />
          <Button
            label="Instagram"
            icon="📸"
            variant="secondary"
            loading={busy}
            onPress={() => withCard((uri) => shareTo('instagram', uri, caption))}
            style={styles.destination}
          />
          <Button
            label="Enregistrer dans les photos"
            icon="⬇️"
            variant="secondary"
            loading={busy}
            onPress={() =>
              withCard(async (uri) => {
                await saveToPhotos(uri);
              }, 'Image enregistrée')
            }
            style={styles.destination}
          />
          <Button
            label="Autres applications"
            icon="↗"
            loading={busy}
            onPress={() => withCard((uri) => shareImage(uri, caption))}
            style={styles.destination}
          />
          <Button
            label="🔗 Copier le lien"
            variant="ghost"
            onPress={() => copyLink(publicQuoteUrl(quote.id), 'Lien copié')}
          />
        </>
      )}

      {!premium ? (
        <Button
          label="Passer en Premium"
          variant="secondary"
          onPress={() => router.push('/premium')}
          style={styles.premium}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: spacing.xl, marginBottom: spacing.sm },
  styleRow: { flexDirection: 'row', gap: spacing.sm },
  styleBtn: { flex: 1 },
  previewWrap: { alignItems: 'center', paddingVertical: spacing.xl },
  watermarkNote: { alignSelf: 'center' },
  destination: { marginBottom: spacing.sm },
  linkBlock: { marginTop: spacing.xl },
  linkText: { marginBottom: spacing.md },
  url: { marginBottom: spacing.lg },
  privateWarning: { marginTop: spacing.md },
  premium: { marginTop: spacing.xl },
});
