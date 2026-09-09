import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles, useScheme, useSchemePref } from '@/src/themeCtx';
import { Chip } from '@/src/components/Chip';
import { useAuth } from '@/src/auth';
import { useI18n } from '@/src/i18n';
import { api } from '@/src/api';
import { PrimaryButton, GhostButton } from '@/src/components/Button';
import ManentLoader from '@/src/components/ManentLoader';

const PRIVACY_EN = `Manent complies with the GDPR (General Data Protection Regulation).

What we collect: your email, username, books, quotes, boards, clubs and reading statistics. Nothing else.

What we do with it: only run the app. Your quotes stay private by default; you alone decide to make them public.

What we never do: sell your data, share it with advertisers, or analyze your reading for advertising purposes.

Your rights (GDPR articles 15 to 21): access, rectification, portability ("Download my data" button) and erasure ("Delete my account" button — immediate and permanent deletion).

Hosting: your data is stored securely; page photos only pass through for transcription and are not kept by the AI model.

Contact: bonjour@manentlc.app`;

const TERMS_EN = `Terms of use — the essentials, no jargon.

1. Manent helps you keep what your readings leave with you. Your content belongs to you; you only grant us the technical right to display it in the app.

2. Quotes you make public remain short excerpts under fair quotation rights. You agree to credit the work and not to publish entire passages.

3. Respect between readers: no hateful, illegal or off-topic content in clubs and public profiles. We may remove reported content.

4. Premium is an optional subscription, cancellable at any time.

5. Bookstore links are affiliated: we receive a commission, at no extra cost to you.

6. We may evolve the app; important changes will be announced to you.`;

