import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Platform, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles, useScheme, useToggleScheme } from '@/src/themeCtx';
import { useAuth } from '@/src/auth';
import { api } from '@/src/api';
import { PrimaryButton, GhostButton } from '@/src/components/Button';

const PRIVACY = `Manent respecte le RGPD (Règlement général sur la protection des données).

Ce que nous collectons : ton e-mail, ton pseudo, tes livres, citations, tableaux, clubs et statistiques de lecture. Rien d'autre.

Ce que nous en faisons : uniquement faire fonctionner l'app. Tes citations restent privées par défaut ; toi seul décides de les rendre publiques.

Ce que nous ne faisons jamais : vendre tes données, les partager avec des annonceurs, ou analyser tes lectures à des fins publicitaires.

Tes droits (articles 15 à 21 du RGPD) : accès, rectification, portabilité (bouton « Télécharger mes données ») et effacement (bouton « Supprimer mon compte » — suppression immédiate et définitive).

Hébergement : tes données sont stockées de manière sécurisée, les photos de pages transitent uniquement pour la transcription et ne sont pas conservées par le modèle d'IA.

Contact : bonjour@manent.app`;

const TERMS = `Conditions d'utilisation — l'essentiel, sans jargon.

1. Manent t'aide à garder ce que tes lectures te laissent. Ton contenu t'appartient, tu nous accordes seulement le droit technique de l'afficher dans l'app.

2. Les citations que tu rends publiques restent de courts extraits relevant du droit de courte citation. Tu t'engages à créditer l'œuvre et à ne pas publier de passages entiers.

3. Respect entre lecteurs : pas de contenu haineux, illégal ou hors sujet dans les clubs et les profils publics. Nous pouvons retirer un contenu signalé.

4. Le Premium est un abonnement facultatif, résiliable à tout moment.

5. Les liens librairies sont affiliés : une commission nous est reversée, sans surcoût pour toi.

6. Nous pouvons faire évoluer l'app ; les changements importants te seront annoncés.`;

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { user, signOut } = useAuth();
  const scheme = useScheme();
  const toggleScheme = useToggleScheme();
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [defaultPublic, setDefaultPublic] = useState(false);
  const [doc, setDoc] = useState<null | 'privacy' | 'terms'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s = await api<{ language: 'fr' | 'en'; default_public: boolean }>('/me/settings', { method: 'PATCH', body: JSON.stringify({}) });
        setLanguage(s.language); setDefaultPublic(s.default_public);
      } catch {}
    })();
  }, []);

  const saveSettings = async (patch: any) => {
    try { await api('/me/settings', { method: 'PATCH', body: JSON.stringify(patch) }); } catch {}
  };

  const exportData = async () => {
    setBusy('export'); setFeedback('');
    try {
      const data = await api<any>('/me/export');
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'manent-mes-donnees.json';
        document.body.appendChild(a); a.click(); a.remove();
        setFeedback('Données téléchargées.');
      } else {
        const path = `${FileSystem.cacheDirectory}manent-mes-donnees.json`;
        await FileSystem.writeAsStringAsync(path, json);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Mes données Manent' });
        }
      }
    } catch {
      setFeedback("L'export a échoué. Réessaie.");
    } finally { setBusy(null); }
  };

  const deleteAccount = async () => {
    setBusy('delete');
    try {
      await api('/me', { method: 'DELETE' });
      setConfirmDelete(false);
      signOut();
    } catch {
      setBusy(null);
      Alert.alert('Suppression impossible', 'Réessaie dans un instant.');
    }
  };

  const Row = ({ icon, label, right, onPress, testID, danger }: any) => (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} style={styles.row}>
      <Feather name={icon} size={18} color={danger ? '#B3552F' : colors.espresso} />
      <Text style={[styles.rowLabel, danger && { color: '#B3552F' }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-settings">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="settings-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.h1}>Paramètres</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.sm }}>
        <Text style={styles.section}>Compte</Text>
        <View style={styles.card}>
          <Text style={styles.accountName}>{user?.pseudo}</Text>
          <Text style={styles.accountMail}>{user?.email}</Text>
        </View>

        <Text style={styles.section}>Langue</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable testID="lang-fr" onPress={() => { setLanguage('fr'); saveSettings({ language: 'fr' }); }} style={[styles.langChip, language === 'fr' && styles.langActive]}>
            <Text style={[styles.langText, language === 'fr' && styles.langTextActive]}>Français</Text>
          </Pressable>
          <View style={[styles.langChip, { opacity: 0.5 }]} testID="lang-en">
            <Text style={styles.langText}>English</Text>
            <Text style={styles.langSoon}>bientôt</Text>
          </View>
        </View>

        <Text style={styles.section}>Apparence</Text>
        <Row
          testID="settings-darkmode"
          icon={scheme === 'dark' ? 'sun' : 'moon'}
          label="Mode sombre"
          onPress={toggleScheme}
          right={
            <View style={[styles.switch, scheme === 'dark' && { backgroundColor: colors.chambray }]}>
              <View style={[styles.knob, scheme === 'dark' && { alignSelf: 'flex-end' }]} />
            </View>
          }
        />

        <Text style={styles.section}>Confidentialité</Text>
        <Row
          testID="settings-default-public"
          icon="eye"
          label="Citations publiques par défaut"
          onPress={() => { const v = !defaultPublic; setDefaultPublic(v); saveSettings({ default_public: v }); }}
          right={
            <View style={[styles.switch, defaultPublic && { backgroundColor: colors.chambray }]}>
              <View style={[styles.knob, defaultPublic && { alignSelf: 'flex-end' }]} />
            </View>
          }
        />
        <Row testID="settings-export" icon="download" label={busy === 'export' ? 'Export en cours…' : 'Télécharger mes données'} onPress={exportData} right={busy === 'export' ? <ActivityIndicator size="small" color={colors.chambray} /> : <Feather name="chevron-right" size={18} color={colors.clay} />} />
        {feedback ? <Text style={styles.feedback} testID="settings-feedback">{feedback}</Text> : null}
        <Row testID="settings-privacy" icon="shield" label="Politique de confidentialité (RGPD)" onPress={() => setDoc('privacy')} right={<Feather name="chevron-right" size={18} color={colors.clay} />} />
        <Row testID="settings-terms" icon="file-text" label="Conditions d'utilisation" onPress={() => setDoc('terms')} right={<Feather name="chevron-right" size={18} color={colors.clay} />} />

        <Text style={styles.section}>Zone sensible</Text>
        <Row testID="settings-delete" icon="trash-2" label="Supprimer mon compte" danger onPress={() => setConfirmDelete(true)} />
        <Text style={styles.note}>Suppression immédiate et définitive de toutes tes données (RGPD, droit à l&rsquo;effacement).</Text>

        <Text style={styles.about}>Manent · verba volant, scripta manent</Text>
      </ScrollView>

      <Modal visible={doc !== null} animationType="slide" transparent onRequestClose={() => setDoc(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>{doc === 'privacy' ? 'Confidentialité' : 'Conditions d\u2019utilisation'}</Text>
            <ScrollView style={{ maxHeight: 420 }} testID="doc-content">
              <Text style={styles.docText}>{doc === 'privacy' ? PRIVACY : TERMS}</Text>
            </ScrollView>
            <View style={{ height: spacing.md }} />
            <GhostButton testID="doc-close" title="Fermer" onPress={() => setDoc(null)} />
          </View>
        </View>
      </Modal>

      <Modal visible={confirmDelete} animationType="fade" transparent onRequestClose={() => setConfirmDelete(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: spacing.xl }]}>
          <View style={[styles.modal, { borderRadius: 20 }]}>
            <Text style={styles.modalTitle}>Tu es sûr ?</Text>
            <Text style={styles.docText}>Tes livres, citations, tableaux et clubs seront supprimés définitivement. Cette action est irréversible.</Text>
            <View style={{ height: spacing.lg }} />
            <PrimaryButton testID="delete-confirm" title={busy === 'delete' ? 'Suppression…' : 'Supprimer définitivement'} onPress={deleteAccount} style={{ backgroundColor: '#B3552F' }} />
            <GhostButton testID="delete-cancel" title="Garder mon compte" onPress={() => setConfirmDelete(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  section: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: 2 },
  card: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  accountName: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  accountMail: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 2 },
  langChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme },
  langActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  langText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.espresso },
  langTextActive: { color: colors.creme },
  langSoon: { fontFamily: fonts.body, fontSize: 10, color: colors.clay, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, backgroundColor: colors.creme, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.borderSoft },
  rowLabel: { fontFamily: fonts.body, fontSize: 14.5, color: colors.espresso },
  switch: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.borderSoft, padding: 3, justifyContent: 'center' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5EDE4', alignSelf: 'flex-start' },
  feedback: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, textAlign: 'center' },
  note: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, lineHeight: 16, paddingHorizontal: spacing.xs },
  about: { fontFamily: fonts.display, fontSize: 13, color: colors.clay, textAlign: 'center', marginTop: spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.glacier, padding: spacing.xl, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  grabber: { width: 44, height: 4, backgroundColor: colors.borderSoft, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, marginBottom: spacing.sm },
  docText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, lineHeight: 21 },
});
