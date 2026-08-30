import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/src/theme';

export function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <View style={styles.wrap} testID="wordmark">
      <Text style={[styles.text, { fontSize: size }]}>Manent</Text>
      <View style={[styles.underline, { width: size * 1.6 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  text: { fontFamily: fonts.displayMedium, color: colors.espresso, includeFontPadding: false },
  underline: { height: 2, backgroundColor: colors.chambray, marginTop: 2 },
});
