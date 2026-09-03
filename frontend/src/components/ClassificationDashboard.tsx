import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import { BottomSheet } from '@/src/components/BottomSheet';
import { CatalogBookRow } from '@/src/components/CatalogBookRow';
import { DIM_LABELS, loadTaxonomy } from '@/src/classification';

// Admin — tableau de bord du moteur IA : livres (classés, non classés, faible confiance, en file, erreurs),
// appels IA (nombre, succès, durée, modèle), classifications les plus utilisées, corrections ;
// lots (« Classifier les nouveaux livres », « Reclassifier les livres à faible confiance »…),
// livres à vérifier (conflits), seuils configurables, taxonomie administrable.
export function ClassificationDashboard({ onOpenBook }: { onOpenBook: (catalogId: string) => void }) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [stats, setStats] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [review, setReview] = useState<any[] | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [strong, setStrong] = useState('');
  const [proposed, setProposed] = useState('');
  const [limit, setLimit] = useState('');
  const [taxo, setTaxo] = useState<any>(null);
  const [taxoSheet, setTaxoSheet] = useState(false);
  const [entry, setEntry] = useState<{ dim: string; label: string; emoji: string; group: string; parent: string }>({ dim: 'theme', label: '', emoji: '', group: '', parent: '' });

  const load = useCallback(async () => {
    try { setStats(await api('/catalog/admin/classification-stats')); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const batch = async (mode: string) => {
    setMsg(null);
    try {
      const r = await api<{ queued: number }>('/catalog/admin/classification/batch', { method: 'POST', body: JSON.stringify({ mode }) });
      setMsg(t('{n} livres mis en file. Le travailleur de fond les traite dans la limite du quota IA.', { n: r.queued }));
      load();
    } catch { setMsg(t('Lancement impossible.')); }
  };
  const loadReview = async () => {
    try { const r = await api<{ books: any[] }>('/catalog/admin/classification/review?size=20'); setReview(r.books || []); } catch { setReview([]); }
  };
  const openSettings = async () => {
    try {
      const r = await api<any>('/catalog/admin/classification/settings');
      setSettings(r.settings); setStrong(String(Math.round(r.settings.strong * 100))); setProposed(String(Math.round(r.settings.proposed * 100))); setLimit(String(r.settings.daily_limit));
    } catch {}
  };
  const saveSettings = async () => {
    try {
      const body: any = { strong: Number(strong) / 100, proposed: Number(proposed) / 100, daily_limit: Number(limit) };
      const r = await api<any>('/catalog/admin/classification/settings', { method: 'PATCH', body: JSON.stringify(body) });
      setSettings(r.settings); setMsg(t('Réglages enregistrés. Ils s’appliquent aux prochaines classifications.')); load();
    } catch { setMsg(t('Réglages invalides (le seuil « à vérifier » doit rester sous le seuil « fiable »).')); }
  };
  const toggleAi = async () => {
    try { const r = await api<any>('/catalog/admin/classification/settings', { method: 'PATCH', body: JSON.stringify({ ai_enabled: !settings?.ai_enabled }) }); setSettings(r.settings); } catch {}
  };
  const openTaxo = async () => {
    try { setTaxo(await api('/catalog/admin/taxonomy')); setTaxoSheet(true); } catch {}
  };
  const addEntry = async () => {
    if (!entry.label.trim()) return;
    try {
      await api('/catalog/admin/taxonomy', { method: 'POST', body: JSON.stringify({ dim: entry.dim, label: entry.label.trim(), emoji: entry.emoji || undefined, group: entry.group || undefined, parent: entry.parent || undefined }) });
      setEntry(e => ({ ...e, label: '' }));
      await loadTaxonomy(true);
      setTaxo(await api('/catalog/admin/taxonomy'));
      setMsg(t('Entrée ajoutée : elle apparaît immédiatement dans les filtres, la recherche et l’IA.'));
    } catch (e: any) { setMsg(String(e?.message || '').includes('409') ? t('Cette entrée existe déjà.') : t('Ajout impossible : vérifie la dimension et le parent.')); }
  };
  const removeEntry = async (dim: string, key: string) => {
    try { await api(`/catalog/admin/taxonomy/${dim}/${key}`, { method: 'DELETE' }); setTaxo(await api('/catalog/admin/taxonomy')); } catch {}
  };

  const needsParent = ['region', 'country', 'type'].includes(entry.dim);
  const needsGroup = ['theme', 'domain'].includes(entry.dim);
  const parents: any[] = needsParent ? (taxo?.parents?.[entry.dim] || []) : needsGroup ? (taxo?.groups?.[entry.dim] || []) : [];

  const Stat = ({ k, label, warn }: { k: string; label: string; warn?: boolean }) => (
    <View style={[styles.statCard, warn && (stats?.[k] || 0) > 0 && styles.statWarn]} testID={`admin-ia-stat-${k}`}>
      <Text style={styles.statNum}>{stats?.[k] ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View testID="admin-ia-dashboard">
      <Text style={styles.sectionTitle}>{t('Moteur IA de classification')}</Text>
      {stats && (
        <>
          <View style={styles.grid}>
            <Stat k="total" label={t('Livres')} />
            <Stat k="classified" label={t('Classés')} />
            <Stat k="unclassified" label={t('Non classés')} />
            <Stat k="low_confidence" label={t('Faible confiance')} warn />
            <Stat k="pending" label={t('En file')} />
            <Stat k="failed" label={t('Erreurs')} warn />
            <Stat k="needs_review" label={t('À vérifier')} warn />
            <Stat k="ai" label={t('Avec l’IA')} />
            <Stat k="corrections" label={t('Corrections')} />
          </View>
          <Text style={styles.meta}>
            {t('Moteur {e} · prompt {p} · {m} via {v}{off} · quota du jour {u}/{l} · analyses {n}, succès {s} %, {ms} ms en moyenne · {r} classifications en {rm} ms',
              { e: stats.engine_version, p: stats.prompt_version, m: stats.model, v: stats.provider, off: stats.ai_available ? '' : ` (${t('clé IA absente')})`,
                u: stats.quota_used, l: stats.quota_limit, n: stats.ai_calls?.classify?.n ?? 0,
                s: Math.round((stats.ai_calls?.classify?.success_rate ?? 0) * 100), ms: stats.ai_calls?.classify?.avg_ms ?? 0,
                r: stats.runs?.n ?? 0, rm: stats.runs?.avg_ms ?? 0 })}
          </Text>
          {(stats.top_themes || []).length > 0 && (
            <Text style={styles.meta}>{t('Thèmes les plus utilisés')} : {stats.top_themes.map((x: any) => `${x.label} (${x.n})`).join(' · ')}</Text>
          )}
          {(stats.top_countries || []).length > 0 && (
            <Text style={styles.meta}>{t('Origines les plus fréquentes')} : {stats.top_countries.map((x: any) => `${x.label} (${x.n})`).join(' · ')}</Text>
          )}
          {(stats.frequent_errors || []).length > 0 && (
            <Text style={styles.meta}>{t('Corrections fréquentes')} : {stats.frequent_errors.map((x: any) => `${x.label} ${x.action === 'remove' ? '✗' : '✓'} (${x.n})`).join(' · ')}</Text>
          )}
        </>
      )}
      {!!msg && <Text style={styles.msg}>{msg}</Text>}
      <View style={styles.row}>
        <Pressable testID="admin-ia-batch-new" onPress={() => batch('new')} style={styles.primaryBtn}><Text style={styles.primaryText}>{t('Classifier les nouveaux livres')}</Text></Pressable>
        <Pressable testID="admin-ia-batch-low" onPress={() => batch('low_confidence')} style={styles.ghostBtn}><Text style={styles.ghostText}>{t('Reclassifier les livres à faible confiance')}</Text></Pressable>
        {(stats?.outdated || 0) > 0 && <Pressable testID="admin-ia-batch-outdated" onPress={() => batch('outdated')} style={styles.ghostBtn}><Text style={styles.ghostText}>{t('Mettre à jour vers le moteur {e} ({n})', { e: stats.engine_version, n: stats.outdated })}</Text></Pressable>}
        {(stats?.failed || 0) > 0 && <Pressable testID="admin-ia-batch-failed" onPress={() => batch('failed')} style={styles.ghostBtn}><Text style={styles.ghostText}>{t('Relancer les erreurs')}</Text></Pressable>}
        <Pressable testID="admin-ia-review" onPress={loadReview} style={styles.ghostBtn}><Feather name="alert-triangle" size={13} color={colors.espresso} /><Text style={styles.ghostText}>{t('Livres à vérifier')}</Text></Pressable>
        <Pressable testID="admin-ia-settings" onPress={openSettings} style={styles.ghostBtn}><Feather name="sliders" size={13} color={colors.espresso} /><Text style={styles.ghostText}>{t('Seuils et quota')}</Text></Pressable>
        <Pressable testID="admin-ia-taxonomy" onPress={openTaxo} style={styles.ghostBtn}><Feather name="tag" size={13} color={colors.espresso} /><Text style={styles.ghostText}>{t('Taxonomie')}</Text></Pressable>
      </View>

      {review && (
        <View style={{ marginTop: spacing.md }} testID="admin-ia-review-list">
          <Text style={styles.dimLabel}>{t('À vérifier (conflits ou faible confiance)')}</Text>
          {review.length === 0 ? <Text style={styles.meta}>{t('Rien à vérifier pour l’instant.')}</Text>
            : review.map((b: any, i: number) => <CatalogBookRow key={b.catalog_id} book={b} testID={`admin-ia-review-${i}`} onPress={() => onOpenBook(b.catalog_id)} />)}
        </View>
      )}

      <BottomSheet visible={!!settings} onClose={() => setSettings(null)} title={t('Seuils et quota')} testID="admin-ia-settings-sheet">
        {settings && (
          <View>
            <Text style={styles.meta}>{t('Fiable à partir de (%), à vérifier à partir de (%), analyses IA par jour. Sous le second seuil, une étiquette n’est jamais utilisée pour les filtres sans validation humaine.')}</Text>
            <View style={styles.row}>
              {[['strong', strong, setStrong, t('Fiable ≥')], ['proposed', proposed, setProposed, t('À vérifier ≥')], ['limit', limit, setLimit, t('Quota IA / jour')]].map(([k, v, set, lab]: any) => (
                <View key={k} style={{ flex: 1, minWidth: 100 }}>
                  <Text style={styles.dimLabel}>{lab}</Text>
                  <TextInput testID={`admin-ia-setting-${k}`} value={v} onChangeText={set} keyboardType="number-pad" style={styles.input} />
                </View>
              ))}
            </View>
            <View style={styles.row}>
              <Pressable testID="admin-ia-settings-save" onPress={saveSettings} style={styles.primaryBtn}><Text style={styles.primaryText}>{t('Enregistrer')}</Text></Pressable>
              <Pressable testID="admin-ia-toggle-ai" onPress={toggleAi} style={styles.ghostBtn}><Text style={styles.ghostText}>{settings.ai_enabled ? t('Désactiver l’IA (règles seules)') : t('Activer l’IA')}</Text></Pressable>
            </View>
          </View>
        )}
      </BottomSheet>

      <BottomSheet visible={taxoSheet} onClose={() => setTaxoSheet(false)} title={t('Taxonomie')} subtitle={t('Ajoute un thème, une émotion, un pays… sans toucher au code.')} testID="admin-ia-taxonomy-sheet">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: spacing.sm }}>
          {(taxo?.dims || []).map((d: string) => (
            <Pressable key={d} testID={`admin-taxo-dim-${d}`} onPress={() => setEntry(e => ({ ...e, dim: d, parent: '', group: '' }))} style={[styles.chip, entry.dim === d && styles.chipOn]}>
              <Text style={[styles.chipText, entry.dim === d && { color: colors.creme }]}>{t((DIM_LABELS[d] || d).replace(/ \(.*\)$/, ''))}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.row}>
          <TextInput testID="admin-taxo-label" value={entry.label} onChangeText={v => setEntry(e => ({ ...e, label: v }))} placeholder={entry.dim === 'country' ? t('Nom du pays (clé = code ISO à 2 lettres)') : t('Libellé')} placeholderTextColor={colors.clay} style={[styles.input, { flex: 2 }]} />
          <TextInput testID="admin-taxo-emoji" value={entry.emoji} onChangeText={v => setEntry(e => ({ ...e, emoji: v }))} placeholder="🙂" placeholderTextColor={colors.clay} style={[styles.input, { width: 60 }]} />
        </View>
        {entry.dim === 'country' && (
          <TextInput testID="admin-taxo-key" value={entry.group} onChangeText={v => setEntry(e => ({ ...e, group: v.toUpperCase() }))} placeholder={t('Code ISO (ex. CV)')} placeholderTextColor={colors.clay} style={styles.input} autoCapitalize="characters" maxLength={2} />
        )}
        {parents.length > 0 && (
          <>
            <Text style={styles.dimLabel}>{needsParent ? t('Parent') : t('Groupe')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm }}>
              {parents.map((p: any) => {
                const on = needsParent ? entry.parent === p.key : entry.group === p.key;
                return (
                  <Pressable key={p.key} testID={`admin-taxo-parent-${p.key}`} onPress={() => setEntry(e => needsParent ? { ...e, parent: p.key } : { ...e, group: p.key })} style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && { color: colors.creme }]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        <Pressable testID="admin-taxo-add" onPress={() => {
          if (entry.dim === 'country') { api('/catalog/admin/taxonomy', { method: 'POST', body: JSON.stringify({ dim: 'country', key: entry.group, label: entry.label.trim(), parent: entry.parent }) }).then(async () => { await loadTaxonomy(true); setTaxo(await api('/catalog/admin/taxonomy')); setEntry(e => ({ ...e, label: '', group: '' })); }).catch(() => setMsg(t('Ajout impossible : vérifie la dimension et le parent.'))); return; }
          addEntry();
        }} style={[styles.primaryBtn, !entry.label.trim() && { opacity: 0.5 }]} disabled={!entry.label.trim()}>
          <Feather name="plus" size={13} color={colors.creme} /><Text style={styles.primaryText}>{t('Ajouter')}</Text>
        </Pressable>
        {(taxo?.custom || []).length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.dimLabel}>{t('Ajoutées depuis l’admin')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {taxo.custom.map((c: any) => (
                <View key={`${c.dim}:${c.key}`} style={styles.tag}>
                  <Text style={styles.tagText}>{c.emoji ? `${c.emoji} ` : ''}{c.label} · {t((DIM_LABELS[c.dim] || c.dim).replace(/ \(.*\)$/, ''))}</Text>
                  <Pressable testID={`admin-taxo-remove-${c.dim}-${c.key}`} onPress={() => removeEntry(c.dim, c.key)} hitSlop={6}><Feather name="x" size={13} color={colors.clay} /></Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  sectionTitle: { fontFamily: fonts.displayMedium, fontSize: 21, color: colors.espresso, marginTop: spacing.xl, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { width: '30%', flexGrow: 1, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.sm, alignItems: 'center' },
  statWarn: { borderColor: '#B3552F' },
  statNum: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: 8.5, color: colors.clay, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, marginTop: spacing.sm, lineHeight: 16 },
  msg: { fontFamily: fonts.body, fontSize: 12.5, color: colors.chambray, marginTop: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.chambray },
  primaryText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.creme },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme },
  ghostText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.espresso },
  dimLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6, marginTop: spacing.sm },
  input: { height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 14, color: colors.espresso, marginBottom: spacing.sm },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.espresso },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.bisque },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.espresso },
});
