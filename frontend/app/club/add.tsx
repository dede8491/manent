import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import ManentLoader from '@/src/components/ManentLoader';
import { useT } from '@/src/i18n';

export default function ClubAddBook() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingIdx, setAddingIdx] = useState<number | null>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const qv = q.trim();
    if (qv.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await api<{ results: any[] }>(`/books/search?q=${encodeURIComponent(qv)}`);
        setResults(r.results || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 450);
    return () => clearTimeout(timer.current);
  }, [q]);

  const addToClub = async (b: any, idx: number) => {
    setAddingIdx(idx);
    try {
      const r = await api<{ cb_id: string }>('/club/books', {
        method: 'POST',
        body: JSON.stringify({
          title: b.title, author: b.author || undefined, cover: b.cover || undefined,
          isbn: b.isbn || undefined, pages: b.pages || undefined, year: b.year || undefined,
        }),
      });
      router.replace({ pathname: '/club/book/[id]', params: { id: r.cb_id } });
    } finally { setAddingIdx(null); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-club-add">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="club-add-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.h1}>{t('Proposer un livre')}</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.searchBox}>
        <Feather name="search" size={16} color={colors.clay} />
        <TextInput
          testID="club-add-search"
          value={q} onChangeText={setQ}
          autoFocus
          placeholder={t('Titre ou auteur (ex. L’Alchimiste)…')}
          placeholderTextColor={colors.clay}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Feather name="x" size={16} color={colors.clay} /></Pressable> : null}
      </View>
      <Text style={styles.hint}>{t('Le livre rejoindra le Club pour toute la communauté — il ne sera pas ajouté à ta bibliothèque.')}</Text>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={{ paddingTop: spacing.xl, alignItems: 'center' }}><ManentLoader size={56} /></View>
        ) : results.length === 0 && q.trim().length >= 2 ? (
          <Text style={styles.empty}>{t('Aucun résultat. Essaie un autre titre.')}</Text>
        ) : (
          results.map((b, i) => (
            <View key={i} style={styles.row} testID={`club-add-result-${i}`}>
              <BookCover uri={b.cover} title={b.title} width={44} height={62} initialSize={20} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>{b.title}</Text>
                <Text style={styles.author} numberOfLines={1}>{[b.author, b.year].filter(Boolean).join('  ·  ') || '—'}</Text>
              </View>
              <Pressable testID={`club-add-btn-${i}`} onPress={() => addToClub(b, i)} disabled={addingIdx !== null} style={styles.addBtn}>
                {addingIdx === i ? <ManentLoader size={20} variant="sombre" /> : <Feather name="plus" size={18} color={colors.creme} />}
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: spacing.md, marginHorizontal: spacing.xl, backgroundColor: colors.creme, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.espresso, paddingVertical: 0 },
  hint: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, lineHeight: 16, paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', paddingTop: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 8 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.espresso },
  author: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 2 },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
});
