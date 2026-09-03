import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import ManentLoader from '@/src/components/ManentLoader';
import { CatalogBookRow } from '@/src/components/CatalogBookRow';
import { Sel } from '@/src/classification';

const EXAMPLES = [
  'm’aide à retrouver confiance après une rupture',
  'parle du deuil avec douceur',
  'est un polar africain haletant',
  'me fait rire un dimanche pluvieux',
  'm’apprend à gérer mon argent',
  'nourrit ma foi au quotidien',
];

// « ✨ Je cherche un livre qui… » : l'envie est traduite en filtres de classification par l'IA
// (jamais une recherche de mots dans les titres), puis les livres correspondants s'affichent.
export default function IntentScreen() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{ filters: Sel; chips: { dim: string; key: string; label: string }[]; interpretation?: string; results: any[]; total: number; source: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (q?: string) => {
    const v = (q ?? text).trim();
    if (v.length < 3) return;
    if (q) setText(q);
    setLoading(true); setError(null); setRes(null);
    try { setRes(await api('/catalog/intent', { method: 'POST', body: JSON.stringify({ text: v }) })); }
    catch { setError(t('Impossible d’interpréter ta demande pour l’instant. Réessaie dans un instant.')); }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-intent">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="intent-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Recherche guidée')}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>✨ {t('Je cherche un livre qui…')}</Text>
        <TextInput
          testID="intent-input"
          value={text}
          onChangeText={setText}
          placeholder={t('… m’aide à retrouver confiance après une rupture')}
          placeholderTextColor={colors.clay}
          multiline
          style={styles.input}
          onSubmitEditing={() => run()}
          returnKeyType="search"
          blurOnSubmit
        />
        <Pressable testID="intent-go" onPress={() => run()} disabled={text.trim().length < 3 || loading} style={[styles.goBtn, (text.trim().length < 3 || loading) && { opacity: 0.5 }]}>
          <Feather name="search" size={16} color={colors.creme} />
          <Text style={styles.goText}>{t('Trouver des livres')}</Text>
        </Pressable>

        {!res && !loading && (
          <>
            <Text style={styles.subLabel}>{t('Par exemple')}</Text>
            <View style={{ gap: 8 }}>
              {EXAMPLES.map(e => (
                <Pressable key={e} testID={`intent-example-${EXAMPLES.indexOf(e)}`} onPress={() => run(e)} style={styles.example}>
                  <Text style={styles.exampleText}>… {t(e)}</Text>
                  <Feather name="arrow-right" size={14} color={colors.chambray} />
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>{t('Ta phrase est traduite en thèmes, émotions, ambiances, origine et type de livre : ce n’est pas une recherche de mots dans les titres.')}</Text>
          </>
        )}

        {loading && <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}><ManentLoader /></View>}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {res && (
          <View style={{ marginTop: spacing.lg }} testID="intent-results">
            {!!res.interpretation && <Text style={styles.interp}>{res.interpretation}</Text>}
            {res.chips.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: spacing.sm }}>
                {res.chips.map(c => (
                  <View key={`${c.dim}:${c.key}`} style={styles.chip}><Text style={styles.chipText}>{c.label}</Text></View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.hint}>{t('Je n’ai pas su traduire cette envie en filtres. Essaie avec d’autres mots, ou ouvre les filtres.')}</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
              <Pressable testID="intent-refine" onPress={() => router.push({ pathname: '/filters', params: { f: JSON.stringify(res.filters) } })} style={styles.ghostBtn}>
                <Feather name="sliders" size={14} color={colors.espresso} />
                <Text style={styles.ghostText}>{t('Affiner les filtres')}</Text>
              </Pressable>
              {res.total > res.results.length && (
                <Pressable testID="intent-all" onPress={() => router.push({ pathname: '/browse', params: { f: JSON.stringify(res.filters), title: t('Recherche guidée') } })} style={styles.ghostBtn}>
                  <Text style={styles.ghostText}>{t('Voir les {n} livres', { n: res.total })}</Text>
                </Pressable>
              )}
            </View>
            {res.results.length === 0 ? (
              <Text style={styles.hint}>{t('Aucun livre ne correspond encore. Le catalogue se classe jour après jour : réessaie bientôt.')}</Text>
            ) : res.results.map((b: any, i: number) => <CatalogBookRow key={b.catalog_id || i} book={b} testID={`intent-book-${i}`} />)}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: fonts.displayMedium, fontSize: 28, color: colors.espresso, marginTop: spacing.md, marginBottom: spacing.md },
  input: { minHeight: 90, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, padding: spacing.md, fontFamily: fonts.display, fontSize: 17, color: colors.espresso, textAlignVertical: 'top', lineHeight: 24 },
  goBtn: { marginTop: spacing.sm, height: 48, borderRadius: radius.pill, backgroundColor: colors.espresso, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  goText: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.creme },
  subLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  example: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.bisque },
  exampleText: { fontFamily: fonts.display, fontSize: 15.5, color: colors.espresso, flex: 1 },
  hint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, lineHeight: 17, marginTop: spacing.md },
  error: { fontFamily: fonts.body, fontSize: 13, color: '#B3552F', marginTop: spacing.md },
  interp: { fontFamily: fonts.display, fontSize: 16, color: colors.espresso, fontStyle: 'italic', lineHeight: 22 },
  chip: { height: 28, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.creme },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme },
  ghostText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.espresso },
});
