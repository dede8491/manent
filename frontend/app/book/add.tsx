import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radius, spacing } from '@/src/theme';
import { PrimaryButton, GhostButton } from '@/src/components/Button';
import { api } from '@/src/api';

type Method = 'title' | 'isbn' | 'wattpad';

export default function AddBook() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [method, setMethod] = useState<Method>('title');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'a_lire'|'en_cours'|'termine'>('en_cours');
  const [mode, setMode] = useState<'perso'|'etudes'>('perso');
  const [selected, setSelected] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setResults([]);
    try {
      if (method === 'title') {
        const r = await api<{ results: any[] }>(`/books/search?q=${encodeURIComponent(query)}`);
        setResults(r.results);
      } else if (method === 'isbn') {
        const r = await api<any>(`/books/search/isbn?isbn=${encodeURIComponent(query.replace(/[^0-9]/g,''))}`);
        setResults([r]);
      } else if (method === 'wattpad') {
        const r = await api<any>(`/wattpad/scrape?url=${encodeURIComponent(query)}`);
        setResults([{ ...r, type: 'wattpad' }]);
      }
    } catch (e: any) {
      setResults([]);
    } finally { setLoading(false); }
  };

  const add = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const isWattpad = method === 'wattpad' || selected.type === 'wattpad';
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
          chapters: selected.chapters,
          status, mode,
        }),
      });
      router.replace({ pathname: '/book/[id]', params: { id: b.book_id } });
    } finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-add-book">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="add-close" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.h1}>Ajouter une lecture</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['title','isbn','wattpad'] as Method[]).map(m => (
            <Pressable key={m} testID={`method-${m}`} onPress={() => { setMethod(m); setResults([]); setSelected(null); }} style={[styles.tab, method === m && styles.tabActive]}>
              <Text style={[styles.tabText, method === m && styles.tabTextActive]}>{m === 'title' ? 'Titre' : m === 'isbn' ? 'ISBN' : 'Wattpad'}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{method === 'title' ? 'Recherche par titre ou auteur' : method === 'isbn' ? 'Numéro ISBN' : 'Lien Wattpad'}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            testID="add-query"
            value={query} onChangeText={setQuery}
            placeholder={method === 'title' ? 'L\'Alchimiste, Coelho…' : method === 'isbn' ? '9782290004449' : 'https://www.wattpad.com/story/…'}
            placeholderTextColor={colors.clay}
            style={[styles.input, { flex: 1 }]}
            autoCapitalize="none"
          />
          <Pressable testID="btn-search" onPress={search} disabled={!query.trim()} style={[styles.searchBtn, !query.trim() && { opacity: 0.5 }]}>
            {loading ? <ActivityIndicator color={colors.creme} /> : <Feather name="search" size={18} color={colors.creme} />}
          </Pressable>
        </View>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {results.map((r, i) => (
            <Pressable key={i} testID={`result-${i}`} onPress={() => setSelected(r)} style={[styles.result, selected === r && styles.resultActive]}>
              <View style={styles.resultCover}><Text style={styles.resultInitial}>{(r.title?.[0] || 'M').toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle} numberOfLines={2}>{r.title || 'Sans titre'}</Text>
                <Text style={styles.resultAuthor} numberOfLines={1}>{r.author || '—'}</Text>
                {r.pages ? <Text style={styles.resultMeta}>{r.pages} pages</Text> : r.chapters ? <Text style={styles.resultMeta}>{r.chapters} chapitres</Text> : null}
              </View>
              {selected === r && <Feather name="check" size={20} color={colors.chambray} />}
            </Pressable>
          ))}
        </View>

        {selected && (
          <>
            <Text style={styles.label}>Statut</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['a_lire','À lire'],['en_cours','En cours'],['termine','Terminé']] as const).map(([id, lbl]) => (
                <Pressable key={id} testID={`status-${id}`} onPress={() => setStatus(id)} style={[styles.chip, status === id && styles.chipActive]}>
                  <Text style={[styles.chipText, status === id && styles.chipTextActive]}>{lbl}</Text>
                </Pressable>
              ))}
            </View>

            {method !== 'wattpad' && (
              <>
                <Text style={styles.label}>Mode</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable testID="mode-perso" onPress={() => setMode('perso')} style={[styles.chip, mode === 'perso' && styles.chipActive]}>
                    <Text style={[styles.chipText, mode === 'perso' && styles.chipTextActive]}>Lecture perso</Text>
                  </Pressable>
                  <Pressable testID="mode-etudes" onPress={() => setMode('etudes')} style={[styles.chip, mode === 'etudes' && styles.chipActive]}>
                    <Text style={[styles.chipText, mode === 'etudes' && styles.chipTextActive]}>Pour mes études</Text>
                  </Pressable>
                </View>
              </>
            )}

            <View style={{ height: spacing.xl }} />
            <PrimaryButton testID="btn-add-book" title="Ajouter à ma bibliothèque" onPress={add} loading={saving} />
            <GhostButton title="Annuler" onPress={() => router.back()} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  tab: { flex: 1, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creme },
  tabActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso, letterSpacing: 0.3 },
  tabTextActive: { color: colors.creme },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.xs },
  input: { height: 52, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, backgroundColor: colors.creme },
  searchBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  result: { flexDirection: 'row', gap: 12, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center' },
  resultActive: { borderColor: colors.chambray, borderWidth: 2 },
  resultCover: { width: 44, height: 66, borderRadius: 4, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  resultInitial: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso },
  resultTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso },
  resultAuthor: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 2 },
  resultMeta: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: colors.creme },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
});
