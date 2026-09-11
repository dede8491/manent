import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/src/themeCtx';

// Bouton icône accessible : libellé obligatoire (VoiceOver / TalkBack), zone tactile 44 × 44, retour visuel au toucher.
export function IconButton({ name, label, onPress, color, size = 20, testID, style, disabled }: {
  name: React.ComponentProps<typeof Feather>['name']; label: string; onPress?: () => void; color?: string; size?: number;
  testID?: string; style?: ViewStyle; disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => [styles.btn, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }, style]}
    >
      <Feather name={name} size={size} color={color || colors.espresso} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
