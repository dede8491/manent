import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { QuotesManager } from '@/src/components/QuotesManager';
import { InfoTooltip } from '@/src/components/InfoTooltip';
import { BottomSheet } from '@/src/components/BottomSheet';
import { useT } from '@/src/i18n';

// Onglet « Citations » : même logique que la bibliothèque, pour les passages. Le « + » propose
// de photographier une page ou d'écrire ; la liste se cherche, se filtre, se gère (visibilité, suppression).
export default function QuotesTab() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { book_id } = useLocalSearchParams<{ book_id?: string }>();
  const [addSheet, setAddSheet] = useState(false);
  const go = (mode: 'camera' | 'write') => { setAddSheet(false); router.push(`/capture?mode=${mode}` as any); };
  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-quotes-tab">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={styles.h1}>{t('Citations')}</Text>
          <InfoTooltip
            testID="info-quotes"
            title={t('Comment ça marche')}
            text={t("Le « + » photographie une page (l'IA transcrit le passage) ou te laisse écrire une citation. Cherche, filtre par visibilité, livre ou sujet ; sélectionnes-en plusieurs pour changer leur visibilité ou les supprimer d'un coup. Une citation publique peut inspirer d'autres lectrices dans le fil.")}
          />
        </View>
        <Pressable testID="btn-quotes-add" onPress={() => setAddSheet(true)} style={styles.addBtn}>
          <Feather name="plus" size={22} color={colors.creme} />
        </Pressable>
      </View>
      <QuotesManager initialBookId={book_id || null} />
      <BottomSheet visible={addSheet} onClose={() => setAddSheet(false)} title={t('Nouvelle citation')} testID="quotes-add-sheet" scroll={false}>
        <Pressable testID="quotes-add-camera" onPress={() => go('camera')} style={styles.option}>
          <View style={styles.optionIcon}><Feather name="camera" size={20} color={colors.creme} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>{t('Photographier une page')}</Text>
            <Text style={styles.optionSub}>{t('L’IA transcrit le passage et retrouve la page.')}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.clay} />
        </Pressable>
        <Pressable testID="quotes-add-write" onPress={() => go('write')} style={styles.option}>
          <View style={[styles.optionIcon, { backgroundColor: colors.espresso }]}><Feather name="edit-3" size={20} color={colors.creme} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>{t('Écrire une citation')}</Text>
            <Text style={styles.optionSub}>{t('Saisis ou colle le passage, choisis le livre et la page.')}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.clay} />
        </Pressable>
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, backgroundColor: colors.glacier },
  h1: { fontFamily: fonts.displayMedium, fontSize: 34, color: colors.espresso },
  addBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  optionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso },
  optionSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, marginTop: 2 },
});
