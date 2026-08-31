import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { PrimaryButton, GhostButton } from '@/src/components/Button';
import { api } from '@/src/api';
import ManentLoader from '@/src/components/ManentLoader';
import { useT } from '@/src/i18n';

type Method = 'title' | 'isbn' | 'wattpad';

// Couverture avec repli élégant sur l'initiale du titre si l'image manque ou échoue
function Cover({ uri, title, style, emptyStyle, initialStyle }: { uri?: string | null; title?: string; style: any; emptyStyle: any; initialStyle: any }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[style, emptyStyle]}>
        <Text style={initialStyle}>{(title?.trim()?.[0] || 'M').toUpperCase()}</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setFailed(true)} />;
}

export default function AddBook() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ title?: string; author?: string; cover?: string; q?: string; isbn?: string; pages?: string; year?: string }>();
  const [method, setMethod] = useState<Method>('title');
  const selectedRef = useRef(false);

  // Préremplissage depuis une suggestion (page thème, recherche accueil)
  useEffect(() => {
    if (params.title && !selectedRef.current) {
      selectedRef.current = true;
      setSelected({
        title: params.title,
        author: params.author || null,
        cover: params.cover || null,
        isbn: params.isbn || null,
        pages: params.pages ? parseInt(String(params.pages), 10) || null : null,
        year: params.year || null,
      });
    }
    if (params.q && !selectedRef.current) {
      selectedRef.current = true;
      setQuery(String(params.q));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.title, params.q]);

  // Recherche par titre en direct
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<any>(null);

  // Sélection + confirmation
  const [selected, setSelected] = useState<any | null>(null);
  const [status, setStatus] = useState<'a_lire' | 'en_cours' | 'termine'>('en_cours');
  const [mode, setMode] = useState<'perso' | 'etudes'>('perso');
  const [saving, setSaving] = useState(false);

  // Scanner ISBN
  const [permission, requestPermission] = useCameraPermissions();
  const [permDenied, setPermDenied] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [scanFail, setScanFail] = useState<string | null>(null);
  const [manualIsbn, setManualIsbn] = useState(false);
  const [isbnInput, setIsbnInput] = useState('');
  const scannedRef = useRef(false);

  // Saisie manuelle (titre introuvable)
  const [manualBook, setManualBook] = useState(false);
  const [mTitle, setMTitle] = useState('');
  const [mAuthor, setMAuthor] = useState('');
  const [mPages, setMPages] = useState('');

  // Wattpad
  const [wattpadUrl, setWattpadUrl] = useState('');
  const [wLoading, setWLoading] = useState(false);
  const [wError, setWError] = useState(false);

  // Recherche en direct (debounce 400 ms)
  useEffect(() => {
    if (method !== 'title') return;
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api<{ results: any[] }>(`/books/search?q=${encodeURIComponent(query.trim())}`);
        setResults(r.results);
      } catch { setResults([]); }
      setSearched(true);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer.current);
  }, [query, method]);

  const startScan = async () => {
    setScanFail(null);
    if (Platform.OS === 'web') { setManualIsbn(true); return; }
    if (!permission?.granted) {
      if (permission && !permission.canAskAgain) { setPermDenied(true); setManualIsbn(true); return; }
      const r = await requestPermission();
      if (!r.granted) {
        if (!r.canAskAgain) setPermDenied(true);
        setManualIsbn(true);
        return;
      }
    }
    scannedRef.current = false;
    setScanning(true);
  };

  const onBarcode = async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    const code = String(data || '').replace(/[^0-9]/g, '');
    if (!/^97[89]\d{10}$/.test(code)) return;
    scannedRef.current = true;
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setScanning(false);
    await lookupIsbn(code);
  };

  const lookupIsbn = async (code: string) => {
    setLookingUp(true); setScanFail(null);
    try {
      const r = await api<any>(`/books/search/isbn?isbn=${encodeURIComponent(code)}`);
      setSelected(r);
      setManualIsbn(false);
    } catch {
      setScanFail(code);
    } finally { setLookingUp(false); }
  };

  const fetchWattpad = async () => {
    if (!wattpadUrl.trim()) return;
    setWLoading(true); setWError(false);
    try {
      const r = await api<any>(`/wattpad/scrape?url=${encodeURIComponent(wattpadUrl.trim())}`);
      setSelected({ ...r, type: 'wattpad' });
    } catch { setWError(true); }
    finally { setWLoading(false); }
  };

  const confirmManualBook = () => {
    if (!mTitle.trim()) return;
    setSelected({ title: mTitle.trim(), author: mAuthor.trim() || null, pages: mPages ? parseInt(mPages, 10) : null, manual: true });
    setManualBook(false);
  };

  const add = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const isWattpad = selected.type === 'wattpad';
      const b = await api<any>('/books', {
        method: 'POST',
        body: JSON.stringify({
          type: isWattpad ? 'wattpad' : (mode === 'etudes' ? 'etude' : 'papier'),
          title: selected.title,
          author: selected.author,
          isbn: selected.isbn,
          wattpad_url: selected.wattpad_url,
          cover: selected.cover,
          pages: selected.pages,
          year: selected.year,
          chapters: selected.chapters,
          status, mode,
        }),
      });
      router.replace({ pathname: '/book/[id]', params: { id: b.book_id } });
    } finally { setSaving(false); }
  };

  const isWattpadSel = selected?.type === 'wattpad';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-add-book">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="add-close" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.h1}>{t('Ajouter une lecture')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        {selected ? (
          <>
            <View style={styles.confirmCard} testID="confirm-card">
              <Cover uri={selected.cover} title={selected.title} style={styles.confirmCover} emptyStyle={styles.confirmCoverEmpty} initialStyle={styles.confirmInitial} />
              <View style={{ flex: 1 }}>
                {isWattpadSel ? <Text style={styles.confirmBadge}>{t('HISTOIRE WATTPAD')}</Text> : null}
                <Text style={styles.confirmTitle}>{selected.title || t('Sans titre')}</Text>
                {!!selected.author && <Text style={styles.confirmAuthor}>{selected.author}</Text>}
                <Text style={styles.confirmMeta}>
                  {[selected.pages ? t('{n} pages', { n: selected.pages }) : null, selected.chapters ? t('{n} chapitres', { n: selected.chapters }) : null, selected.year || null].filter(Boolean).join('  ·  ') || t('Détails à compléter plus tard')}
                </Text>
              </View>
            </View>
            <Pressable testID="confirm-change" onPress={() => setSelected(null)} style={styles.changeRow}>
              <Feather name="rotate-ccw" size={13} color={colors.clay} />
              <Text style={styles.changeText}>{t('Choisir un autre livre')}</Text>
            </Pressable>

            <Text style={styles.label}>{t('Statut')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['a_lire', 'À lire'], ['en_cours', 'En cours'], ['termine', 'Terminé']] as const).map(([id, lbl]) => (
                <Pressable key={id} testID={`status-${id}`} onPress={() => setStatus(id)} style={[styles.chip, status === id && styles.chipActive]}>
                  <Text style={[styles.chipText, status === id && styles.chipTextActive]}>{t(lbl)}</Text>
                </Pressable>
              ))}
            </View>

            {!isWattpadSel && (
              <>
                <Text style={styles.label}>{t('Mode')}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable testID="mode-perso" onPress={() => setMode('perso')} style={[styles.chip, mode === 'perso' && styles.chipActive]}>
                    <Text style={[styles.chipText, mode === 'perso' && styles.chipTextActive]}>{t('Lecture perso')}</Text>
                  </Pressable>
                  <Pressable testID="mode-etudes" onPress={() => setMode('etudes')} style={[styles.chip, mode === 'etudes' && styles.chipActive]}>
                    <Text style={[styles.chipText, mode === 'etudes' && styles.chipTextActive]}>{t('Pour mes études')}</Text>
                  </Pressable>
                </View>
              </>
            )}

            <View style={{ height: spacing.xl }} />
            <PrimaryButton testID="btn-add-book" title={t('Ajouter à ma bibliothèque')} onPress={add} loading={saving} />
            <GhostButton title={t('Annuler')} onPress={() => router.back()} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['title', 'isbn', 'wattpad'] as Method[]).map(m => (
                <Pressable key={m} testID={`method-${m}`} onPress={() => { setMethod(m); setScanFail(null); }} style={[styles.tab, method === m && styles.tabActive]}>
                  <Text style={[styles.tabText, method === m && styles.tabTextActive]}>{m === 'title' ? t('Titre') : m === 'isbn' ? 'ISBN' : 'Wattpad'}</Text>
                </Pressable>
              ))}
            </View>

            {method === 'title' && (
              <>
                <Text style={styles.label}>{t('Cherche un titre ou un auteur')}</Text>
                <View style={styles.searchBox}>
                  <Feather name="search" size={16} color={colors.clay} />
                  <TextInput
                    testID="add-query"
                    value={query} onChangeText={setQuery}
                    placeholder="L'Alchimiste, Coelho…"
                    placeholderTextColor={colors.clay}
                    style={styles.searchInput}
                    autoCapitalize="none"
                  />
                  {searching ? <ActivityIndicator size="small" color={colors.chambray} /> : null}
                </View>

                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  {results.map((r, i) => (
                    <Pressable key={i} testID={`result-${i}`} onPress={() => setSelected(r)} style={styles.result}>
                      <Cover uri={r.cover} title={r.title} style={styles.resultCover} emptyStyle={styles.resultCoverEmpty} initialStyle={styles.resultInitial} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultTitle} numberOfLines={2}>{r.title || t('Sans titre')}</Text>
                        <Text style={styles.resultAuthor} numberOfLines={1}>{[r.author || null, r.year || null].filter(Boolean).join('  ·  ') || '—'}</Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={colors.clay} />
                    </Pressable>
                  ))}
                </View>

                {searched && !searching && results.length === 0 && !manualBook && (
                  <View style={styles.emptyBox} testID="title-empty">
                    <Text style={styles.emptyTitle}>{t('On n’a rien trouvé pour « {q} ».', { q: query.trim() })}</Text>
                    <Text style={styles.emptySub}>{t('Pas de panique, tu peux l’ajouter toi-même — il rejoindra ta bibliothèque comme les autres.')}</Text>
                    <Pressable testID="btn-manual-book" onPress={() => { setMTitle(query.trim()); setManualBook(true); }} style={styles.manualBtn}>
                      <Text style={styles.manualBtnText}>{t('Ajouter ce livre à la main')}</Text>
                    </Pressable>
                  </View>
                )}

                {manualBook && (
                  <View style={styles.manualForm} testID="manual-form">
                    <Text style={styles.label}>{t('Titre')}</Text>
                    <TextInput testID="manual-title" value={mTitle} onChangeText={setMTitle} placeholder={t('Titre du livre')} placeholderTextColor={colors.clay} style={styles.input} />
                    <Text style={styles.label}>{t('Auteur')}</Text>
                    <TextInput testID="manual-author" value={mAuthor} onChangeText={setMAuthor} placeholder={t('Optionnel')} placeholderTextColor={colors.clay} style={styles.input} />
                    <Text style={styles.label}>{t('Nombre de pages')}</Text>
                    <TextInput testID="manual-pages" value={mPages} onChangeText={setMPages} keyboardType="number-pad" placeholder={t('Optionnel')} placeholderTextColor={colors.clay} style={styles.input} />
                    <View style={{ height: spacing.md }} />
                    <PrimaryButton testID="manual-confirm" title={t('Continuer')} onPress={confirmManualBook} disabled={!mTitle.trim()} />
                  </View>
                )}
              </>
            )}

            {method === 'isbn' && (
              <>
                {lookingUp ? (
                  <View style={styles.lookupBox}>
                    <ManentLoader size={56} />
                    <Text style={styles.lookupText}>{t('Recherche du livre…')}</Text>
                  </View>
                ) : scanFail ? (
                  <View style={styles.emptyBox} testID="isbn-fail">
                    <Text style={styles.emptyTitle}>{t('Ce livre reste introuvable.')}</Text>
                    <Text style={styles.emptySub}>{t('ISBN {code} — ni Google Books ni Open Library ne le connaissent. Essaie la recherche par titre, elle fait souvent des miracles.', { code: scanFail })}</Text>
                    <Pressable testID="btn-fail-title" onPress={() => { setMethod('title'); setScanFail(null); }} style={styles.manualBtn}>
                      <Text style={styles.manualBtnText}>{t('Chercher par titre')}</Text>
                    </Pressable>
                    <Pressable testID="btn-fail-manual" onPress={() => { setScanFail(null); setManualIsbn(true); }} style={{ marginTop: spacing.sm }}>
                      <Text style={styles.discreteLink}>{t('Saisir l’ISBN à la main')}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Pressable testID="btn-scan" onPress={startScan} style={styles.scanBtn}>
                      <Feather name="maximize" size={28} color={colors.creme} />
                      <Text style={styles.scanBtnText}>{t('Scanner le code-barres')}</Text>
                      <Text style={styles.scanBtnHint}>{t('Vise le code au dos du livre, le reste est automatique.')}</Text>
                    </Pressable>
                    {Platform.OS === 'web' && (
                      <Text style={styles.webNote}>{t('Le scan utilise la caméra du téléphone — sur le web, saisis l’ISBN ci-dessous.')}</Text>
                    )}
                    {permDenied && (
                      <View style={styles.permBox}>
                        <Text style={styles.emptySub}>{t('La caméra est désactivée pour Manent. Autorise-la dans les réglages pour scanner tes livres.')}</Text>
                        <Pressable onPress={() => Linking.openSettings()} style={{ marginTop: spacing.sm }}>
                          <Text style={styles.discreteLink}>{t('Ouvrir les réglages')}</Text>
                        </Pressable>
                      </View>
                    )}
                    {manualIsbn ? (
                      <>
                        <Text style={styles.label}>ISBN</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TextInput testID="isbn-manual-input" value={isbnInput} onChangeText={setIsbnInput} keyboardType="number-pad" placeholder="9782290004449" placeholderTextColor={colors.clay} style={[styles.input, { flex: 1 }]} />
                          <Pressable testID="btn-isbn-lookup" onPress={() => lookupIsbn(isbnInput)} disabled={isbnInput.replace(/[^0-9]/g, '').length < 10} style={[styles.goBtn, isbnInput.replace(/[^0-9]/g, '').length < 10 && { opacity: 0.5 }]}>
                            <Feather name="search" size={18} color={colors.creme} />
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <Pressable testID="isbn-manual-toggle" onPress={() => setManualIsbn(true)} style={{ marginTop: spacing.lg, alignSelf: 'center' }}>
                        <Text style={styles.discreteLink}>{t('Saisir l’ISBN à la main')}</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </>
            )}

            {method === 'wattpad' && (
              <>
                <Text style={styles.label}>{t('Lien de l’histoire')}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput testID="wattpad-url" value={wattpadUrl} onChangeText={setWattpadUrl} placeholder="https://www.wattpad.com/story/…" placeholderTextColor={colors.clay} style={[styles.input, { flex: 1 }]} autoCapitalize="none" />
                  <Pressable testID="btn-wattpad" onPress={fetchWattpad} disabled={!wattpadUrl.trim()} style={[styles.goBtn, !wattpadUrl.trim() && { opacity: 0.5 }]}>
                    {wLoading ? <ActivityIndicator size="small" color={colors.creme} /> : <Feather name="arrow-right" size={18} color={colors.creme} />}
                  </Pressable>
                </View>
                {wError && <Text style={styles.emptySub}>{t('Impossible de lire cette page Wattpad. Vérifie le lien.')}</Text>}
              </>
            )}
          </>
        )}
      </ScrollView>

      {scanning && (
        <View style={styles.scanOverlay} testID="scan-overlay">
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
            onBarcodeScanned={onBarcode}
          />
          <View style={[styles.scanBand, { paddingTop: insets.top + spacing.xl }]}>
            <Text style={styles.scanHelp}>{t('Vise le code-barres au dos du livre')}</Text>
          </View>
          <View style={styles.scanCenter}>
            <View style={styles.scanFrame} />
          </View>
          <View style={[styles.scanBand, styles.scanBandBottom, { paddingBottom: insets.bottom + spacing.xl }]}>
            <Pressable testID="scan-close" onPress={() => setScanning(false)} style={styles.scanCloseBtn}>
              <Feather name="x" size={20} color={colors.creme} />
              <Text style={styles.scanCloseText}>{t('Annuler')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  tab: { flex: 1, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creme },
  tabActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso, letterSpacing: 0.3 },
  tabTextActive: { color: colors.creme },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.xs },
  input: { height: 52, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, backgroundColor: colors.creme },
  goBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, paddingVertical: 0 },
  result: { flexDirection: 'row', gap: 12, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center' },
  resultCover: { width: 44, height: 66, borderRadius: 4, backgroundColor: colors.bisque },
  resultCoverEmpty: { alignItems: 'center', justifyContent: 'center' },
  resultInitial: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso },
  resultTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso },
  resultAuthor: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 2 },
  emptyBox: { marginTop: spacing.lg, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.lg, alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 19, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, textAlign: 'center', marginTop: spacing.xs, lineHeight: 19 },
  manualBtn: { marginTop: spacing.md, height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  manualBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme },
  manualForm: { marginTop: spacing.md },
  discreteLink: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, textDecorationLine: 'underline' },
  webNote: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, textAlign: 'center', marginTop: spacing.md, fontStyle: 'italic' },
  permBox: { marginTop: spacing.md, alignItems: 'center' },
  scanBtn: { marginTop: spacing.lg, backgroundColor: colors.chambray, borderRadius: radius.md, alignItems: 'center', paddingVertical: spacing.xl, gap: 6 },
  scanBtnText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.creme, marginTop: 4 },
  scanBtnHint: { fontFamily: fonts.body, fontSize: 12, color: colors.creme, opacity: 0.85 },
  lookupBox: { marginTop: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  lookupText: { fontFamily: fonts.body, fontSize: 14, color: colors.clay },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: colors.creme },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  confirmCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.lg },
  confirmCover: { width: 76, height: 112, borderRadius: 6, backgroundColor: colors.creme },
  confirmCoverEmpty: { alignItems: 'center', justifyContent: 'center' },
  confirmInitial: { fontFamily: fonts.displayMedium, fontSize: 36, color: colors.espresso },
  confirmBadge: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.creme, backgroundColor: colors.clay, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, letterSpacing: 1, marginBottom: 4 },
  confirmTitle: { fontFamily: fonts.displayMedium, fontSize: 23, color: colors.espresso, lineHeight: 28 },
  confirmAuthor: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, marginTop: 2 },
  confirmMeta: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.sm },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: spacing.sm, padding: spacing.xs },
  changeText: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, textDecorationLine: 'underline' },
  scanOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.espresso },
  scanBand: { backgroundColor: 'rgba(58,33,25,0.82)', alignItems: 'center', paddingVertical: spacing.lg },
  scanBandBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  scanHelp: { fontFamily: fonts.body, fontSize: 15, color: colors.creme },
  scanCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 260, height: 150, borderWidth: 2.5, borderColor: colors.chambray, borderRadius: radius.lg, backgroundColor: 'transparent' },
  scanCloseBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.creme },
  scanCloseText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
});
