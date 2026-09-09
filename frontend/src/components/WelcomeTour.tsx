// Tour de bienvenue — présenté une seule fois au premier lancement, puis disparaît pour toujours.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/src/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { Wordmark } from '@/src/components/Wordmark';
import { useT } from '@/src/i18n';

const TOUR_KEY = 'manent_tour_done_v2';

type Step = { icon: React.ComponentProps<typeof Feather>['name'] | null; title: string; text: string };

const STEPS: Step[] = [
  { icon: null, title: 'Bienvenue sur Manent', text: 'Garde une trace de tout ce que tu lis et ressens. Voici un tour des lieux — une minute, promis.' },
  { icon: 'home', title: "L'accueil", text: "Ton livre en cours et sa progression, puis « Écrire mon entrée du jour » : une page, une humeur, quelques mots. Ta dernière entrée et tes jours de lecture restent sous les yeux." },
  { icon: 'edit-3', title: 'Le journal', text: "Tes traces de lecture : les entrées (humeur, page atteinte, quelques mots, un prompt pour démarrer) et tes citations, dans le même onglet. Le « + » écrit une entrée, photographie une page ou saisit un passage. Privé par défaut, même sans réseau." },
  { icon: 'book-open', title: 'La bibliothèque', text: "Le « + » ouvre l'ajout d'une lecture par titre, ISBN ou Wattpad. Ta liste de lecture s'ordonne dans « Lecture suivante » : le prochain livre en tête, comme une file d'attente." },
  { icon: 'compass', title: 'Découvrir', text: "« Pour toi », les origines des auteurs, les clubs publics, le fil des lectrices et tes citations : tout ce qui nourrit tes prochaines lectures. Le scan de code-barres y ajoute un livre en librairie." },
  { icon: 'award', title: 'La fiche de fin', text: "Quand tu termines un livre : tes humeurs au fil des sessions, tes citations préférées, ta note, en une fiche à garder ou à partager en image. Et en fin d'année, ta rétrospective." },
  { icon: 'send', title: 'Partager', text: "Depuis une fiche livre : recommande-le à une lectrice avec un petit mot, propose-le à ton club, ou envoie le lien. Tu reçois les recommandations des autres dans ton profil." },
  { icon: 'users', title: 'La communauté', text: "Épingle tes citations dans des tableaux par thème. Crée ton club de lecture (Premium) ou rejoins-en un : lectures communes, sondages, événements et messages." },
  { icon: 'user', title: 'Ton profil', text: "Tes statistiques, ta série de jours, tes badges. Partage ton profil ou ta bibliothèque en image. Et si tu te poses une question, les petits « i » t'expliquent chaque écran. Bonne lecture." },
];

export function WelcomeTour() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { user, markSeen } = useAuth();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  // Affiché une seule fois par compte : le drapeau est sur le profil (serveur), doublé d'une trace locale.
  useEffect(() => {
    if (!user || user.tour_seen) return;
    AsyncStorage.getItem(TOUR_KEY)
      .then(v => { if (!v) setShow(true); else markSeen('tour_seen'); })
      .catch(() => {});
  }, [user, markSeen]);

  const close = () => {
    setShow(false);
    AsyncStorage.setItem(TOUR_KEY, '1').catch(() => {});
    markSeen('tour_seen');
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
