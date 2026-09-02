// Administration des auteurs (Lot C) : pays d'origine → aires littéraires dérivées.
// Les auteurs sans pays ou détectés par IA (faible confiance) arrivent en tête.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';

const COUNTRIES: [string, string][] = [
  ['FR', 'France'], ['BE', 'Belgique'], ['CH', 'Suisse'], ['CA', 'Québec (Canada)'],
  ['SN', 'Sénégal'], ['CM', 'Cameroun'], ['CI', "Côte d'Ivoire"], ['ML', 'Mali'], ['BF', 'Burkina Faso'],
  ['NE', 'Niger'], ['TG', 'Togo'], ['BJ', 'Bénin'], ['GN', 'Guinée'], ['CD', 'RD Congo'], ['CG', 'Congo'],
  ['GA', 'Gabon'], ['TD', 'Tchad'], ['CF', 'Centrafrique'], ['MG', 'Madagascar'], ['RW', 'Rwanda'],
  ['DJ', 'Djibouti'], ['KM', 'Comores'], ['MU', 'Maurice'], ['NG', 'Nigeria'], ['GH', 'Ghana'],
  ['ZA', 'Afrique du Sud'], ['DZ', 'Algérie'], ['MA', 'Maroc'], ['TN', 'Tunisie'], ['MR', 'Mauritanie'],
  ['MQ', 'Martinique'], ['GP', 'Guadeloupe'], ['GF', 'Guyane'], ['HT', 'Haïti'],
  ['LB', 'Liban'], ['VN', 'Vietnam'], ['LU', 'Luxembourg'], ['MC', 'Monaco'],
  ['US', 'États-Unis'], ['GB', 'Royaume-Uni'], ['DE', 'Allemagne'], ['IT', 'Italie'], ['ES', 'Espagne'],
  ['PT', 'Portugal'], ['RU', 'Russie'], ['JP', 'Japon'], ['CN', 'Chine'], ['IN', 'Inde'],
  ['BR', 'Brésil'], ['AR', 'Argentine'], ['MX', 'Mexique'], ['CO', 'Colombie'], ['CL', 'Chili'],
  ['NL', 'Pays-Bas'], ['SE', 'Suède'], ['NO', 'Norvège'], ['DK', 'Danemark'], ['PL', 'Pologne'],
  ['AT', 'Autriche'], ['IE', 'Irlande'], ['GR', 'Grèce'], ['TR', 'Turquie'], ['IR', 'Iran'],
  ['EG', 'Égypte'], ['IL', 'Israël'], ['AU', 'Australie'], ['KR', 'Corée du Sud'],
];

export function AuthorAdmin() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [q, setQ] = useState('');
  const [authors, setAuthors] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<any>(null);
  const [countryQ, setCountryQ] = useState('');
  const [saving, setSaving] = useState(false);
  const timer = useRef<any>(null);

  const load = async (pg = 1, query = q) => {
    try {
      const r = await api<any>(`/catalog/admin/authors?q=${encodeURIComponent(query.trim())}&page=${pg}&size=30`);
      setAuthors(prev => (pg === 1 ? r.authors : [...prev, ...r.authors]));
      setTotal(r.total || 0);
      setPage(pg);
    } catch {}
  };

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load(1), 350);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const save = async (iso: string | null) => {
    if (!editing) return;
    setSaving(true);
    try {
      await api(`/catalog/admin/authors/${editing.author_id}`, {
        method: 'PATCH', body: JSON.stringify({ country: iso }),
      });
      setEditing(null);
      setCountryQ('');
      load(1);
    } catch {}
    setSaving(false);
  };

  const filteredCountries = COUNTRIES.filter(([, label]) =>
    label.toLowerCase().includes(countryQ.trim().toLowerCase()));

  const confTag = (a: any) => {
    if (!a.country) return t('Pays inconnu');
    if (a.origin_confidence === 'low') return t('IA — à vérifier');
    return a.origin_source === 'manual' ? t('Manuel') : a.origin_source;
  };

  return (
    <View style={{ marginTop: spacing.xl }} testID="admin-authors">
      <Text style={styles.section}>{t('Auteurs')}</Text>
      <Text style={styles.help}>{t('Le pays d’un auteur détermine les aires littéraires de ses livres. Les pays inconnus ou incertains sont en tête.')}</Text>
      <View style={styles.searchRow}>
        <Feather name="search" size={15} color={colors.clay} />
        <TextInput testID="admin-author-search" value={q} onChangeText={setQ}
          placeholder={t('Chercher un auteur…')} placeholderTextColor={colors.clay} style={styles.input} />
      </View>
      {authors.map(a => (
        <Pressable key={a.author_id} testID={`admin-author-${a.author_id}`} onPress={() => { setEditing(a); setCountryQ(''); }} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{a.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {a.book_count} {t(a.book_count > 1 ? 'livres' : 'livre')}
              {(a.areas || []).length > 0 ? `  ·  ${a.areas.join(', ')}` : ''}
            </Text>
          </View>
          <View style={[styles.tag, !a.country && styles.tagWarn]}>
            <Text style={[styles.tagText, !a.country && { color: colors.creme }]}>
              {a.country_label || confTag(a)}
            </Text>
          </View>
          {a.country && a.origin_confidence === 'low' && (
            <Feather name="alert-circle" size={15} color={colors.clay} />
          )}
        </Pressable>
      ))}
      {authors.length < total && (
        <Pressable testID="admin-authors-more" onPress={() => load(page + 1)} style={styles.moreBtn}>
          <Text style={styles.moreText}>{t('Voir plus')} ({authors.length}/{total})</Text>
        </Pressable>
      )}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.overlay} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle} numberOfLines={1}>{editing?.name}</Text>
            <Text style={styles.sheetSub}>{t('Pays d’origine')}</Text>
            <View style={styles.searchRow}>
              <Feather name="search" size={15} color={colors.clay} />
              <TextInput testID="admin-country-search" value={countryQ} onChangeText={setCountryQ} autoFocus
                placeholder={t('Chercher un pays…')} placeholderTextColor={colors.clay} style={styles.input} />
            </View>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              <Pressable testID="admin-country-none" onPress={() => save(null)} disabled={saving} style={styles.countryRow}>
                <Text style={[styles.countryText, { color: colors.clay }]}>{t('Inconnu / retirer le pays')}</Text>
              </Pressable>
              {filteredCountries.map(([iso, label]) => (
                <Pressable key={iso} testID={`admin-country-${iso}`} onPress={() => save(iso)} disabled={saving} style={styles.countryRow}>
                  <Text style={styles.countryText}>{label}</Text>
                  {editing?.country === iso && <Feather name="check" size={16} color={colors.chambray} />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  section: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, marginBottom: 4 },
  help: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, lineHeight: 16, marginBottom: spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, backgroundColor: colors.creme, marginBottom: spacing.sm },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.sm, marginBottom: 6 },
  name: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso },
  meta: { fontFamily: fonts.body, fontSize: 10.5, color: colors.clay, marginTop: 1 },
  tag: { paddingHorizontal: 9, height: 24, borderRadius: radius.pill, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  tagWarn: { backgroundColor: colors.chambray },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.espresso },
  moreBtn: { height: 40, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.chambray },
  overlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: colors.creme, borderRadius: radius.lg, padding: spacing.lg },
  sheetTitle: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  sheetSub: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4, marginBottom: spacing.sm },
  countryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  countryText: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso },
});
