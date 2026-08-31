import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radius, spacing } from '@/src/theme';
import { Monogram } from '@/src/components/Wordmark';
import { api } from '@/src/api';
import { useT } from '@/src/i18n';
import { useAuth } from '@/src/auth';
import { useSubscription, rcEnabled } from '@/src/revenuecat';
import ManentLoader from '@/src/components/ManentLoader';

type Status = { is_premium: boolean; plan?: string | null; captures_used: number; captures_limit: number };

const FEATURES = [
  'Captures IA illimitées (10/mois en gratuit)',
  'Export PDF de tes fiches d\u2019études',
  'Enregistrement des quote cards dans ta galerie',
  'Quote cards sans filigrane',
  'Soutien à une app calme, sans publicité',
];

const isTestStore = Platform.OS === 'web' || __DEV__;

export default function Premium() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const { rcIdentityError } = useAuth();
  const { customerInfo, offerings, purchase, restore, isSubscribed, identityReady, isPurchasing, isRestoring } = useSubscription();
  const [status, setStatus] = useState<Status | null>(null);
  const [plan, setPlan] = useState<'mensuel' | 'annuel'>('annuel');
  const [confirm, setConfirm] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    (async () => { try { setStatus(await api<Status>('/premium/status')); } catch {} })();
  }, []);

  // Miroir backend : le droit "pro" RevenueCat (source de vérité) pilote le quota de captures côté serveur.
  useEffect(() => {
    if (!status || customerInfo === undefined) return;
    (async () => {
      try {
        if (isSubscribed && !status.is_premium) {
          setStatus(await api<Status>('/premium/activate', { method: 'POST', body: JSON.stringify({ plan }) }));
        } else if (!isSubscribed && status.is_premium) {
          setStatus(await api<Status>('/premium/deactivate', { method: 'POST' }));
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubscribed, customerInfo, status?.is_premium]);

  const current = offerings?.current;
  const monthlyPkg = current?.monthly ?? current?.availablePackages?.find((p: any) => p.packageType === 'MONTHLY') ?? null;
  const annualPkg = current?.annual ?? current?.availablePackages?.find((p: any) => p.packageType === 'ANNUAL') ?? null;
  const pkg = plan === 'annuel' ? (annualPkg ?? monthlyPkg) : (monthlyPkg ?? annualPkg);
  const noOfferings = !rcEnabled || (offerings !== undefined && (!current || (current.availablePackages || []).length === 0));

  const buy = async () => {
    setConfirm(false);
    if (!pkg) return;
    setErrMsg('');
    try {
      await purchase(pkg);
    } catch (e: any) {
      if (!e?.userCancelled) setErrMsg(t('Le paiement n’a pas abouti. Réessaie.'));
    }
  };

  const doRestore = async () => {
    setErrMsg(''); setFeedback('');
    try {
      const info = await restore();
      const active = info?.entitlements?.active?.pro !== undefined;
      setFeedback(active ? t('Achats restaurés.') : t('Aucun achat à restaurer.'));
    } catch {
      setErrMsg(t('Le paiement n’a pas abouti. Réessaie.'));
    }
  };

  const premiumActive = isSubscribed || !!status?.is_premium;

  return (
    <View style={{ flex: 1, backgroundColor: colors.espresso }} testID="screen-premium">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="premium-back" style={styles.iconBtn}>
          <Feather name="x" size={22} color={colors.creme} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <Monogram size={64} />
          <Text style={styles.title}>Manent Premium</Text>
          <Text style={styles.baseline}>{t('Ce que tes lectures te laissent, sans limite.')}</Text>
        </View>

        {premiumActive ? (
          <View style={styles.activeBox} testID="premium-active">
            <Feather name="check-circle" size={22} color={colors.chambray} />
            <Text style={styles.activeTitle}>{t('Tu es Premium')}</Text>
            <Text style={styles.activeSub}>{t('Formule {plan} — captures IA illimitées, exports débloqués.', { plan: t(status?.plan === 'annuel' ? 'annuelle' : 'mensuelle') })}</Text>
            <Text style={styles.note}>{t('Abonnement géré par l’App Store / Google Play. Résiliable à tout moment.')}</Text>
            <Pressable testID="btn-restore" onPress={doRestore} disabled={isRestoring} style={styles.ghostBtn}>
              {isRestoring ? <ManentLoader size={20} /> : <Text style={styles.ghostBtnText}>{t('Restaurer mes achats')}</Text>}
            </Pressable>
            {feedback ? <Text style={styles.feedback} testID="premium-feedback">{feedback}</Text> : null}
          </View>
        ) : (
          <>
            <View style={styles.features}>
              {FEATURES.map(f => (
                <View key={f} style={styles.featureRow}>
                  <Feather name="check" size={16} color={colors.chambray} />
                  <Text style={styles.featureText}>{t(f)}</Text>
                </View>
              ))}
            </View>

            {status && !status.is_premium ? (
              <Text style={styles.usage}>{t('Ce mois-ci : {used}/{limit} captures IA utilisées', { used: status.captures_used, limit: status.captures_limit })}</Text>
            ) : null}

            {rcIdentityError ? (
              <View style={styles.errBox} testID="premium-identity-error">
                <Text style={styles.errText}>{t('Connexion au compte en cours — réessaie dans un instant.')}</Text>
              </View>
            ) : null}

            {noOfferings ? (
              <View style={[styles.features, { marginTop: spacing.lg }]} testID="premium-unavailable">
                <Text style={styles.featureText}>{t('Les offres sont indisponibles pour le moment. Réessaie plus tard.')}</Text>
              </View>
            ) : !offerings ? (
              <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
                <ManentLoader size={48} />
              </View>
            ) : (
              <>
                <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
                  {annualPkg ? (
                    <Pressable testID="plan-annuel" onPress={() => setPlan('annuel')} style={[styles.plan, plan === 'annuel' && styles.planActive]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planName}>{t('Annuel')}</Text>
                        <Text style={styles.planPrice}>{annualPkg.product.priceString} {t('par an')}</Text>
                      </View>
                      <View style={styles.badge}><Text style={styles.badgeText}>−16%</Text></View>
                    </Pressable>
                  ) : null}
                  {monthlyPkg ? (
                    <Pressable testID="plan-mensuel" onPress={() => setPlan('mensuel')} style={[styles.plan, plan === 'mensuel' && styles.planActive]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planName}>{t('Mensuel')}</Text>
                        <Text style={styles.planPrice}>{monthlyPkg.product.priceString} {t('par mois, sans engagement')}</Text>
                      </View>
                    </Pressable>
                  ) : null}
                </View>

                <Pressable
                  testID="btn-premium-activate"
                  onPress={() => setConfirm(true)}
                  disabled={isPurchasing || !pkg || !identityReady}
                  style={[styles.cta, (isPurchasing || !pkg || !identityReady) && { opacity: 0.6 }]}
                >
                  {isPurchasing ? <ManentLoader size={48} /> : <Text style={styles.ctaText}>{t("S'abonner")}</Text>}
                </Pressable>
                {errMsg ? <Text style={[styles.feedback, { marginTop: spacing.sm }]} testID="premium-error">{errMsg}</Text> : null}
                {feedback ? <Text style={[styles.feedback, { marginTop: spacing.sm }]} testID="premium-feedback">{feedback}</Text> : null}
                <Pressable testID="btn-restore" onPress={doRestore} disabled={isRestoring} style={{ alignSelf: 'center', marginTop: spacing.md, padding: spacing.xs }}>
                  {isRestoring ? <ManentLoader size={20} /> : <Text style={styles.restoreLink}>{t('Restaurer mes achats')}</Text>}
                </Pressable>
                <Text style={styles.note}>
                  {isTestStore
                    ? t('Achat simulé (Test Store) dans cet aperçu — le vrai paiement s’active dans l’app publiée.')
                    : t('Abonnement géré par l’App Store / Google Play. Résiliable à tout moment.')}
                </Text>
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => setConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('Confirmer l’achat')}</Text>
            <Text style={styles.modalText}>
              {t('Abonnement {name} — {price}. Continuer ?', { name: t(plan === 'annuel' ? 'Annuel' : 'Mensuel'), price: pkg?.product.priceString || '' })}
            </Text>
            {isTestStore ? <Text style={styles.modalHint}>{t('Environnement de test : l’achat sera simulé (Test Store RevenueCat), aucun débit réel.')}</Text> : null}
            <Pressable testID="confirm-purchase" onPress={buy} style={styles.cta}>
              <Text style={styles.ctaText}>{t("S'abonner")}</Text>
            </Pressable>
            <Pressable testID="cancel-purchase" onPress={() => setConfirm(false)} style={{ alignSelf: 'center', marginTop: spacing.md, padding: spacing.xs }}>
              <Text style={styles.restoreLink}>{t('Annuler')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.displayMedium, fontSize: 34, color: colors.creme, marginTop: spacing.md },
  baseline: { fontFamily: fonts.display, fontSize: 16, color: colors.bisque, marginTop: 4, textAlign: 'center' },
  features: { backgroundColor: colors.darkCard, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  featureText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.creme, lineHeight: 20 },
  usage: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.bisque, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', marginTop: spacing.lg },
  plan: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.clay, backgroundColor: colors.darkCard },
  planActive: { borderColor: colors.chambray, backgroundColor: 'rgba(121,163,195,0.14)' },
  planName: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.creme },
  planPrice: { fontFamily: fonts.body, fontSize: 13, color: colors.bisque, marginTop: 2 },
  badge: { backgroundColor: colors.chambray, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.creme },
  cta: { height: 54, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  ctaText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.creme, letterSpacing: 0.3 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },
  activeBox: { alignItems: 'center', backgroundColor: colors.darkCard, borderRadius: radius.md, padding: spacing.xl, gap: spacing.sm },
  activeTitle: { fontFamily: fonts.displayMedium, fontSize: 26, color: colors.creme },
  activeSub: { fontFamily: fonts.body, fontSize: 14, color: colors.bisque, textAlign: 'center', lineHeight: 20 },
  ghostBtn: { marginTop: spacing.md, height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.clay, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.bisque },
  restoreLink: { fontFamily: fonts.body, fontSize: 13, color: colors.bisque, textDecorationLine: 'underline' },
  feedback: { fontFamily: fonts.body, fontSize: 12.5, color: colors.bisque, textAlign: 'center' },
  errBox: { marginTop: spacing.md, backgroundColor: colors.darkCard, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.clay },
  errText: { fontFamily: fonts.body, fontSize: 13, color: colors.bisque, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.6)', justifyContent: 'center', padding: spacing.xl },
  modal: { backgroundColor: colors.espresso, borderRadius: 20, padding: spacing.xl, borderWidth: 1, borderColor: colors.clay },
  modalTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.creme },
  modalText: { fontFamily: fonts.body, fontSize: 14, color: colors.bisque, marginTop: spacing.sm, lineHeight: 20 },
  modalHint: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: spacing.sm, fontStyle: 'italic', lineHeight: 17 },
});
