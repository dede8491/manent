import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BottomSheet } from '@/src/components/BottomSheet';
import { BookCover } from '@/src/components/BookCover';
import { GhostButton } from '@/src/components/Button';
import ManentLoader from '@/src/components/ManentLoader';
import { useT } from '@/src/i18n';

type Method = 'title' | 'isbn' | 'wattpad';

// Feuille « Ajouter une lecture » : Titre / ISBN / Wattpad. Le choix d'un résultat ouvre
// la confirmation (statut, mode) dans /book/add, déjà en place.
export function AddReadingSheet({ visible, onClose, testID = 'add-reading-sheet' }: { visible: boolean; onClose: () => void; testID?: string }) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const [method, setMethod] = useState<Method>('title');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isbn, setIsbn] = useState('');
  const [isbnError, setIsbnError] = useState(false);
  const [wattpad, setWattpad] = useState('');
  const [busy, setBusy] = useState(false);
  const [wError, setWError] = useState(false);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); setSearched(false); setIsbn(''); setWattpad(''); setIsbnError(false); setWError(false); }
  }, [visible]);

  useEffect(() => {
    if (method !== 'title') return;
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api<{ results: any[] }>(`/catalog/search?q=${encodeURIComponent(query.trim())}&size=8`);
        setResults(r.results || []);
      } catch { setResults([]); }
      setSearched(true); setSearching(false);
    }, 350);
    return () => clearTimeout(timer.current);
  }, [query, method]);

  const goAdd = (params: Record<string, string>) => {
    onClose();
    setTimeout(() => router.push({ pathname: '/book/add', params }), 120);
  };

  const pick = (b: any) => goAdd({
    title: b.title || '', author: b.author || '', cover: b.cover || '', isbn: b.isbn || '',
    pages: b.pages ? String(b.pages) : '', year: b.year || '', catalog_id: b.catalog_id || '',
  });

  const lookupIsbn = async () => {
    const code = isbn.replace(/[^0-9Xx]/g, '');
    if (code.length < 10) return;
    setBusy(true); setIsbnError(false);
    try {
      const r = await api<any>(`/catalog/isbn/${encodeURIComponent(code)}`);
      pick(r);
    } catch { setIsbnError(true); }
    finally { setBusy(false); }
  };

  const fetchWattpad = async () => {
    if (!wattpad.trim()) return;
    setBusy(true); setWError(false);
    try {
      const r = await api<any>(`/wattpad/scrape?url=${encodeURIComponent(wattpad.trim())}`);
      goAdd({ type: 'wattpad', title: r.title || '', author: r.author || '', cover: r.cover || '', chapters: r.chapters ? String(r.chapters) : '', wattpad_url: r.wattpad_url || wattpad.trim() });
    } catch { setWError(true); }
    finally { setBusy(false); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('Ajouter une lecture')} testID={testID}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['title', 'isbn', 'wattpad'] as Method[]).map(m => (
          <Pressable key={m} testID={`${testID}-method-${m}`} onPress={() => setMethod(m)} style={[styles.tab, method === m && styles.tabActive]}>
            <Text style={[styles.tabText, method === m && styles.tabTextActive]}>{m === 'title' ? t('Titre') : m === 'isbn' ? 'ISBN' : 'Wattpad'}</Text>
          </Pressable>
        ))}
      </View>

      {method === 'title' && (
        <>
          <Text style={styles.label}>{t('Cherche un titre ou un auteur')}</Text>
          <View style={styles.searchBox}>
            <Feather name="search" size={16} color={colors.clay} />
            <TextInput testID={`${testID}-query`} value={query} onChangeText={setQuery} placeholder="L'Alchimiste, Coelho…" placeholderTextColor={colors.clay} style={styles.searchInput} autoCapitalize="none" autoFocus />
            {searching ? <ManentLoader size={18} /> : null}
          </View>
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {results.map((r, i) => (
              <Pressable key={r.catalog_id || i} testID={`${testID}-result-${i}`} onPress={() => pick(r)} style={({ pressed }) => [styles.result, pressed && { opacity: 0.85 }]}>
                <BookCover uri={r.cover} title={r.title} width={40} height={58} radius={4} initialSize={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle} numberOfLines={2}>{r.title || t('Sans titre')}</Text>
                  <Text style={styles.resultAuthor} numberOfLines={1}>{[r.author || null, r.year || null].filter(Boolean).join('  ·  ') || '—'}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.clay} />
              </Pressable>
            ))}
            {searched && !searching && results.length === 0 && (
              <Pressable testID={`${testID}-manual`} onPress={() => goAdd({ q: query.trim() })} style={styles.manualRow}>
                <Feather name="edit-3" size={14} color={colors.chambray} />
                <Text style={styles.manualText}>{t('Rien trouvé : l’ajouter à la main')}</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      {method === 'isbn' && (
        <>
          <Pressable testID={`${testID}-scan`} onPress={() => goAdd({ method: 'isbn', scan: '1' })} style={styles.scanBtn}>
            <Feather name="maximize" size={22} color={colors.creme} />
            <Text style={styles.scanText}>{t('Scanner le code-barres')}</Text>
          </Pressable>
          <Text style={styles.label}>{t('Ou saisis l’ISBN')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput testID={`${testID}-isbn`} value={isbn} onChangeText={setIsbn} keyboardType="number-pad" placeholder="9782290004449" placeholderTextColor={colors.clay} style={[styles.input, { flex: 1 }]} />
            <Pressable testID={`${testID}-isbn-go`} onPress={lookupIsbn} disabled={busy || isbn.replace(/[^0-9Xx]/g, '').length < 10} style={[styles.goBtn, (busy || isbn.replace(/[^0-9Xx]/g, '').length < 10) && { opacity: 0.5 }]}>
              {busy ? <ManentLoader size={18} variant="sombre" /> : <Feather name="search" size={18} color={colors.creme} />}
            </Pressable>
          </View>
          {isbnError && <Text style={styles.error}>{t('Ce livre reste introuvable.')}</Text>}
        </>
      )}

      {method === 'wattpad' && (
        <>
          <Text style={styles.label}>{t('Lien de l’histoire')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput testID={`${testID}-wattpad`} value={wattpad} onChangeText={setWattpad} placeholder="https://www.wattpad.com/story/…" placeholderTextColor={colors.clay} style={[styles.input, { flex: 1 }]} autoCapitalize="none" />
            <Pressable testID={`${testID}-wattpad-go`} onPress={fetchWattpad} disabled={busy || !wattpad.trim()} style={[styles.goBtn, (busy || !wattpad.trim()) && { opacity: 0.5 }]}>
              {busy ? <ManentLoader size={18} variant="sombre" /> : <Feather name="arrow-right" size={18} color={colors.creme} />}
            </Pressable>
          </View>
          {wError && <Text style={styles.error}>{t('Impossible de lire cette page Wattpad. Vérifie le lien.')}</Text>}
        </>
      )}

      <GhostButton title={t('Annuler')} onPress={onClose} testID={`${testID}-cancel`} />
    </BottomSheet>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  tab: { flex: 1, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creme },
  tabActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso, letterSpacing: 0.3 },
  tabTextActive: { color: colors.creme },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.xs },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, paddingVertical: 0 },
  input: { height: 52, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, backgroundColor: colors.creme },
  goBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  result: { flexDirection: 'row', gap: 12, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center' },
  resultTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso },
  resultAuthor: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 2 },
  manualRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, backgroundColor: colors.creme },
  manualText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.chambray },
  scanBtn: { marginTop: spacing.lg, height: 56, borderRadius: radius.md, backgroundColor: colors.chambray, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  scanText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.creme },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: spacing.sm },
});
