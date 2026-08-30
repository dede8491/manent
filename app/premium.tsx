import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Button, Card, Pill, Screen, ScreenHeader, Text } from '@/components';
import { FREE_MONTHLY_CAPTURES, useStore } from '@/store/useStore';
import { colors, radii, spacing } from '@/theme';

const BENEFITS = [
  { emoji: '📷', title: 'Captures et transcriptions IA illimitées', hint: `${FREE_MONTHLY_CAPTURES} par mois en gratuit` },
  { emoji: '📄', title: 'Export PDF des fiches', hint: 'Fiches perso et fiches de lecture scolaires' },
  { emoji: '👥', title: 'Tableaux collaboratifs et clubs illimités', hint: 'Sans plafond de membres' },
  { emoji: '🎴', title: 'Flashcards illimitées', hint: '3 cartes par œuvre en gratuit' },
  { emoji: '📊', title: 'Statistiques avancées', hint: 'Rythme, genres, thèmes dans le temps' },
  { emoji: '✨', title: 'Quote cards sans filigrane', hint: 'Tes partages, ta signature' },
];

type Plan = 'mensuel' | 'annuel';

export default function Premium() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const startPremium = useStore((s) => s.startPremium);
  const cancelPremium = useStore((s) => s.cancelPremium);
  const [plan, setPlan] = useState<Plan>('annuel');

  const subscribe = () => {
    // Le paiement passe par les achats intégrés App Store / Play Store
    // (RevenueCat) ; ici on active l'essai localement.
    startPremium(plan);
    Alert.alert(
      'Essai de 7 jours activé',
      `Ton abonnement ${plan} démarrera à la fin de l'essai. Tu peux l'annuler à tout moment depuis ${
        Platform.OS === 'ios' ? "l'App Store" : 'le Play Store'
      }.`,
    );
  };

  return (
    <Screen>
      <ScreenHeader title="Manent Premium" backLabel="Fermer" />

      <Text variant="quoteLarge" style={styles.pitch}>
        Tout ce que tes lectures laissent derrière elles, sans plafond.
      </Text>

      <View style={styles.plans}>
        <Card
          onPress={() => setPlan('annuel')}
          style={[styles.plan, plan === 'annuel' && styles.planOn]}
        >
          <Pill label="−27 %" bg={colors.amberPale} fg={colors.amber} />
          <Text variant="display" style={styles.price}>
            34,99 €
          </Text>
          <Text variant="label">par an</Text>
          <Text variant="small">soit 2,92 €/mois</Text>
        </Card>
        <Card
          onPress={() => setPlan('mensuel')}
          style={[styles.plan, plan === 'mensuel' && styles.planOn]}
        >
          <Text variant="display" style={styles.price}>
            3,99 €
          </Text>
          <Text variant="label">par mois</Text>
          <Text variant="small">sans engagement</Text>
        </Card>
      </View>

      <Card>
        {BENEFITS.map((b) => (
          <View key={b.title} style={styles.benefit}>
            <Text style={styles.benefitEmoji}>{b.emoji}</Text>
            <View style={styles.benefitText}>
              <Text variant="label">{b.title}</Text>
              <Text variant="small">{b.hint}</Text>
            </View>
          </View>
        ))}
      </Card>

      {user.premium ? (
        <>
          <Card style={styles.activeCard}>
            <Text variant="sectionTitle">Abonnement actif</Text>
            <Text variant="bodySoft" style={styles.activeBody}>
              Formule {user.plan ?? 'mensuelle'}. Merci de faire vivre Manent.
            </Text>
          </Card>
          <Button
            label="Résilier"
            variant="danger"
            onPress={() =>
              Alert.alert('Résilier Premium ?', 'Tu gardes tes données, mais retrouves les limites du plan gratuit.', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Résilier', style: 'destructive', onPress: cancelPremium },
              ])
            }
          />
        </>
      ) : (
        <>
          <Button label="Essayer 7 jours gratuitement" onPress={subscribe} style={styles.cta} />
          <Text variant="small" center style={styles.legal}>
            Sans engagement, résiliable à tout moment depuis{' '}
            {Platform.OS === 'ios' ? "l'App Store" : 'le Play Store'}. Le paiement est prélevé par le
            store après les 7 jours d’essai.
          </Text>
        </>
      )}

      <Button label="Plus tard" variant="ghost" onPress={() => router.back()} style={styles.later} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pitch: { marginBottom: spacing.xl },
  plans: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  plan: { flex: 1, marginBottom: 0, alignItems: 'flex-start' },
  planOn: { borderColor: colors.green, borderWidth: 2, backgroundColor: colors.greenPale },
  price: { fontSize: 26, lineHeight: 32, marginTop: spacing.sm },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  benefitEmoji: { fontSize: 22, marginRight: spacing.md },
  benefitText: { flex: 1 },
  activeCard: { borderColor: colors.amber, backgroundColor: colors.amberPale },
  activeBody: { marginTop: spacing.xs },
  cta: { marginTop: spacing.sm, borderRadius: radii.lg },
  legal: { marginTop: spacing.md },
  later: { marginTop: spacing.md },
});
