import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, View,
} from 'react-native';

import { Button, Chip, Field, Pill, ScreenHeader, Segmented, Text } from '@/components';
import { normalizeTheme } from '@/lib/format';
import { OCR_FALLBACK_MESSAGE, transcribe } from '@/services/ocr';
import { toBase64 } from '@/services/share';
import { FREE_MONTHLY_CAPTURES, useStore } from '@/store/useStore';
import { colors, radii, spacing } from '@/theme';
import type { Visibility } from '@/types';

export default function Capture() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId?: string }>();

  const books = useStore((s) => s.books);
  const user = useStore((s) => s.user);
  const addQuote = useStore((s) => s.addQuote);
  const setProgress = useStore((s) => s.setProgress);
  const consumeCapture = useStore((s) => s.consumeCapture);
  const remaining = useStore((s) => s.remainingCaptures());

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [bookId, setBookId] = useState<string | null>(params.bookId ?? null);
  const [locator, setLocator] = useState('');
  const [themeInput, setThemeInput] = useState('');
  const [themes, setThemes] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<Visibility>(user.defaultQuoteVisibility);
  const [busy, setBusy] = useState(false);

  const book = books.find((b) => b.id === bookId) ?? null;
  const isWattpad = book?.kind === 'wattpad';
  const locatorLabel = isWattpad ? 'Numéro de chapitre' : 'Numéro de page';
  const canSave = text.trim().length > 2;

  /** Lance l'OCR sur l'image choisie ; en cas d'échec, on garde la saisie manuelle. */
  const runOcr = async (uri: string) => {
    setImageUri(uri);
    if (remaining <= 0) {
      Alert.alert(
        'Quota de transcriptions atteint',
        `Le plan gratuit inclut ${FREE_MONTHLY_CAPTURES} transcriptions par mois. Tu peux saisir la citation à la main, ou passer en Premium pour un usage illimité.`,
        [
          { text: 'Saisir à la main', style: 'cancel' },
          { text: 'Voir Premium', onPress: () => router.push('/premium') },
        ],
      );
      return;
    }
    setBusy(true);
    try {
      const base64 = await toBase64(uri);
      const result = await transcribe(base64, 'citation');
      setText(result.text.trim());
      if (result.detectedPage != null && !locator) setLocator(String(result.detectedPage));
      consumeCapture();
    } catch {
      Alert.alert('Transcription impossible', OCR_FALLBACK_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  const shoot = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Appareil photo indisponible', "Autorise Manent à utiliser l'appareil photo.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, exif: false });
    if (!res.canceled && res.assets[0]) await runOcr(res.assets[0].uri);
  };

  const fromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos indisponibles', 'Autorise Manent à accéder à tes photos.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      mediaTypes: ['images'],
    });
    if (!res.canceled && res.assets[0]) await runOcr(res.assets[0].uri);
  };

  const addTheme = () => {
    const t = normalizeTheme(themeInput);
    if (!t) return;
    if (!themes.includes(t)) setThemes([...themes, t]);
    setThemeInput('');
  };

  const save = () => {
    const parsedLocator = locator.trim() ? Number(locator.trim()) : null;
    if (locator.trim() && Number.isNaN(parsedLocator)) {
      Alert.alert('Numéro invalide', `Le ${locatorLabel.toLowerCase()} doit être un nombre.`);
      return;
    }

    addQuote({
      text: text.trim(),
      locator: parsedLocator,
      note: note.trim(),
      themes,
      // La photo d'origine reste privée : droit de courte citation.
      sourceImageUri: imageUri,
      isPublic: visibility === 'publique',
      bookId: bookId ?? '',
    });

    // Si la page capturée dépasse la progression enregistrée, on propose la mise à jour.
    if (book && parsedLocator != null && parsedLocator > book.progressUnits) {
      const unit = isWattpad ? 'chap.' : 'p.';
      Alert.alert(
        'Mettre à jour ta progression ?',
        `Tu as capturé la ${unit} ${parsedLocator}, ta progression est à la ${unit} ${book.progressUnits}.`,
        [
          { text: 'Plus tard', style: 'cancel', onPress: () => router.back() },
          {
            text: `Oui, ${unit} ${parsedLocator}`,
            onPress: () => {
              setProgress(book.id, parsedLocator);
              router.back();
            },
          },
        ],
      );
      return;
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Capturer une citation"
          backLabel="Fermer"
          action="Enregistrer"
          onAction={save}
          actionDisabled={!canSave}
        />

        {remaining !== Infinity ? (
          <Pill
            label={`${remaining} transcription${remaining > 1 ? 's' : ''} IA restante${remaining > 1 ? 's' : ''} ce mois-ci`}
            bg={remaining > 3 ? colors.greenPale : colors.amberPale}
            fg={remaining > 3 ? colors.green : colors.amber}
            style={styles.quota}
          />
        ) : null}

        <View style={styles.sources}>
          <Pressable style={styles.source} onPress={shoot} accessibilityRole="button">
            <Text style={styles.sourceIcon}>📷</Text>
            <Text variant="label" center>
              Photographier la page
            </Text>
          </Pressable>
          <Pressable style={styles.source} onPress={fromLibrary} accessibilityRole="button">
            <Text style={styles.sourceIcon}>🖼</Text>
            <Text variant="label" center>
              Depuis mes photos
            </Text>
            <Text variant="small" center>
              captures Wattpad incluses
            </Text>
          </Pressable>
        </View>

        {imageUri ? (
          <View style={styles.preview}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
            <View style={styles.previewInfo}>
              {busy ? (
                <View style={styles.busy}>
                  <ActivityIndicator color={colors.green} />
                  <Text variant="small" style={styles.busyText}>
                    Transcription en cours…
                  </Text>
                </View>
              ) : (
                <Text variant="small">
                  🔒 La photo reste privée : seule la citation transcrite peut être partagée.
                </Text>
              )}
            </View>
          </View>
        ) : null}

        <Field
          label="Citation"
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Écris ou colle ta citation ici…"
          hint="Le texte transcrit est modifiable — corrige-le librement."
        />

        <Text variant="overline" style={styles.fieldLabel}>
          LIVRE DE RATTACHEMENT
        </Text>
        <View style={styles.chips}>
          {books.map((b) => (
            <Chip
              key={b.id}
              label={b.title}
              selected={bookId === b.id}
              tone={b.kind === 'wattpad' ? 'wattpad' : b.kind === 'etude' ? 'study' : 'green'}
              onPress={() => setBookId(bookId === b.id ? null : b.id)}
            />
          ))}
          <Chip label="＋ Scanner l'ISBN" onPress={() => router.push('/ajouter?methode=isbn')} />
        </View>

        <View style={styles.spacer} />
        <Field
          label={locatorLabel}
          value={locator}
          onChangeText={setLocator}
          keyboardType="number-pad"
          placeholder={isWattpad ? '12' : '187'}
        />

        <Text variant="overline" style={styles.fieldLabel}>
          THÈMES
        </Text>
        <View style={styles.themeRow}>
          <View style={styles.themeField}>
            <Field
              value={themeInput}
              onChangeText={setThemeInput}
              onSubmitEditing={addTheme}
              placeholder="résilience"
              autoCapitalize="none"
              returnKeyType="done"
            />
          </View>
          <Button label="Ajouter" variant="secondary" small full={false} onPress={addTheme} style={styles.themeAdd} />
        </View>
        <View style={styles.chips}>
          {themes.map((t) => (
            <Chip key={t} label={`#${t} ✕`} selected onPress={() => setThemes(themes.filter((x) => x !== t))} />
          ))}
        </View>

        <View style={styles.spacer} />
        <Field
          label="Note personnelle"
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Pourquoi cette phrase te reste ?"
        />

        <Text variant="overline" style={styles.fieldLabel}>
          VISIBILITÉ
        </Text>
        <Segmented
          options={[
            { value: 'privee', label: '🔒 Privée' },
            { value: 'publique', label: '🌍 Publique' },
          ]}
          value={visibility}
          onChange={setVisibility}
        />
        <Text variant="small" style={styles.visibilityHint}>
          {visibility === 'privee'
            ? "Visible de toi seule. Tu peux quand même l'épingler sur tes tableaux privés."
            : 'Publiée avec le titre et l’auteur de l’œuvre, comme l’exige le droit de courte citation.'}
        </Text>

        <Button label="Enregistrer la citation" disabled={!canSave} onPress={save} style={styles.save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  quota: { marginBottom: spacing.md },
  sources: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  source: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.green,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  sourceIcon: { fontSize: 26, marginBottom: spacing.sm },
  preview: { flexDirection: 'row', marginBottom: spacing.lg, alignItems: 'center' },
  previewImage: { width: 64, height: 84, borderRadius: radii.sm, backgroundColor: colors.rule },
  previewInfo: { flex: 1, marginLeft: spacing.md },
  busy: { flexDirection: 'row', alignItems: 'center' },
  busyText: { marginLeft: spacing.sm },
  fieldLabel: { marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  spacer: { height: spacing.md },
  themeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  themeField: { flex: 1 },
  themeAdd: { marginLeft: spacing.sm, marginTop: 1 },
  visibilityHint: { marginTop: spacing.sm },
  save: { marginTop: spacing.xl },
});
