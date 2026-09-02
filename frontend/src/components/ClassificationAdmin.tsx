import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import ManentLoader from '@/src/components/ManentLoader';
import { BottomSheet } from '@/src/components/BottomSheet';
import { ClassificationLines } from '@/src/components/ClassificationLines';
import { CatalogBookRow } from '@/src/components/CatalogBookRow';
import { DIM_LABELS, useTaxonomy } from '@/src/classification';

type Label = { dim: string; key: string; label: string; confidence: number; strong: boolean; proposed: boolean; source: string; method?: string; evidence?: string; origins?: string[] };
const DIM_ORDER = ['type', 'genre', 'continent', 'region', 'country', 'story_continent', 'story_region', 'story_country', 'domain', 'theme', 'emotion', 'mood', 'audience', 'lang'];
const METHOD_LABELS: Record<string, string> = {
  author_country: 'pays de l’auteur (donnée structurée)', source_category: 'catégorie bibliographique', legacy_subject: 'ancien sujet Manent',
  legacy_genre: 'ancien genre Manent', description_keyword: 'mot du résumé (faible)', language_field: 'langue de l’édition', kind: 'type détecté',
  derived_geo: 'déduit du pays', derived_family: 'déduit du sous-type', derived_from_genre: 'déduit du genre', ai: 'analyse IA',
  ai_story_context: 'IA — lieu de l’histoire', ai_author_origin: 'IA — origine de l’auteur (faible)', human_validation: 'validation humaine',
};

