import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fonts } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { BottomSheet } from '@/src/components/BottomSheet';
import { useT } from '@/src/i18n';

// Feuille « Ajouter une lecture » : trois portes (titre, code-barres, Wattpad) vers l'unique flux d'ajout (app/book/add.tsx).
// Elle ne cherche plus elle-même : une seule recherche catalogue dans l'app.
export function AddReadingSheet({ visible, onClose, testID = 'add-reading-sheet' }: { visible: boolean; onClose: () => void; testID?: string }) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const go = (params: Record<string, string>) => { onClose(); setTimeout(() => router.push({ pathname: '/book/add', params }), 120); };
  const options = [
    { key: 'title', icon: 'search', title: t('Par titre ou auteur'), sub: t('Cherche dans le catalogue, ajoute en un geste.'), params: {} },
    { key: 'isbn', icon: 'maximize', title: t('Scanner le code-barres'), sub: t('En librairie ou chez une amie.'), params: { method: 'isbn', scan: '1' } },
    { key: 'wattpad', icon: 'link', title: t('Une histoire Wattpad'), sub: t('Colle le lien, on récupère le titre et les chapitres.'), params: { method: 'wattpad' } },
  ] as const;
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('Ajouter une lecture')} testID={testID} scroll={false}>
      {options.map(o => (
        <Pressable key={o.key} testID={`${testID}-method-${o.key}`} onPress={() => go(o.params)} accessibilityRole="button" style={styles.option}>
          <View style={styles.optionIcon}><Feather name={o.icon} size={20} color={colors.creme} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>{o.title}</Text>
            <Text style={styles.optionSub}>{o.sub}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.clay} />
        </Pressable>
      ))}
    </BottomSheet>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  optionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso },
  optionSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, marginTop: 2 },
});
