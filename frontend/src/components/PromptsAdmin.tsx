import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';

type P = { prompt_id: string; text_fr: string; category?: string | null; active: boolean; uses: number };

// Admin — prompts du journal : ajout, activation, suppression. Enrichissables sans redéployer.
export function PromptsAdmin() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [prompts, setPrompts] = useState<P[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => { try { setPrompts((await api<{ prompts: P[] }>('/journal/admin/prompts')).prompts); } catch { setPrompts([]); } };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (text.trim().length < 5 || busy) return;
    setBusy(true);
    try { await api('/journal/admin/prompts', { method: 'POST', body: JSON.stringify({ text_fr: text.trim(), active: true }) }); setText(''); await load(); } catch {}
    setBusy(false);
  };
  const toggle = async (p: P) => {
    try { await api(`/journal/admin/prompts/${p.prompt_id}`, { method: 'PATCH', body: JSON.stringify({ text_fr: p.text_fr, category: p.category, active: !p.active }) }); await load(); } catch {}
  };
  const remove = async (p: P) => {
    try { await api(`/journal/admin/prompts/${p.prompt_id}`, { method: 'DELETE' }); setPrompts(prev => (prev || []).filter(x => x.prompt_id !== p.prompt_id)); } catch {}
  };

  return (
    <View testID="admin-prompts">
      <Text style={styles.sectionTitle}>{t('Prompts du journal')}</Text>
      <Text style={styles.help}>{t('Proposés en rotation à chaque nouvelle entrée. Désactive plutôt que supprimer pour garder l’historique.')}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.sm }}>
        <TextInput testID="prompts-new" value={text} onChangeText={setText} placeholder={t('Nouveau prompt, en français…')} placeholderTextColor={colors.clay} style={styles.input} />
        <Pressable testID="prompts-add" onPress={add} disabled={text.trim().length < 5 || busy} style={[styles.addBtn, (text.trim().length < 5 || busy) && { opacity: 0.4 }]}>
          <Feather name="plus" size={16} color={colors.creme} />
        </Pressable>
      </View>
      {(prompts || []).map(p => (
        <View key={p.prompt_id} style={[styles.row, !p.active && { opacity: 0.55 }]} testID={`prompt-${p.prompt_id}`}>
          <Pressable onPress={() => toggle(p)} hitSlop={6} testID={`prompt-toggle-${p.prompt_id}`}>
            <Feather name={p.active ? 'check-circle' : 'circle'} size={18} color={p.active ? colors.chambray : colors.clay} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>{p.text_fr}</Text>
            <Text style={styles.meta}>{p.category ? `${p.category} · ` : ''}{t(p.uses > 1 ? '{n} utilisations' : '{n} utilisation', { n: p.uses })}</Text>
          </View>
          <Pressable onPress={() => remove(p)} hitSlop={6} testID={`prompt-delete-${p.prompt_id}`}><Feather name="trash-2" size={15} color="#B3552F" /></Pressable>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  sectionTitle: { fontFamily: fonts.displayMedium, fontSize: 21, color: colors.espresso, marginTop: spacing.xl, marginBottom: spacing.xs },
  help: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, lineHeight: 17, marginBottom: spacing.sm },
  input: { flex: 1, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  addBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.sm, marginBottom: 6 },
  text: { fontFamily: fonts.display, fontSize: 15, color: colors.espresso, lineHeight: 20 },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.clay, marginTop: 2 },
});
