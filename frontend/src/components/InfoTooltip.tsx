// Petit "i" d'information — ouvre une bulle explicative élégante au tap.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';

type Props = {
  title: string;
  text: string;
  testID?: string;
  size?: number;
  color?: string;
};

export function InfoTooltip({ title, text, testID = 'info-tooltip', size = 16, color }: Props) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable testID={testID} onPress={() => setOpen(true)} hitSlop={10} style={styles.iconBtn}>
        <Feather name="info" size={size} color={color || colors.clay} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.cardIcon}>
              <Feather name="info" size={16} color={colors.chambray} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.text}>{text}</Text>
            <Pressable testID={`${testID}-close`} onPress={() => setOpen(false)} style={styles.btn}>
              <Text style={styles.btnText}>{t('Compris')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  iconBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.creme, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.borderSoft },
  cardIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.glacier, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.displayMedium, fontSize: 23, color: colors.espresso, marginBottom: spacing.sm },
  text: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso, lineHeight: 22, opacity: 0.9 },
  btn: { marginTop: spacing.lg, alignSelf: 'flex-end', paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
});