// Admin — classification d'un livre : étiquettes avec confiance, preuves (« Pourquoi ? »), confirmer / retirer / ajouter
// (corrections humaines prioritaires, conservées à chaque reclassification), conflits, « Reclassifier avec l'IA ».
export function ClassificationAdmin({ openId, onOpened }: { openId?: string | null; onOpened?: () => void }) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const tax = useTaxonomy();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [current, setCurrent] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [pickDim, setPickDim] = useState('theme');
  const [pickQ, setPickQ] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [why, setWhy] = useState<string | null>(null);

  useEffect(() => {
    const v = q.trim();
    if (v.length < 2) { setHits([]); return; }
    setSearching(true);
    const h = setTimeout(async () => {
      try { const r = await api<{ results: any[] }>(`/catalog/search?q=${encodeURIComponent(v)}&size=6`); setHits(r.results || []); } catch { setHits([]); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(h);
  }, [q]);

  const open = async (catalogId: string) => {
    setBusy(true); setMsg(null); setWhy(null);
    try { setCurrent(await api(`/catalog/admin/classification/${catalogId}`)); } catch { setMsg(t('Impossible de charger la classification.')); }
    setBusy(false);
  };
  useEffect(() => {
    if (openId) { open(openId); onOpened?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const patch = async (body: { add?: string[]; remove?: string[]; confirm?: string[] }) => {
    if (!current) return;
    setBusy(true);
    try { setCurrent(await api(`/catalog/admin/classification/${current.catalog_id}`, { method: 'PATCH', body: JSON.stringify(body) })); } catch { setMsg(t('Modification impossible.')); }
    setBusy(false);
  };
  const reclassify = async () => {
    if (!current) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api<any>(`/catalog/admin/classification/${current.catalog_id}/reclassify`, { method: 'POST' });
      setCurrent(r);
      setMsg(r.ai_ok ? t('Reclassifié avec l’IA. Tes corrections manuelles ont été conservées.') : t('L’IA n’a pas répondu : classification par règles conservée.'));
    } catch (e: any) {
      setMsg(String(e?.message || '').includes('429') ? t('Quota IA du jour atteint : réessaie demain.') : t('Reclassification impossible.'));
    }
    setBusy(false);
  };

  const thresholds = current?.thresholds || tax?.thresholds || { strong: 0.9, proposed: 0.7 };
  const grouped = useMemo(() => {
    const labels: Label[] = current?.classification?.labels || [];
    const out: Record<string, Label[]> = {};
    for (const l of labels) (out[l.dim] = out[l.dim] || []).push(l);
    return DIM_ORDER.filter(d => out[d]?.length).map(d => ({ dim: d, items: out[d] }));
  }, [current]);

  const pickItems = useMemo(() => {
    const all = Object.entries(tax?.labels?.[pickDim] || {}).map(([key, label]) => ({ key, label }));
    const v = pickQ.trim().toLowerCase();
    const cur = new Set((current?.classification?.labels || []).filter((l: Label) => l.confidence >= thresholds.proposed).map((l: Label) => `${l.dim}:${l.key}`));
    return all.filter(i => !cur.has(`${pickDim}:${i.key}`) && (!v || i.label.toLowerCase().includes(v))).sort((a, b) => a.label.localeCompare(b.label)).slice(0, 40);
  }, [tax, pickDim, pickQ, current, thresholds.proposed]);

  const cls = current?.classification || {};
  const conflicts: any[] = cls.conflicts || [];

  return (
    <View testID="admin-classification">
      <Text style={styles.sectionTitle}>{t('Classification d’un livre')}</Text>
      <View style={styles.searchBox}>
        <Feather name="search" size={15} color={colors.clay} />
        <TextInput testID="admin-cls-search" value={q} onChangeText={setQ} placeholder={t('Chercher un livre du catalogue…')} placeholderTextColor={colors.clay} style={styles.searchInput} />
        {searching ? <ManentLoader size={18} /> : !!q && <Pressable onPress={() => setQ('')} hitSlop={8}><Feather name="x" size={15} color={colors.clay} /></Pressable>}
      </View>
      {hits.map((b: any, i: number) => (
        <CatalogBookRow key={b.catalog_id} book={b} testID={`admin-cls-hit-${i}`} onPress={() => open(b.catalog_id)} />
      ))}

      <BottomSheet visible={!!current} onClose={() => setCurrent(null)} title={current?.title} subtitle={current?.author} testID="admin-cls-sheet">
        {current && (
          <View>
            <ClassificationLines lines={current.lines} />
            <Text style={styles.meta}>
              {t('Score global {s} % · moteur {e} · {a}', { s: Math.round((cls.score || 0) * 100), e: cls.engine_version || '—',
                a: cls.ai_version ? t('IA {m}', { m: cls.ai_model || '' }) : t('règles seules') + (cls.ai_reason ? ` (${cls.ai_reason})` : '') })}
            </Text>
            {conflicts.length > 0 && (
              <View style={styles.conflict} testID="admin-cls-conflict">
                <Feather name="alert-triangle" size={14} color="#B3552F" />
                <Text style={styles.conflictText}>
                  {conflicts.map(c => t('Conflit sur {d} : donnée structurée {a}, IA {b} ({p} %). La donnée structurée est conservée.', {
                    d: t(DIM_LABELS[c.dim] || c.dim), a: (c.structured || []).map((k: string) => tax?.labels?.[c.dim]?.[k] || k).join(', '),
                    b: tax?.labels?.[c.dim]?.[c.ai] || c.ai, p: Math.round((c.ai_confidence || 0) * 100) })).join('\n')}
                </Text>
              </View>
            )}
            {!!msg && <Text style={styles.msg}>{msg}</Text>}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md, flexWrap: 'wrap' }}>
              <Pressable testID="admin-cls-reclassify" onPress={reclassify} disabled={busy} style={[styles.primaryBtn, busy && { opacity: 0.5 }]}>
                <Feather name="refresh-cw" size={13} color={colors.creme} />
                <Text style={styles.primaryText}>{t('Reclassifier avec l’IA')}</Text>
              </Pressable>
              <Pressable testID="admin-cls-add" onPress={() => { setPickQ(''); setPicker(true); }} disabled={busy} style={styles.ghostBtn}>
                <Feather name="plus" size={13} color={colors.espresso} />
                <Text style={styles.ghostText}>{t('Ajouter')}</Text>
              </Pressable>
            </View>
            <Text style={styles.legend}>
              {t('● fiable (≥ {s} %)   ◐ à vérifier ({p}–{s2} %)   ○ faible (< {p2} %, ignorée)   ✓ validée à la main   ·   touche une étiquette pour voir pourquoi',
                { s: Math.round(thresholds.strong * 100), p: Math.round(thresholds.proposed * 100), s2: Math.round(thresholds.strong * 100) - 1, p2: Math.round(thresholds.proposed * 100) })}
            </Text>
            {!!why && <View style={styles.whyBox} testID="admin-cls-why"><Text style={styles.whyText}>{why}</Text></View>}
            {grouped.map(g => (
              <View key={g.dim} style={{ marginTop: spacing.md }}>
                <Text style={styles.dimLabel}>{t(DIM_LABELS[g.dim] || g.dim)}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {g.items.map(l => {
                    const weak = l.confidence < thresholds.proposed;
                    const mark = l.source === 'admin' ? '✓' : l.strong ? '●' : l.proposed ? '◐' : '○';
                    const explain = () => setWhy(
                      `${l.label} — ${Math.round(l.confidence * 100)} %\n${t('Méthode')} : ${t(METHOD_LABELS[l.method || ''] || l.method || l.source)}`
                      + ((l.origins || []).length ? `\n${t('Sources')} : ${(l.origins || []).join(', ')}` : '')
                      + (l.evidence ? `\n${t('Preuve')} : ${l.evidence}` : `\n${t('Preuve')} : ${t('aucune justification enregistrée')}`));
                    return (
                      <Pressable key={l.key} onPress={explain} style={[styles.tag, weak && styles.tagWeak, l.source === 'admin' && styles.tagAdmin]} testID={`admin-cls-tag-${g.dim}-${l.key}`}>
                        <Text style={[styles.tagText, weak && { color: colors.clay }]}>{mark} {l.label} · {Math.round(l.confidence * 100)} %</Text>
                        {(weak || l.proposed) && l.source !== 'admin' && (
                          <Pressable testID={`admin-cls-validate-${g.dim}-${l.key}`} onPress={() => patch({ confirm: [`${g.dim}:${l.key}`] })} hitSlop={6}>
                            <Feather name="check" size={13} color={colors.chambray} />
                          </Pressable>
                        )}
                        {!weak && (
                          <Pressable testID={`admin-cls-remove-${g.dim}-${l.key}`} onPress={() => patch({ remove: [`${g.dim}:${l.key}`] })} hitSlop={6}>
                            <Feather name="x" size={13} color={colors.clay} />
                          </Pressable>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {(current.raw_subjects || []).length > 0 && (
              <Text style={styles.raw}>{t('Catégories sources')} : {current.raw_subjects.slice(0, 8).join(' · ')}</Text>
            )}
          </View>
        )}
      </BottomSheet>

      <BottomSheet visible={picker} onClose={() => setPicker(false)} title={t('Ajouter une étiquette')} testID="admin-cls-picker">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: spacing.sm }}>
          {DIM_ORDER.filter(d => !d.endsWith('continent') && !d.endsWith('region')).map(d => (
            <Pressable key={d} testID={`admin-cls-dim-${d}`} onPress={() => setPickDim(d)} style={[styles.chip, pickDim === d && styles.chipOn]}>
              <Text style={[styles.chipText, pickDim === d && { color: colors.creme }]}>{t(DIM_LABELS[d])}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.searchBox}>
          <Feather name="search" size={15} color={colors.clay} />
          <TextInput testID="admin-cls-pick-search" value={pickQ} onChangeText={setPickQ} placeholder={t('Filtrer…')} placeholderTextColor={colors.clay} style={styles.searchInput} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {pickItems.map(i => (
            <Pressable key={i.key} testID={`admin-cls-pick-${pickDim}-${i.key}`} onPress={() => { setPicker(false); patch({ add: [`${pickDim}:${i.key}`] }); }} style={styles.chip}>
              <Text style={styles.chipText}>{i.label}</Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  sectionTitle: { fontFamily: fonts.displayMedium, fontSize: 21, color: colors.espresso, marginTop: spacing.xl, marginBottom: spacing.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.espresso },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, marginTop: spacing.sm },
  msg: { fontFamily: fonts.body, fontSize: 12.5, color: colors.chambray, marginTop: spacing.sm },
  conflict: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#F6E3DA', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  conflictText: { fontFamily: fonts.body, fontSize: 12, color: colors.espresso, flex: 1, lineHeight: 16 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.chambray },
  primaryText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.creme },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft },
  ghostText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.espresso },
  legend: { fontFamily: fonts.body, fontSize: 10.5, color: colors.clay, marginTop: spacing.md, lineHeight: 15 },
  whyBox: { backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  whyText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.espresso, lineHeight: 18 },
  dimLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.bisque },
  tagWeak: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderSoft },
  tagAdmin: { backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.chambray },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.espresso },
  raw: { fontFamily: fonts.body, fontSize: 11, color: colors.clay, marginTop: spacing.md, lineHeight: 15 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.espresso },
});
