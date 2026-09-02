import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import ManentLoader from '@/src/components/ManentLoader';
import { Sel, countSel, labelOf, parseSel, selToQuery, toggleSel, useTaxonomy } from '@/src/classification';

// Page « Filtres » : géographie progressive (continent → région → pays), type de livre,
// domaines, thèmes, émotions, ambiances, public, langue. Sections repliables, compteur
// « Voir N livres » mis à jour à chaque changement, chips sélectionnées avec ×.
export default function FiltersScreen() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ f?: string; sort?: string; q?: string; from?: string }>();
  const tax = useTaxonomy();
  const [sel, setSel] = useState<Sel>(() => parseSel(params.f));
  const [count, setCount] = useState<number | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ geo: true, type: true, theme: true });
  const [themeQuery, setThemeQuery] = useState('');
  const [allThemes, setAllThemes] = useState(false);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await api<{ total: number }>(`/catalog/browse?${selToQuery(sel, { count_only: 1, q: params.q })}`);
        setCount(r.total);
      } catch { setCount(null); }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [sel, params.q]);

  const toggle = (dim: string, key: string) => setSel(s => toggleSel(s, dim, key));
  const has = (dim: string, key: string) => (sel[dim] || []).includes(key);
  const flip = (k: string) => setOpen(o => ({ ...o, [k]: !o[k] }));

  const selectedChips = useMemo(() => {
    const out: { dim: string; key: string; label: string }[] = [];
    for (const [dim, keys] of Object.entries(sel)) for (const k of keys) out.push({ dim, key: k, label: labelOf(tax, dim, k) });
    return out;
  }, [sel, tax]);

  const apply = () => {
    const f = JSON.stringify(sel);
    if (params.from === 'browse') router.navigate({ pathname: '/browse', params: { f, sort: params.sort || 'pertinence', q: params.q || '' } });
    else router.push({ pathname: '/browse', params: { f, sort: params.sort || 'pertinence', q: params.q || '' } });
  };

  // Chip sans état : peut être définie ici sans risque (aucun focus à conserver).
  const Chip =({ dim, k, label, emoji }: { dim: string; k: string; label: string; emoji?: string }) => {
    const on = has(dim, k);
    return (
      <Pressable key={`${dim}:${k}`} testID={`filter-${dim}-${k}`} onPress={() => toggle(dim, k)} style={[styles.chip, on && styles.chipOn]}>
        <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>{emoji ? `${emoji} ` : ''}{label}</Text>
      </Pressable>
    );
  };


  const selContinents = tax ? tax.geo.filter(c => has('continent', c.key)) : [];
  const regions = selContinents.flatMap(c => c.regions);
  const selRegions = regions.filter(r => has('region', r.key));
  const countries = selRegions.flatMap(r => r.countries).sort((a, b) => a.label.localeCompare(b.label));
  const selFamilies = tax ? tax.types.filter(f => has('type', f.key)) : [];
  const themeHits = useMemo(() => {
    if (!tax) return [];
    const q = themeQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return tax.themes.flatMap(g => g.items).filter(i => i.label.toLowerCase().includes(q)).slice(0, 12);
  }, [tax, themeQuery]);
  const n = countSel(sel);

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-filters">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="filters-back" style={styles.iconBtn}>
          <Feather name="x" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.h1}>{t('Filtres')}</Text>
        <Pressable testID="filters-reset" onPress={() => setSel({})} hitSlop={8} style={styles.iconBtn}>
          <Text style={[styles.reset, n === 0 && { opacity: 0.4 }]}>{t('Réinitialiser')}</Text>
        </Pressable>
      </View>
      {!tax ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>{t('Combine autant de filtres que tu veux : un livre peut être africain, un roman, sur le deuil et réconfortant à la fois.')}</Text>

          <Section k="geo" open={!!open.geo} onFlip={flip} title={t('Origine')} emoji="🌍" hint={(sel.continent?.length || 0) + (sel.region?.length || 0) + (sel.country?.length || 0)}>
            <View style={styles.wrap}>
              {tax.geo.map(c => <Chip key={c.key} dim="continent" k={c.key} label={c.label} emoji={c.emoji} />)}
            </View>
            {regions.length > 0 && (
              <>
                <Text style={styles.subLabel}>{t('Régions')}</Text>
                <View style={styles.wrap}>{regions.map(r => <Chip key={r.key} dim="region" k={r.key} label={r.label} />)}</View>
              </>
            )}
            {countries.length > 0 && (
              <>
                <Text style={styles.subLabel}>{t('Pays')}</Text>
                <View style={styles.wrap}>{countries.map(c => <Chip key={c.key} dim="country" k={c.key} label={c.label} />)}</View>
              </>
            )}
            {regions.length === 0 && <Text style={styles.hint}>{t('Choisis un continent pour affiner par région, puis par pays.')}</Text>}
          </Section>

          <Section k="type" open={!!open.type} onFlip={flip} title={t('Type de livre')} emoji="📖" hint={(sel.type?.length || 0) + (sel.genre?.length || 0)}>
            <View style={styles.wrap}>
              {tax.types.map(f => <Chip key={f.key} dim="type" k={f.key} label={f.label} emoji={f.emoji} />)}
            </View>
            {selFamilies.map(f => (
              <View key={f.key}>
                <Text style={styles.subLabel}>{f.label}</Text>
                <View style={styles.wrap}>{f.subtypes.map(s => <Chip key={s.key} dim="type" k={s.key} label={s.label} />)}</View>
                {f.key === 'fiction' && (
                  <>
                    <Text style={styles.subLabel}>{t('Genre')}</Text>
                    <View style={styles.wrap}>{tax.genres.map(g => <Chip key={g.key} dim="genre" k={g.key} label={g.label} />)}</View>
                  </>
                )}
              </View>
            ))}
          </Section>

          <Section k="domain" open={!!open.domain} onFlip={flip} title={t('Domaines')} emoji="🧭" hint={sel.domain?.length}>
            {tax.domains.map(g => (
              <View key={g.key}>
                <Text style={styles.subLabel}>{g.emoji} {g.label}</Text>
                <View style={styles.wrap}>{g.items.map(i => <Chip key={i.key} dim="domain" k={i.key} label={i.label} />)}</View>
              </View>
            ))}
          </Section>

          <Section k="theme" open={!!open.theme} onFlip={flip} title={t('Thèmes')} emoji="🧵" hint={sel.theme?.length}>
            <View style={styles.searchBox}>
              <Feather name="search" size={15} color={colors.clay} />
              <TextInput testID="filters-theme-search" value={themeQuery} onChangeText={setThemeQuery} placeholder={t('Chercher un thème (deuil, rupture, foi…)')} placeholderTextColor={colors.clay} style={styles.searchInput} />
              {!!themeQuery && <Pressable onPress={() => setThemeQuery('')} hitSlop={8}><Feather name="x" size={15} color={colors.clay} /></Pressable>}
            </View>
            {themeHits.length > 0 && <View style={styles.wrap}>{themeHits.map(i => <Chip key={i.key} dim="theme" k={i.key} label={i.label} />)}</View>}
            {themeQuery.trim().length >= 2 && themeHits.length === 0 && <Text style={styles.hint}>{t('Aucun thème ne correspond.')}</Text>}
            {!themeQuery.trim() && (
              <>
                <Text style={styles.subLabel}>{t('Thèmes populaires')}</Text>
                <View style={styles.wrap}>{tax.popular_themes.map(i => <Chip key={i.key} dim="theme" k={i.key} label={i.label} emoji={i.emoji} />)}</View>
                {!allThemes ? (
                  <Pressable testID="filters-all-themes" onPress={() => setAllThemes(true)} style={styles.linkBtn}>
                    <Text style={styles.linkText}>{t('Voir tous les thèmes')}</Text>
                    <Feather name="chevron-down" size={15} color={colors.chambray} />
                  </Pressable>
                ) : tax.themes.map(g => (
                  <View key={g.key}>
                    <Text style={styles.subLabel}>{g.emoji} {g.label}</Text>
                    <View style={styles.wrap}>{g.items.map(i => <Chip key={i.key} dim="theme" k={i.key} label={i.label} />)}</View>
                  </View>
                ))}
              </>
            )}
          </Section>

          <Section k="emotion" open={!!open.emotion} onFlip={flip} title={t('Émotions')} emoji="💫" hint={sel.emotion?.length}>
            <Text style={styles.hint}>{t('Ce que le livre te fait ressentir.')}</Text>
            <View style={styles.wrap}>{tax.emotions.map(e => <Chip key={e.key} dim="emotion" k={e.key} label={e.label} emoji={e.emoji} />)}</View>
          </Section>

          <Section k="mood" open={!!open.mood} onFlip={flip} title={t('Ambiance')} emoji="🌙" hint={sel.mood?.length}>
            <Text style={styles.hint}>{t('Le ton du livre.')}</Text>
            <View style={styles.wrap}>{tax.moods.map(m => <Chip key={m.key} dim="mood" k={m.key} label={m.label} emoji={m.emoji} />)}</View>
          </Section>

          <Section k="audience" open={!!open.audience} onFlip={flip} title={t('Public')} emoji="👥" hint={sel.audience?.length}>
            <View style={styles.wrap}>{tax.audiences.map(a => <Chip key={a.key} dim="audience" k={a.key} label={a.label} />)}</View>
          </Section>

          <Section k="lang" open={!!open.lang} onFlip={flip} title={t('Langue')} emoji="🗣️" hint={sel.lang?.length}>
            <View style={styles.wrap}>{tax.languages.map(l => <Chip key={l.key} dim="lang" k={l.key} label={l.label} />)}</View>
          </Section>
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        {selectedChips.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
            {selectedChips.map(c => (
              <Pressable key={`${c.dim}:${c.key}`} testID={`filters-selected-${c.dim}-${c.key}`} onPress={() => toggle(c.dim, c.key)} style={styles.selChip}>
                <Text style={styles.selChipText} numberOfLines={1}>{c.label}</Text>
                <Feather name="x" size={12} color={colors.creme} />
              </Pressable>
            ))}
          </ScrollView>
        )}
        <Pressable testID="filters-apply" onPress={apply} style={[styles.applyBtn, count === 0 && { opacity: 0.5 }]} disabled={count === 0}>
          <Text style={styles.applyText}>
            {count === null ? t('Voir les livres') : count === 0 ? t('Aucun livre pour ces filtres') : t(count > 1 ? 'Voir {n} livres' : 'Voir {n} livre', { n: count })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Section repliable, définie hors de l'écran pour garder une identité stable (le champ de
// recherche des thèmes conserve le focus pendant la saisie).
function Section({ k, title, emoji, children, hint, open, onFlip }: { k: string; title: string; emoji: string; children: React.ReactNode; hint?: number; open: boolean; onFlip: (k: string) => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Pressable testID={`filters-section-${k}`} onPress={() => onFlip(k)} style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{emoji}  {title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!!hint && <View style={styles.countPill}><Text style={styles.countText}>{hint}</Text></View>}
          <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.clay} />
        </View>
      </Pressable>
      {open && <View style={{ marginTop: spacing.sm }}>{children}</View>}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  iconBtn: { minWidth: 40, height: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  reset: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.chambray },
  intro: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, lineHeight: 18, marginBottom: spacing.md },
  section: { borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingVertical: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso },
  subLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: 6 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginBottom: 6, lineHeight: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 34, paddingHorizontal: 13, maxWidth: 230, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextOn: { color: colors.creme, fontFamily: fonts.bodyMedium },
  countPill: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.creme },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.espresso },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, alignSelf: 'flex-start' },
  linkText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.chambray },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.glacier, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.sm },
  selChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingLeft: 10, paddingRight: 8, borderRadius: radius.pill, backgroundColor: colors.chambray, maxWidth: 180 },
  selChipText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.creme },
  applyBtn: { marginHorizontal: spacing.xl, height: 50, borderRadius: radius.pill, backgroundColor: colors.espresso, alignItems: 'center', justifyContent: 'center' },
  applyText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.creme },
});
