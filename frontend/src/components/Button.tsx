import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { colors, fonts, radius } from '@/src/theme';

export function PrimaryButton({ title, onPress, loading, disabled, testID, style }: {
  title: string; onPress: () => void; loading?: boolean; disabled?: boolean; testID?: string; style?: ViewStyle;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: colors.chambray, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.creme} /> : <Text style={styles.btnText}>{title}</Text>}
    </Pressable>
  );
}

export function GhostButton({ title, onPress, testID, style }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.ghost, { opacity: pressed ? 0.7 : 1 }, style]}>
      <Text style={styles.ghostText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.creme, letterSpacing: 0.3 },
  ghost: { height: 48, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.chambray },
});
