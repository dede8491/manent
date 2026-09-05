// Tour de bienvenue — présenté une seule fois au premier lancement, puis disparaît pour toujours.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { Wordmark } from '@/src/components/Wordmark';
import { useT } from '@/src/i18n';

const TOUR_KEY = 'manent_tour_done_v2';

type Step = { icon: React.ComponentProps<typeof Feather>['name'] | null; title: string; text: string };

const STEPS: Step[] = [
  { icon: null, title: 'Bienvenue sur Manent', text: 'Lis. Retiens. Partage. Voici un tour des lieux — une minute, promis.' },
  { icon: 'grid', title: "L'accueil", text: "Reprends ta lecture en cours, découvre « Pour toi », des livres choisis d'après tes sujets, les origines de tes auteurs et les lectrices que tu suis, puis les clubs publics à rejoindre et le fil des citations." },
  { icon: 'book-open', title: 'La bibliothèque', text: "Le « + » ouvre l'ajout d'une lecture par titre, ISBN ou Wattpad. Ta liste de lecture s'ordonne dans « Lecture suivante » : le prochain livre en tête, comme une file d'attente." },
  { icon: 'maximize', title: 'En librairie', text: "Un livre te plaît ? Scanne son code-barres depuis l'accueil : un seul bouton l'ajoute à ta liste de lecture, avec sa couverture et son résumé." },
  { icon: 'feather', title: 'Les citations', text: "L'onglet plume rassemble tes citations. Son « + » photographie une page (l'IA transcrit le passage) ou te laisse écrire. Depuis une citation, tu retrouves le livre et sa page." },
  { icon: 'send', title: 'Partager', text: "Depuis une fiche livre : recommande-le à une lectrice avec un petit mot, propose-le à ton club, ou envoie le lien. Tu reçois les recommandations des autres dans ton profil." },
  { icon: 'users', title: 'La communauté', text: "Épingle tes citations dans des tableaux par thème. Crée ton club de lecture (Premium) ou rejoins-en un : lectures communes, sondages, événements et messages." },
  { icon: 'user', title: 'Ton profil', text: "Tes statistiques, ta série de jours, tes badges. Partage ton profil ou ta bibliothèque en image. Et si tu te poses une question, les petits « i » t'expliquent chaque écran. Bonne lecture." },
];

export function WelcomeTour() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(TOUR_KEY)
      .then(v => { if (!v) setShow(true); })
      .catch(() => {});
  }, []);

  const close = () => {
    setShow(false);
    AsyncStorage.setItem(TOUR_KEY, '1').catch(() => {});
  };

  if (!show) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.overlay, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.topRow}>
          {step > 0 ? (
            <Pressable testID="tour-prev" onPress={() => setStep(step - 1)} hitSlop={10} style={styles.navBtn}>
              <Feather name="chevron-left" size={20} color={colors.clay} />
            </Pressable>
          ) : <View style={styles.navBtn} />}
          <Pressable testID="tour-skip" onPress={close} hitSlop={10}>
            <Text style={styles.skip}>{t('Passer')}</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {s.icon ? (
            <View style={styles.iconCircle}>
              <Feather name={s.icon} size={30} color={colors.chambray} />
            </View>
          ) : (
            <View style={{ marginBottom: spacing.xl }}>
              <Wordmark size={34} variant="horizontal" />
            </View>
          )}
          <Text style={styles.title}>{t(s.title)}</Text>
          <Text style={styles.text}>{t(s.text)}</Text>
        </View>

        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <Pressable testID="tour-next" onPress={() => (last ? close() : setStep(step + 1))} style={styles.nextBtn}>
          <Text style={styles.nextText}>{last ? t('C’est parti') : t('Suivant')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.glacier, paddingHorizontal: spacing.xl },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  skip: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.clay, padding: spacing.sm },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  iconCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  title: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.espresso, textAlign: 'center', marginBottom: spacing.md },
  text: { fontFamily: fonts.body, fontSize: 15, color: colors.espresso, lineHeight: 24, textAlign: 'center', opacity: 0.9, maxWidth: 340 },
  dots: { flexDirection: 'row', gap: 8, alignSelf: 'center', marginBottom: spacing.xl },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.borderSoft },
  dotActive: { backgroundColor: colors.chambray, width: 18 },
  nextBtn: { height: 52, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.creme, letterSpacing: 0.3 },
});
