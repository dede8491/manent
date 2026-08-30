import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, Alert, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { StudySheet } from '@/src/components/StudySheet';
import { toBase64 } from '@/src/image';
import { buildSheetHtml } from '@/src/sheetPdf';
import { api } from '@/src/api';

export default function BookDetail() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<any>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [rating, setRating] = useState(0);
  const [recap, setRecap] = useState('');
  const [newLesson, setNewLesson] = useState('');
  const [lessons, setLessons] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectedPage, setDetectedPage] = useState<number | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [fc, setFc] = useState<{ total: number; due: number } | null>(null);
  const [generating, setGenerating] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      const b = await api<any>(`/books/${id}`); setBook(b);
      setRating(b.rating || 0); setRecap(b.recap || ''); setLessons(b.lessons || []);
      const q = await api<{ quotes: Quote[] }>(`/quotes?book_id=${id}`);
      setQuotes(q.quotes);
      if (b.type === 'etude') {
        try {
          const f = await api<{ total: number; due: number }>(`/flashcards?book_id=${id}`);
          setFc({ total: f.total, due: f.due });
        } catch {}
      }
    })();
  }, [id]));

  const saveField = async (patch: any) => { await api(`/books/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); };
  const addLesson = async () => {
    if (!newLesson.trim()) return;
    const next = [...lessons, newLesson.trim()];
    setLessons(next); setNewLesson('');
    await saveField({ lessons: next });
  };

  // ---- Progression par photo de page (Claude Vision) ----
  const openCameraSettings = () => {
    Alert.alert(
      "Accès à l'appareil photo",
      'Autorise la caméra dans les réglages pour photographier ta page.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Ouvrir les réglages', onPress: () => Linking.openSettings() },
      ],
    );
  };

  const photoProgress = async () => {
    let res: ImagePicker.ImagePickerResult;
    if (Platform.OS === 'web') {
      res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    } else {
      const current = await ImagePicker.getCameraPermissionsAsync();
      if (!current.granted) {
        if (!current.canAskAgain) { openCameraSettings(); return; }
        const req = await ImagePicker.requestCameraPermissionsAsync();
        if (!req.granted) { if (!req.canAskAgain) openCameraSettings(); return; }
      }
      res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    }
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setDetecting(true);
    try {
      const b64 = await toBase64(res.assets[0].uri);
      const r = await api<{ page_number: number }>('/vision', { method: 'POST', body: JSON.stringify({ image_base64: b64, mode: 'page_number' }) });
      setDetectedPage(r.page_number > 0 ? r.page_number : -1);
    } catch {
      setDetectedPage(-1);
    } finally { setDetecting(false); }
  };

  const confirmDetectedPage = async () => {
    if (!detectedPage || detectedPage < 1) return;
    const patch: any = { progress_page: detectedPage };
    if (book.pages && detectedPage >= book.pages) patch.status = 'termine';
    else if (book.status === 'a_lire') patch.status = 'en_cours';
    const b = await api<any>(`/books/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    setBook(b);
    setDetectedPage(null);
  };

  // ---- Export PDF de la fiche (Premium) ----
  const exportPdf = async () => {
    setExportingPdf(true);
    try {
      const st = await api<{ is_premium: boolean }>('/premium/status');
      if (!st.is_premium) {
        router.push('/premium');
        return;
      }
      const fresh = await api<any>(`/books/${id}`);
      const html = buildSheetHtml(fresh, quotes);
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
          w.focus();
          setTimeout(() => w.print(), 600);
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Fiche d’études PDF' });
        }
      }
    } catch {
      Alert.alert('Export impossible', 'La génération du PDF a échoué. Réessaie.');
    } finally { setExportingPdf(false); }
  };

  // ---- Flashcards ----
  const generateCards = async () => {
    setGenerating(true);
    try {
      await api(`/books/${id}/flashcards/generate`, { method: 'POST' });
      const f = await api<{ total: number; due: number }>(`/flashcards?book_id=${id}`);
      setFc({ total: f.total, due: f.due });
    } catch {
      Alert.alert('Génération impossible', 'Réessaie dans un instant.');
    } finally { setGenerating(false); }
  };

  if (!book) return <View style={{ flex: 1, backgroundColor: colors.glacier }} />;
  const isWattpad = book.type === 'wattpad';
  const isEtude = book.type === 'etude';
  const total = isWattpad ? book.chapters : book.pages;
  const prog = isWattpad ? book.progress_chapter : book.progress_page;
  const pct = total && prog ? Math.min(100, Math.round((prog / total) * 100)) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-book-detail">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="book-back" style={styles.iconBtn}><Feather name="chevron-left" size={22} color={colors.espresso} /></Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{book.title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={styles.top}>
          <View style={styles.cover}><Text style={styles.coverInitial}>{(book.title[0] || 'M').toUpperCase()}</Text></View>
          <View style={{ flex: 1, gap: 4 }}>
            {isWattpad ? <Text style={styles.badge}>HISTOIRE WATTPAD</Text> : isEtude ? <Text style={styles.badge}>ÉTUDES</Text> : null}
            <Text style={styles.title}>{book.title}</Text>
            {book.author ? <Text style={styles.author}>{book.author}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
              {[1,2,3,4,5].map(i => (
                <Pressable key={i} testID={`star-${i}`} onPress={async () => { setRating(i); await saveField({ rating: i }); }}>
                  <Feather name="star" size={18} color={colors.chambray} style={{ opacity: i <= rating ? 1 : 0.3 }} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {total ? (
          <View style={{ marginTop: spacing.lg }}>
            <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${pct}%` }]} /></View>
            <Text style={styles.progressText}>{prog || 0} / {total} {isWattpad ? 'chap.' : 'p.'} · {pct}%</Text>
          </View>
        ) : null}

        {!isWattpad && (
          <View style={{ marginTop: spacing.md }}>
            {detectedPage === null ? (
              <Pressable testID="btn-photo-page" onPress={photoProgress} disabled={detecting} style={styles.photoBtn}>
                {detecting
                  ? <ActivityIndicator size="small" color={colors.creme} />
                  : <Feather name="camera" size={16} color={colors.creme} />}
                <Text style={styles.photoBtnText}>{detecting ? 'Analyse de la page…' : 'Photographier ma dernière page lue'}</Text>
              </Pressable>
            ) : detectedPage === -1 ? (
              <View style={styles.detectBox}>
                <Text style={styles.detectText}>Aucun numéro de page détecté. Réessaie avec une photo nette du coin de la page.</Text>
                <Pressable testID="btn-page-close" onPress={() => setDetectedPage(null)} style={[styles.detectGhost, { marginTop: spacing.sm }]}>
                  <Text style={styles.detectGhostText}>Fermer</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.detectBox} testID="page-detected-box">
                <Text style={styles.detectText}>Page détectée : <Text style={styles.detectNum}>{detectedPage}</Text></Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
                  <Pressable testID="btn-page-confirm" onPress={confirmDetectedPage} style={styles.detectConfirm}>
                    <Text style={styles.photoBtnText}>Mettre à jour</Text>
                  </Pressable>
                  <Pressable testID="btn-page-cancel" onPress={() => setDetectedPage(null)} style={styles.detectGhost}>
                    <Text style={styles.detectGhostText}>Annuler</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}

        {isEtude && (
          <>
            <Text style={styles.sectionLabel}>Fiche scolaire</Text>
            <StudySheet key={book.book_id} sheet={book.sheet} onSave={(s) => saveField({ sheet: s })} />
            <Pressable testID="btn-export-pdf" onPress={exportPdf} disabled={exportingPdf} style={styles.pdfBtn}>
              {exportingPdf
                ? <ActivityIndicator size="small" color={colors.espresso} />
                : <Feather name="file-text" size={16} color={colors.espresso} />}
              <Text style={styles.pdfBtnText}>{exportingPdf ? 'Génération…' : 'Exporter la fiche en PDF'}</Text>
            </Pressable>

            <Text style={styles.sectionLabel}>Flashcards de révision</Text>
            <View style={styles.fcBox} testID="flashcards-box">
              <Text style={styles.fcCount}>
                {fc ? `${fc.total} carte${fc.total > 1 ? 's' : ''} · ${fc.due} à réviser` : 'Chargement…'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
                <Pressable testID="btn-generate-cards" onPress={generateCards} disabled={generating || quotes.length === 0} style={[styles.fcGhost, (generating || quotes.length === 0) && { opacity: 0.5 }]}>
                  {generating
                    ? <ActivityIndicator size="small" color={colors.espresso} />
                    : <Text style={styles.fcGhostText}>Générer avec l&rsquo;IA</Text>}
                </Pressable>
                <Pressable testID="btn-review-cards" onPress={() => router.push({ pathname: '/flashcards/[bookId]', params: { bookId: String(id) } })} disabled={!fc || fc.due === 0} style={[styles.fcPrimary, (!fc || fc.due === 0) && { opacity: 0.5 }]}>
                  <Text style={styles.fcPrimaryText}>Réviser{fc && fc.due > 0 ? ` (${fc.due})` : ''}</Text>
                </Pressable>
              </View>
              {quotes.length === 0 && (
                <Text style={styles.fcHint}>Capture d&rsquo;abord des citations de ce livre — l&rsquo;IA les transformera en questions de révision.</Text>
              )}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>Mon récapitulatif</Text>
        <TextInput
          testID="book-recap"
          value={recap} onChangeText={setRecap}
          onEndEditing={() => saveField({ recap })}
          placeholder="Ce que ce livre te laisse en tête…"
          placeholderTextColor={colors.clay}
          style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
          multiline
        />

        <Text style={styles.sectionLabel}>Enseignements tirés</Text>
        <View style={{ gap: 8 }}>
          {lessons.map((l, i) => (
            <View key={i} style={styles.lessonRow}>
              <View style={styles.bullet} />
              <Text style={styles.lessonText}>{l}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput testID="book-new-lesson" value={newLesson} onChangeText={setNewLesson} placeholder="Ajoute un enseignement…" placeholderTextColor={colors.clay} style={[styles.input, { flex: 1 }]} />
            <Pressable testID="btn-add-lesson" onPress={addLesson} style={styles.plusBtn}><Feather name="plus" size={20} color={colors.creme} /></Pressable>
          </View>
        </View>

        {!isWattpad && (
          <>
            <Text style={styles.sectionLabel}>Où trouver ce livre</Text>
            <View style={{ gap: 8 }}>
              {[
                { name: 'Librairies indépendantes', tag: 'leslibraires.fr', url: `https://www.leslibraires.fr/recherche/?q=${encodeURIComponent(book.isbn || `${book.title} ${book.author || ''}`.trim())}` },
                { name: 'Fnac', tag: 'fnac.com', url: `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${encodeURIComponent(book.isbn || `${book.title} ${book.author || ''}`.trim())}` },
                { name: 'Amazon', tag: 'amazon.fr', url: `https://www.amazon.fr/s?k=${encodeURIComponent(book.isbn || `${book.title} ${book.author || ''}`.trim())}` },
              ].map(l => (
                <Pressable key={l.name} testID={`store-${l.tag}`} onPress={() => Linking.openURL(l.url)} style={styles.linkRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linkName}>{l.name}</Text>
                    <Text style={styles.linkTag}>{l.tag}  ·  LIEN AFFILIÉ</Text>
                  </View>
                  <Feather name="external-link" size={18} color={colors.chambray} />
                </Pressable>
              ))}
              <Text style={styles.linkNote}>Commission reversée à Manent, sans surcoût pour toi.</Text>
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>Citations du livre ({quotes.length})</Text>
        {quotes.length === 0 ? (
          <Text style={styles.emptyQuotes}>Aucune citation pour l'instant. Utilise la capture pour en ajouter.</Text>
        ) : quotes.map(q => (
          <QuoteCard key={q.quote_id} quote={q} onPress={() => router.push({ pathname: '/quote/[id]', params: { id: q.quote_id } })} />
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso, flex: 1, textAlign: 'center', marginHorizontal: spacing.md },
  top: { flexDirection: 'row', gap: spacing.md },
  cover: { width: 96, height: 144, borderRadius: radius.sm, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  coverInitial: { fontFamily: fonts.displayMedium, fontSize: 54, color: colors.espresso },
  badge: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.creme, backgroundColor: colors.clay, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, letterSpacing: 1 },
  title: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  author: { fontFamily: fonts.body, fontSize: 14, color: colors.clay },
  progressBar: { height: 4, backgroundColor: colors.borderSoft, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.chambray },
  progressText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1, marginTop: 4, textTransform: 'uppercase' },
  photoBtn: { height: 48, borderRadius: radius.md, backgroundColor: colors.chambray, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
  detectBox: { padding: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft },
  detectText: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso, lineHeight: 20 },
  detectNum: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.chambray },
  detectConfirm: { flex: 1, height: 44, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  detectGhost: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  detectGhostText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.espresso },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, marginTop: spacing.md },
  pdfBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.espresso },
  fcBox: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  fcCount: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1, textTransform: 'uppercase' },
  fcGhost: { flex: 1, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glacier },
  fcGhostText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso },
  fcPrimary: { flex: 1, height: 46, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  fcPrimaryText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme },
  fcHint: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: spacing.sm, lineHeight: 17 },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, backgroundColor: colors.creme },
  lessonRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 4 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.chambray, marginTop: 8 },
  lessonText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, lineHeight: 22 },
  plusBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft },
  linkName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.espresso },
  linkTag: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1.5, marginTop: 2, textTransform: 'uppercase' },
  linkNote: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 4, fontStyle: 'italic' },
  emptyQuotes: { fontFamily: fonts.body, fontSize: 14, color: colors.clay },
});