const PRIVACY = `Manent respecte le RGPD (Règlement général sur la protection des données).

Ce que nous collectons : ton e-mail, ton pseudo, tes livres, citations, tableaux, clubs et statistiques de lecture. Rien d'autre.

Ce que nous en faisons : uniquement faire fonctionner l'app. Tes citations restent privées par défaut ; toi seul décides de les rendre publiques.

Ce que nous ne faisons jamais : vendre tes données, les partager avec des annonceurs, ou analyser tes lectures à des fins publicitaires.

Tes droits (articles 15 à 21 du RGPD) : accès, rectification, portabilité (bouton « Télécharger mes données ») et effacement (bouton « Supprimer mon compte » — suppression immédiate et définitive).

Hébergement : tes données sont stockées de manière sécurisée, les photos de pages transitent uniquement pour la transcription et ne sont pas conservées par le modèle d'IA.

Contact : bonjour@manentlc.app`;

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
  const { pref: schemePref, setPref: setSchemePref } = useSchemePref();
  const { lang, setLang, t } = useI18n();
  const [defaultPublic, setDefaultPublic] = useState(false);
  const [profilePublic, setProfilePublic] = useState(true);
  const [recosEnabled, setRecosEnabled] = useState(true);
  const [doc, setDoc] = useState<null | 'privacy' | 'terms'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s = await api<{ language: 'fr' | 'en'; default_public: boolean; profile_public: boolean }>('/me/settings', { method: 'PATCH', body: JSON.stringify({}) });
        if (s.language === 'en' || s.language === 'fr') setLang(s.language);
        setDefaultPublic(s.default_public);
        setProfilePublic(s.profile_public !== false);
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
        setFeedback(t('Données téléchargées.'));
      } else {
        const path = `${FileSystem.cacheDirectory}manent-mes-donnees.json`;
        await FileSystem.writeAsStringAsync(path, json);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: t('Mes données Manent') });
        }
      }
    } catch {
      setFeedback(t("L'export a échoué. Réessaie."));
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
      Alert.alert(t('Suppression impossible'), t('Réessaie dans un instant.'));
    }
  };

  const [notifKinds, setNotifKinds] = useState<{ key: string; label: string; description: string; enabled: boolean }[]>([]);
  useEffect(() => { api<{ kinds: any[] }>('/me/notifications').then(r => setNotifKinds(r.kinds)).catch(() => {}); }, []);
  const toggleNotif = async (key: string) => {
    const next = notifKinds.map(k => k.key === key ? { ...k, enabled: !k.enabled } : k);
    setNotifKinds(next);
    try { await api('/me/notifications', { method: 'PATCH', body: JSON.stringify({ prefs: { [key]: next.find(k => k.key === key)!.enabled } }) }); } catch {}
  };

  const Row = ({ icon, label, right, onPress, testID, danger }: any) => (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} accessibilityRole={right ? 'switch' : 'button'} accessibilityLabel={label} style={styles.row}>
      <Feather name={icon} size={18} color={danger ? colors.danger : colors.espresso} />
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]} numberOfLines={2}>{label}</Text>
      {right}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-settings">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="settings-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.h1}>{t('Paramètres')}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.sm }}>
        <Text style={styles.section}>{t('Compte')}</Text>
        <View style={styles.card}>
          <Text style={styles.accountName}>{user?.pseudo}</Text>
          <Text style={styles.accountMail}>{user?.email}</Text>
        </View>

        <Text style={styles.section}>{t('Langue')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable testID="lang-fr" onPress={() => { setLang('fr'); saveSettings({ language: 'fr' }); }} style={[styles.langChip, lang === 'fr' && styles.langActive]}>
            <Text style={[styles.langText, lang === 'fr' && styles.langTextActive]}>Français</Text>
          </Pressable>
          <Pressable testID="lang-en" onPress={() => { setLang('en'); saveSettings({ language: 'en' }); }} style={[styles.langChip, lang === 'en' && styles.langActive]}>
            <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>English</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>{t('Apparence')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.sm }} accessibilityRole="radiogroup">
          {([['system', 'Comme le téléphone', 'smartphone'], ['light', 'Clair', 'sun'], ['dark', 'Sombre', 'moon']] as const).map(([k, label, icon]) => (
            <Chip key={k} testID={`settings-scheme-${k}`} label={t(label)} icon={icon} role="radio" selected={schemePref === k} onPress={() => setSchemePref(k)} />
          ))}
        </View>

        <Text style={styles.section}>{t('Notifications')}</Text>
        <Text style={styles.note}>{t('Chaque type se règle séparément. Il vaut pour les notifications sur ton téléphone et pour la cloche de l’accueil.')}</Text>
        {notifKinds.map(k => (
          <View key={k.key}>
            <Row
              testID={`settings-notif-${k.key}`}
              icon={k.key === 'followed_quote' ? 'feather' : k.key === 'quote_like' ? 'heart' : k.key === 'quote_comment' ? 'message-circle' : k.key === 'new_follower' ? 'user-plus' : k.key === 'recommendation' ? 'gift' : k.key === 'invitation' ? 'mail' : k.key === 'club' ? 'users' : 'book'}
              label={t(k.label)}
              onPress={() => toggleNotif(k.key)}
              right={
                <View style={[styles.switch, k.enabled && { backgroundColor: colors.chambray }]}>
                  <View style={[styles.knob, k.enabled && { alignSelf: 'flex-end' }]} />
                </View>
              }
            />
            <Text style={styles.note}>{t(k.description)}</Text>
          </View>
        ))}

        <Text style={styles.section}>{t('Confidentialité')}</Text>
        <Row
          testID="settings-profile-public"
          icon="globe"
          label={t('Profil public')}
          onPress={() => { const v = !profilePublic; setProfilePublic(v); saveSettings({ profile_public: v }); }}
          right={
            <View style={[styles.switch, profilePublic && { backgroundColor: colors.chambray }]}>
              <View style={[styles.knob, profilePublic && { alignSelf: 'flex-end' }]} />
            </View>
          }
        />
        <Text style={styles.note}>{t('Public : les lecteurs voient ta bibliothèque, tes fiches et tes citations publiques. Privé : seuls ton pseudo et ta photo restent visibles.')}</Text>
        <Row
          testID="settings-recos"
          icon="gift"
          label={t('Recevoir des recommandations')}
          onPress={() => { const v = !recosEnabled; setRecosEnabled(v); saveSettings({ recos_enabled: v }); }}
          right={
            <View style={[styles.switch, recosEnabled && { backgroundColor: colors.chambray }]}>
              <View style={[styles.knob, recosEnabled && { alignSelf: 'flex-end' }]} />
            </View>
          }
        />
        <Text style={styles.note}>{t('Les lectrices que tu suis, ou qui te suivent, peuvent te recommander un livre. Désactivé, personne ne peut t’en envoyer.')}</Text>
        <Row
          testID="settings-default-public"
          icon="eye"
          label={t('Citations publiques par défaut')}
          onPress={() => { const v = !defaultPublic; setDefaultPublic(v); saveSettings({ default_public: v }); }}
          right={
            <View style={[styles.switch, defaultPublic && { backgroundColor: colors.chambray }]}>
              <View style={[styles.knob, defaultPublic && { alignSelf: 'flex-end' }]} />
            </View>
          }
        />
        <Row testID="settings-export" icon="download" label={busy === 'export' ? t('Export en cours…') : t('Télécharger mes données')} onPress={exportData} right={busy === 'export' ? <ManentLoader size={20} /> : <Feather name="chevron-right" size={18} color={colors.clay} />} />
        {feedback ? <Text style={styles.feedback} testID="settings-feedback">{feedback}</Text> : null}
        <Row testID="settings-privacy" icon="shield" label={t('Politique de confidentialité (RGPD)')} onPress={() => setDoc('privacy')} right={<Feather name="chevron-right" size={18} color={colors.clay} />} />
        <Row testID="settings-terms" icon="file-text" label={t("Conditions d'utilisation")} onPress={() => setDoc('terms')} right={<Feather name="chevron-right" size={18} color={colors.clay} />} />

        <Text style={styles.section}>{t('Zone sensible')}</Text>
        <Row testID="settings-delete" icon="trash-2" label={t('Supprimer mon compte')} danger onPress={() => setConfirmDelete(true)} />
        <Text style={styles.note}>{t('Suppression immédiate et définitive de toutes tes données (RGPD, droit à l’effacement).')}</Text>

        <Text style={styles.about}>Manent · verba volant, scripta manent</Text>
      </ScrollView>

      <Modal visible={doc !== null} animationType="slide" transparent onRequestClose={() => setDoc(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>{doc === 'privacy' ? t('Confidentialité') : t("Conditions d'utilisation")}</Text>
            <ScrollView style={{ maxHeight: 420 }} testID="doc-content">
              <Text style={styles.docText}>{doc === 'privacy' ? (lang === 'en' ? PRIVACY_EN : PRIVACY) : (lang === 'en' ? TERMS_EN : TERMS)}</Text>
            </ScrollView>
            <View style={{ height: spacing.md }} />
            <GhostButton testID="doc-close" title={t('Fermer')} onPress={() => setDoc(null)} />
          </View>
        </View>
      </Modal>

      <Modal visible={confirmDelete} animationType="fade" transparent onRequestClose={() => setConfirmDelete(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: spacing.xl }]}>
          <View style={[styles.modal, { borderRadius: 20 }]}>
            <Text style={styles.modalTitle}>{t('Tu es sûr ?')}</Text>
            <Text style={styles.docText}>{t('Tes livres, citations, tableaux et clubs seront supprimés définitivement. Cette action est irréversible.')}</Text>
            <View style={{ height: spacing.lg }} />
            <PrimaryButton testID="delete-confirm" title={busy === 'delete' ? t('Suppression…') : t('Supprimer définitivement')} onPress={deleteAccount} style={{ backgroundColor: colors.danger }} />
            <GhostButton testID="delete-cancel" title={t('Garder mon compte')} onPress={() => setConfirmDelete(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  rowLabel: { flex: 1, fontFamily: fonts.body, fontSize: 14.5, color: colors.espresso },
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
