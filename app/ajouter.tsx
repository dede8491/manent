import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View,
} from 'react-native';

import { Button, Card, Field, Pill, ScreenHeader, Segmented, Text } from '@/components';
import { lookupIsbn, searchBooks, type BookMetadata } from '@/services/googleBooks';
import { importStory, isWattpadUrl, type WattpadStory } from '@/services/wattpad';
import { useStore } from '@/store/useStore';
import { colors, radii, spacing } from '@/theme';
import type { BookKind, BookStatus } from '@/types';

type Method = 'isbn' | 'titre' | 'wattpad';

const METHODS: { value: Method; label: string }[] = [
  { value: 'isbn', label: '📷 ISBN' },
  { value: 'titre', label: '🔍 Titre' },
  { value: 'wattpad', label: '🧡 Wattpad' },
];

const STATUSES: { value: BookStatus; label: string }[] = [
  { value: 'a-lire', label: 'À lire' },
  { value: 'en-cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
];

/** Métadonnées détectées, quelle que soit la méthode d'entrée. */
interface Detected extends BookMetadata {
  kind: BookKind;
  wattpadUrl?: string | null;
  chapters?: number;
  genre?: string | null;
}

export default function AjouterLecture() {
  const router = useRouter();
  const params = useLocalSearchParams<{ methode?: Method }>();
  const addBook = useStore((s) => s.addBook);

  const [method, setMethod] = useState<Method>(params.methode ?? 'isbn');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<BookMetadata[]>([]);
  const [wattpadUrl, setWattpadUrl] = useState('');
  const [detected, setDetected] = useState<Detected | null>(null);
  const [status, setStatus] = useState<BookStatus>('en-cours');
  const [studyMode, setStudyMode] = useState(false);
  const [schoolLevel, setSchoolLevel] = useState('');
  const [examDate, setExamDate] = useState('');

  const fail = (message: string) => Alert.alert('Impossible pour l’instant', message);

  const onBarcode = useCallback(
    async ({ data }: { data: string }) => {
      if (busy) return;
      setScanning(false);
      setBusy(true);
      try {
        const meta = await lookupIsbn(data);
        if (!meta) {
          fail(`Aucun livre trouvé pour l'ISBN ${data}. Essaie la recherche par titre.`);
          return;
        }
        setDetected({ ...meta, kind: 'papier' });
      } catch {
        fail('La recherche Google Books a échoué. Vérifie ta connexion.');
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const startScan = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        fail("Autorise l'appareil photo pour scanner un code-barres ISBN.");
        return;
      }
    }
    setScanning(true);
  };

  const runSearch = async () => {
    if (term.trim().length < 2) return;
    setBusy(true);
    try {
      setResults(await searchBooks(term));
    } catch {
      fail('La recherche Google Books a échoué. Vérifie ta connexion.');
    } finally {
      setBusy(false);
    }
  };

  const runWattpadImport = async () => {
    if (!isWattpadUrl(wattpadUrl)) {
      fail('Colle un lien wattpad.com valide, par exemple https://www.wattpad.com/story/…');
      return;
    }
    setBusy(true);
    try {
      const story: WattpadStory = await importStory(wattpadUrl);
      setDetected({
        ...story,
        kind: 'wattpad',
        wattpadUrl: story.url,
        chapters: story.chapters,
        genre: story.genre,
      });
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!detected) return;
    const isWattpad = detected.kind === 'wattpad';
    const book = addBook({
      kind: isWattpad ? 'wattpad' : studyMode ? 'etude' : 'papier',
      title: detected.title,
      author: detected.author,
      isbn: detected.isbn,
      wattpadUrl: detected.wattpadUrl ?? null,
      coverUrl: detected.coverUrl,
      totalUnits: isWattpad ? (detected.chapters || null) : detected.pageCount,
      status,
      genre: detected.genre ?? null,
      schoolLevel: studyMode && schoolLevel.trim() ? schoolLevel.trim() : null,
      examDate: studyMode && examDate.trim() ? examDate.trim() : null,
    });
    router.replace(`/livre/${book.id}`);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Ajouter une lecture" backLabel="Fermer" />

        <Segmented options={METHODS} value={method} onChange={(m) => { setMethod(m); setDetected(null); }} />

        <View style={styles.section}>
          {method === 'isbn' ? (
            scanning ? (
              <View style={styles.scanner}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
                  onBarcodeScanned={onBarcode}
                />
                <View style={styles.scanFrame} />
                <Button
                  label="Annuler"
                  variant="ghost"
                  onPress={() => setScanning(false)}
                  style={styles.scanCancel}
                />
              </View>
            ) : (
              <Card>
                <Text variant="sectionTitle">Scanner le code-barres</Text>
                <Text variant="bodySoft" style={styles.cardBody}>
                  Vise le code-barres au dos du livre : Manent récupère le titre, l’auteur, la
                  couverture et le nombre de pages.
                </Text>
                <Button label="📷 Ouvrir le scanner" onPress={startScan} loading={busy} />
              </Card>
            )
          ) : method === 'titre' ? (
            <>
              <Field
                label="Titre ou auteur"
                value={term}
                onChangeText={setTerm}
                onSubmitEditing={runSearch}
                placeholder="Le Rouge et le Noir"
                returnKeyType="search"
              />
              <Button label="Rechercher" onPress={runSearch} loading={busy} />
              <View style={styles.results}>
                {results.map((r, i) => (
                  <Card key={`${r.title}-${i}`} onPress={() => setDetected({ ...r, kind: 'papier' })}>
                    <View style={styles.resultRow}>
                      {r.coverUrl ? (
                        <Image source={{ uri: r.coverUrl }} style={styles.thumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.thumb, styles.thumbFallback]}>
                          <Text style={styles.thumbInitial}>{r.title.charAt(0)}</Text>
                        </View>
                      )}
                      <View style={styles.resultInfo}>
                        <Text variant="label" numberOfLines={2}>
                          {r.title}
                        </Text>
                        <Text variant="small">{r.author}</Text>
                        {r.pageCount ? <Text variant="small">{r.pageCount} pages</Text> : null}
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            </>
          ) : (
            <>
              <Field
                label="Lien de l'histoire"
                value={wattpadUrl}
                onChangeText={setWattpadUrl}
                placeholder="https://www.wattpad.com/story/…"
                autoCapitalize="none"
                keyboardType="url"
                hint="Wattpad n'a pas d'API publique : on lit les informations de la page."
              />
              <Button label="Importer l'histoire" variant="wattpad" onPress={runWattpadImport} loading={busy} />
            </>
          )}
        </View>

        {detected ? (
          <Card style={styles.confirm}>
            <Text variant="overline">DÉTECTÉ</Text>
            <View style={styles.detectedRow}>
              {detected.coverUrl ? (
                <Image source={{ uri: detected.coverUrl }} style={styles.cover} contentFit="cover" />
              ) : (
                <View style={[styles.cover, styles.thumbFallback]}>
                  <Text style={styles.thumbInitial}>{detected.title.charAt(0)}</Text>
                </View>
              )}
              <View style={styles.detectedInfo}>
                <Text variant="sectionTitle">{detected.title}</Text>
                <Text variant="small">{detected.author}</Text>
                {detected.kind === 'wattpad' ? (
                  <Pill label={`${detected.chapters ?? '?'} chapitres`} bg={colors.wattpadPale} fg={colors.wattpad} />
                ) : detected.pageCount ? (
                  <Text variant="small">{detected.pageCount} pages</Text>
                ) : null}
              </View>
            </View>

            <Text variant="overline" style={styles.label}>
              STATUT
            </Text>
            <Segmented options={STATUSES} value={status} onChange={setStatus} />

            {detected.kind !== 'wattpad' ? (
              <>
                <Text variant="overline" style={styles.label}>
                  MODE
                </Text>
                <Segmented
                  options={[
                    { value: 'perso', label: '🌿 Lecture perso' },
                    { value: 'etudes', label: '🎓 Pour mes études' },
                  ]}
                  value={studyMode ? 'etudes' : 'perso'}
                  onChange={(v) => setStudyMode(v === 'etudes')}
                  tone={studyMode ? colors.study : colors.green}
                />
                {studyMode ? (
                  <View style={styles.studyFields}>
                    <Field
                      label="Niveau"
                      value={schoolLevel}
                      onChangeText={setSchoolLevel}
                      placeholder="Programme 1re"
                    />
                    <Field
                      label="Date d'examen"
                      value={examDate}
                      onChangeText={setExamDate}
                      placeholder="2026-06-12"
                      hint="Format AAAA-MM-JJ. Sert au compte à rebours et aux flashcards."
                    />
                  </View>
                ) : null}
              </>
            ) : null}

            <Button
              label="Ajouter à ma bibliothèque"
              variant={detected.kind === 'wattpad' ? 'wattpad' : studyMode ? 'study' : 'primary'}
              onPress={confirm}
              style={styles.addBtn}
            />
          </Card>
        ) : null}

        {busy && !scanning ? <ActivityIndicator color={colors.green} style={styles.loader} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  section: { marginTop: spacing.lg },
  cardBody: { marginTop: spacing.xs, marginBottom: spacing.lg },
  scanner: {
    height: 300,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: '70%',
    height: 120,
    borderWidth: 2,
    borderColor: colors.amber,
    borderRadius: radii.md,
  },
  scanCancel: { position: 'absolute', bottom: spacing.md, alignSelf: 'center' },
  results: { marginTop: spacing.lg },
  resultRow: { flexDirection: 'row' },
  thumb: { width: 44, height: 64, borderRadius: radii.sm, marginRight: spacing.md },
  thumbFallback: { backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  thumbInitial: { fontSize: 22, color: colors.white },
  resultInfo: { flex: 1 },
  confirm: { marginTop: spacing.lg, borderColor: colors.green },
  detectedRow: { flexDirection: 'row', marginTop: spacing.sm, marginBottom: spacing.lg },
  cover: { width: 60, height: 90, borderRadius: radii.sm, marginRight: spacing.md },
  detectedInfo: { flex: 1, gap: 4 },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
  studyFields: { marginTop: spacing.lg },
  addBtn: { marginTop: spacing.xl },
  loader: { marginTop: spacing.lg },
});
