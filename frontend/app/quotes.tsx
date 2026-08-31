import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { QuotesManager } from '@/src/components/QuotesManager';
import { InfoTooltip } from '@/src/components/InfoTooltip';
import { useT } from '@/src/i18n';

export default function MyQuotesScreen() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-my-quotes">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="mq-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.h1}>{t('Mes citations')}</Text>
        <View style={{ width: 40, alignItems: 'center' }}>
          <InfoTooltip
            testID="info-quotes"
            title={t('Mes citations')}
            text={t("Toutes tes citations au même endroit. Sélectionnes-en plusieurs pour changer leur visibilité ou les supprimer d'un coup. Une citation publique peut inspirer d'autres lecteurs dans le fil de découverte.")}
          />
        </View>
      </View>
      <QuotesManager />
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
});
