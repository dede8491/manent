// Administration des aires littéraires : collections éditoriales + suggestions à valider.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';

const AREA_KEYS = ['africaine', 'antillaise', 'maghrébine', 'québécoise', 'belge', 'suisse', 'française', 'autres francophones'];

export function AreaAdmin() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [area, setArea] = useState(AREA_KEYS[0]);
  const [sugg, setSugg] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [areaBooks, setAreaBooks] = useState<any[]>([]);

  const load = async () => {
    try {
      const s = await api<{ suggestions: any[] }>('/catalog/admin/area-suggestions?size=30');
      setSugg(s.suggestions.filter(x => x.book));
    } catch {}
    try {
      const r = await api<any>(`/catalog/areas/${encodeURIComponent(area)}?size=20`);
      setAreaBooks(r.books || []);
    } catch { setAreaBooks([]); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [area]);

  const search = async () => {
    if (q.trim().length < 2) return;
    try {
      const r = await api<{ results: any[] }>(`/catalog/search?q=${encodeURIComponent(q.trim())}&size=8`);
      setResults(r.results || []);
    } catch {}
  };

  const setInArea = async (catalogId: string, add: boolean) => {
    try {
      await api(`/catalog/admin/areas/${encodeURIComponent(area)}/books`, { method: 'POST', body: JSON.stringify({ catalog_id: catalogId, add }) });
      load();
    } catch {}
  };

  const decide = async (s: any, accept: boolean) => {
    try {
      await api('/catalog/admin/area-suggestions/decide', { method: 'POST', body: JSON.stringify({ catalog_id: s.catalog_id, area: s.area, accept }) });
      setSugg(prev => prev.filter(x => !(x.catalog_id === s.catalog_id && x.area === s.area)));
    } catch {}
  };

  const Row = ({ b, right }: { b: any; right: React.ReactNode }) => (
    <View style={styles.row}>
      {b.cover ? <Image source={{ uri: b.cover }} style={styles.cover} /> : <View style={[styles.cover, { alignItems: 'center', justifyContent: 'center' }]}><Text style={styles.initial}>{(b.title?.[0] || 'M').toUpperCase()}</Text></View>}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{b.title}</Text>
        <Text style={styles.author} numberOfLines={1}>{b.author}</Text>
      </View>
      {right}
    </View>
  );

  return (
    <View style={{ marginTop: spacing.xl }} testID="admin-areas">
      <Text style={styles.section}>{t('Aires littéraires')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
        {AREA_KEYS.map(a => (
          <Pressable key={a} testID={`admin-area-${a}`} onPress={() => setArea(a)} style={[styles.chip, area === a && styles.chipActive]}>
            <Text style={[styles.chipText, area === a && { color: colors.creme }]}>{a}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.searchRow}>
        <TextInput testID="admin-area-search" value={q} onChangeText={setQ} onSubmitEditing={search}
          placeholder={t('Chercher un livre du catalogue…')} placeholderTextColor={colors.clay} style={styles.input} returnKeyType="search" />
        <Pressable testID="admin-area-search-go" onPress={search} style={styles.goBtn}><Feather name="search" size={16} color={colors.creme} /></Pressable>
      </View>
      {results.map(b => (
        <Row key={b.catalog_id} b={b} right={
          <Pressable testID={`admin-add-${b.catalog_id}`} onPress={() => setInArea(b.catalog_id, true)} style={styles.addBtn}>
            <Text style={styles.addText}>{t('Ajouter à cette aire')}</Text>
          </Pressable>} />
      ))}
      {areaBooks.length > 0 && <Text style={styles.sub}>{t('Dans la collection')} ({areaBooks.length})</Text>}
      {areaBooks.map(b => (
        <Row key={b.catalog_id} b={b} right={
          <Pressable testID={`admin-remove-${b.catalog_id}`} onPress={() => setInArea(b.catalog_id, false)} hitSlop={8}>
            <Feather name="x-circle" size={18} color={colors.clay} />
          </Pressable>} />
      ))}
      {sugg.length > 0 && <Text style={styles.sub}>{t('À valider')} ({sugg.length})</Text>}
      {sugg.slice(0, 15).map(s => (
        <Row key={`${s.catalog_id}-${s.area}`} b={s.book} right={
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={styles.suggArea}>{s.area}</Text>
            <Pressable testID={`sugg-yes-${s.catalog_id}`} onPress={() => decide(s, true)} hitSlop={6}><Feather name="check-circle" size={19} color={colors.chambray} /></Pressable>
            <Pressable testID={`sugg-no-${s.catalog_id}`} onPress={() => decide(s, false)} hitSlop={6}><Feather name="x-circle" size={19} color={colors.clay} /></Pressable>
          </View>} />
      ))}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  section: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, marginBottom: spacing.md },
  sub: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm },
  chip: { paddingHorizontal: 12, height: 30, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.espresso },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  input: { flex: 1, height: 42, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, backgroundColor: colors.creme },
  goBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.sm, marginBottom: 6 },
  cover: { width: 32, height: 46, borderRadius: 4, backgroundColor: colors.bisque },
  initial: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.clay },
  title: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.espresso },
  author: { fontFamily: fonts.body, fontSize: 11, color: colors.clay },
  addBtn: { paddingHorizontal: 10, height: 30, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.creme },
  suggArea: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.clay, textTransform: 'uppercase', letterSpacing: 0.8 },
});
