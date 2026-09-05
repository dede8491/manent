import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import { BottomSheet } from '@/src/components/BottomSheet';

type Report = { db: string; text: string; test_accounts: any[]; kept_accounts: any[]; counts: Record<string, number>; result?: { backup: string; deleted: number } };

// Admin — nettoyage des données de test : analyse (rien n'est supprimé), liste des comptes concernés,
// protection / ajout manuel, puis suppression après confirmation écrite. Même logique que le script serveur.
export function CleanupAdmin() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [keep, setKeep] = useState('');
  const [remove, setRemove] = useState('');
  const [confirmSheet, setConfirmSheet] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const lists = () => ({ keep: keep.split(',').map(x => x.trim()).filter(Boolean), remove: remove.split(',').map(x => x.trim()).filter(Boolean) });

  const analyse = async () => {
    setBusy(true); setMsg(null);
    try { setReport(await api('/admin/cleanup-test-data', { method: 'POST', body: JSON.stringify({ apply: false, ...lists() }) })); }
    catch { setMsg(t('Analyse impossible.')); }
    setBusy(false);
  };
  const apply = async () => {
    if (confirmText.trim() !== 'SUPPRIMER') return;
    setBusy(true); setMsg(null); setConfirmSheet(false);
    try {
      const r = await api<Report>('/admin/cleanup-test-data', { method: 'POST', body: JSON.stringify({ apply: true, confirm: 'SUPPRIMER', ...lists() }) });
      setReport(r);
      setMsg(t('{n} documents supprimés. Sauvegarde : {b}', { n: r.result?.deleted ?? 0, b: r.result?.backup || '' }));
    } catch { setMsg(t('Suppression impossible.')); }
    setBusy(false); setConfirmText('');
  };
  const n = report?.test_accounts?.length || 0;

  return (
    <View testID="admin-cleanup">
      <Text style={styles.sectionTitle}>{t('Données de test')}</Text>
      <Text style={styles.help}>{t('Comptes créés par les tests automatiques et la démo (e-mails @example.com, pseudos générés, « Léa »), contenus « TEST_ », orphelins. L’analyse ne supprime rien.')}</Text>
      <View style={styles.row}>
        <TextInput testID="cleanup-keep" value={keep} onChangeText={setKeep} placeholder={t('Protéger : @handle, e-mail…')} placeholderTextColor={colors.clay} style={styles.input} autoCapitalize="none" />
        <TextInput testID="cleanup-remove" value={remove} onChangeText={setRemove} placeholder={t('Ajouter : @handle, e-mail…')} placeholderTextColor={colors.clay} style={styles.input} autoCapitalize="none" />
      </View>
      <View style={styles.row}>
        <Pressable testID="cleanup-analyse" onPress={analyse} disabled={busy} style={[styles.ghostBtn, busy && { opacity: 0.5 }]}>
          <Feather name="search" size={13} color={colors.espresso} /><Text style={styles.ghostText}>{busy ? '…' : t('Analyser')}</Text>
        </Pressable>
        {report && !report.result && n > 0 && (
          <Pressable testID="cleanup-apply" onPress={() => setConfirmSheet(true)} disabled={busy} style={styles.dangerBtn}>
            <Feather name="trash-2" size={13} color={colors.creme} /><Text style={styles.dangerText}>{t('Supprimer {n} comptes de test', { n })}</Text>
          </Pressable>
        )}
      </View>
      {!!msg && <Text style={styles.msg}>{msg}</Text>}
      {report && (
        <View style={styles.reportBox} testID="cleanup-report">
          <Text style={styles.dimLabel}>{t('Base : {db}', { db: report.db })}</Text>
          <Text style={styles.dimLabel}>{t('Comptes de test détectés ({n})', { n })}</Text>
          {report.test_accounts.map((a: any) => (
            <Text key={a.handle || a.email} style={styles.line}>– {a.pseudo}  @{a.handle}  {a.email}  {a.created_at}  ·  {a.books} {t('livres')}, {a.quotes} {t('citations')}</Text>
          ))}
          <Text style={[styles.dimLabel, { marginTop: spacing.sm }]}>{t('Comptes conservés ({n})', { n: report.kept_accounts.length })}</Text>
          {report.kept_accounts.map((a: any) => (
            <Text key={a.handle || a.email} style={[styles.line, { color: colors.chambray }]}>· {a.pseudo}  @{a.handle}  {a.email}{a.is_admin ? '  (admin)' : ''}</Text>
          ))}
          <Text style={[styles.dimLabel, { marginTop: spacing.sm }]}>{t('À supprimer, par collection')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.line}>{Object.entries(report.counts).map(([k, v]) => `${k} ${v}`).join('  ·  ')}</Text>
          </ScrollView>
        </View>
      )}
      <BottomSheet visible={confirmSheet} onClose={() => setConfirmSheet(false)} title={t('Confirmer la suppression')} subtitle={t('{n} comptes de test et tout leur contenu. Une sauvegarde est écrite sur le serveur avant.', { n })} testID="cleanup-confirm" scroll={false}>
        <Text style={styles.help}>{t('Tape SUPPRIMER pour confirmer.')}</Text>
        <TextInput testID="cleanup-confirm-input" value={confirmText} onChangeText={setConfirmText} placeholder="SUPPRIMER" placeholderTextColor={colors.clay} style={styles.input} autoCapitalize="characters" />
        <Pressable testID="cleanup-confirm-go" onPress={apply} disabled={confirmText.trim() !== 'SUPPRIMER'} style={[styles.dangerBtn, { marginTop: spacing.md, alignSelf: 'flex-start' }, confirmText.trim() !== 'SUPPRIMER' && { opacity: 0.4 }]}>
          <Feather name="trash-2" size={13} color={colors.creme} /><Text style={styles.dangerText}>{t('Supprimer définitivement')}</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  sectionTitle: { fontFamily: fonts.displayMedium, fontSize: 21, color: colors.espresso, marginTop: spacing.xl, marginBottom: spacing.xs },
  help: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, lineHeight: 17, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  input: { flex: 1, minWidth: 140, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme },
  ghostText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.espresso },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: '#B3552F' },
  dangerText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.creme },
  msg: { fontFamily: fonts.body, fontSize: 12.5, color: colors.chambray, marginBottom: spacing.sm },
  reportBox: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  dimLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  line: { fontFamily: fonts.body, fontSize: 12, color: colors.espresso, lineHeight: 17 },
});
