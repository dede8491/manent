import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';

export type Sheet = {
  author_bio?: string;
  characters?: { name: string; description: string }[];
  summary?: string;
  themes?: string[];
};

export function StudySheet({ sheet, onSave }: { sheet?: Sheet | null; onSave: (s: Sheet) => void }) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [authorBio, setAuthorBio] = useState(sheet?.author_bio || '');
  const [summary, setSummary] = useState(sheet?.summary || '');
  const [characters, setCharacters] = useState<{ name: string; description: string }[]>(sheet?.characters || []);
  const [themes, setThemes] = useState<string[]>(sheet?.themes || []);
  const [charName, setCharName] = useState('');
  const [charDesc, setCharDesc] = useState('');
  const [newTheme, setNewTheme] = useState('');

  const build = (over: Partial<Sheet> = {}): Sheet => ({
    author_bio: authorBio, characters, summary, themes, ...over,
  });

  const filled = [
    authorBio.trim().length > 0,
    characters.length > 0,
    summary.trim().length > 0,
    themes.length > 0,
  ].filter(Boolean).length;
  const pct = Math.round((filled / 4) * 100);

  const addCharacter = () => {
    if (!charName.trim()) return;
    const next = [...characters, { name: charName.trim(), description: charDesc.trim() }];
    setCharacters(next); setCharName(''); setCharDesc('');
    onSave(build({ characters: next }));
  };
  const removeCharacter = (i: number) => {
    const next = characters.filter((_, idx) => idx !== i);
    setCharacters(next);
    onSave(build({ characters: next }));
  };
  const addTheme = () => {
    const t = newTheme.trim().toLowerCase();
    if (!t || themes.includes(t)) { setNewTheme(''); return; }
    const next = [...themes, t];
    setThemes(next); setNewTheme('');
    onSave(build({ themes: next }));
  };
  const removeTheme = (t: string) => {
    const next = themes.filter(x => x !== t);
    setThemes(next);
    onSave(build({ themes: next }));
  };

  return (
    <View style={styles.card} testID="study-sheet">
      <View style={styles.headRow}>
        <Text style={styles.headTitle}>{t('Fiche d’études')}</Text>
        <Text style={styles.pct} testID="sheet-pct">{pct}%</Text>
      </View>
      <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${pct}%` }]} /></View>
      <Text style={styles.pctHint}>{pct === 100 ? 'Fiche complète, prête pour tes révisions.' : `${filled} section${filled > 1 ? 's' : ''} sur 4 remplie${filled > 1 ? 's' : ''}`}</Text>

      <Text style={styles.label}>{t('L’auteur')}</Text>
      <TextInput
        testID="sheet-author"
        value={authorBio} onChangeText={setAuthorBio}
        onEndEditing={() => onSave(build())}
        onBlur={() => onSave(build())}
        placeholder={t('Vie, époque, courant littéraire…')}
        placeholderTextColor={colors.clay}
        style={[styles.input, styles.multiline]}
        multiline
      />

      <Text style={styles.label}>{t('Personnages')}</Text>
      <View style={{ gap: 8 }}>
        {characters.map((c, i) => (
          <View key={`${c.name}-${i}`} style={styles.charRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.charName}>{c.name}</Text>
              {!!c.description && <Text style={styles.charDesc}>{c.description}</Text>}
            </View>
            <Pressable testID={`sheet-char-del-${i}`} onPress={() => removeCharacter(i)} hitSlop={8}>
              <Feather name="x" size={16} color={colors.clay} />
            </Pressable>
          </View>
        ))}
        <TextInput testID="sheet-char-name" value={charName} onChangeText={setCharName} placeholder={t('Nom du personnage')} placeholderTextColor={colors.clay} style={styles.input} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput testID="sheet-char-desc" value={charDesc} onChangeText={setCharDesc} placeholder={t('Rôle, traits marquants…')} placeholderTextColor={colors.clay} style={[styles.input, { flex: 1 }]} />
          <Pressable testID="sheet-char-add" onPress={addCharacter} style={styles.plusBtn}><Feather name="plus" size={20} color={colors.creme} /></Pressable>
        </View>
      </View>

      <Text style={styles.label}>{t('Résumé')}</Text>
      <TextInput
        testID="sheet-summary"
        value={summary} onChangeText={setSummary}
        onEndEditing={() => onSave(build())}
        onBlur={() => onSave(build())}
        placeholder={t("L'intrigue en quelques lignes…")}
        placeholderTextColor={colors.clay}
        style={[styles.input, styles.multiline]}
        multiline
      />

      <Text style={styles.label}>{t('Thèmes de l’œuvre')}</Text>
      <View style={styles.themeWrap}>
        {themes.map(t => (
          <Pressable key={t} testID={`sheet-theme-${t}`} onPress={() => removeTheme(t)} style={styles.themeChip}>
            <Text style={styles.themeChipText}>{t}</Text>
            <Feather name="x" size={12} color={colors.creme} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput testID="sheet-theme-input" value={newTheme} onChangeText={setNewTheme} onSubmitEditing={addTheme} placeholder={t('Ajoute un thème (ex. destin)')} placeholderTextColor={colors.clay} style={[styles.input, { flex: 1 }]} />
        <Pressable testID="sheet-theme-add" onPress={addTheme} style={styles.plusBtn}><Feather name="plus" size={20} color={colors.creme} /></Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  card: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.lg },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  headTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso },
  pct: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.chambray },
  progressBar: { height: 4, backgroundColor: colors.glacier, borderRadius: 2, overflow: 'hidden', marginTop: spacing.sm },
  progressFill: { height: 4, backgroundColor: colors.chambray },
  pctHint: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 6 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, backgroundColor: colors.glacier },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  charRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md, backgroundColor: colors.glacier, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft },
  charName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.espresso },
  charDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 2 },
  plusBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  themeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  themeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.chambray },
  themeChipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme },
});
