import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radii, spacing, type } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'dashed' | 'danger' | 'ghost' | 'wattpad' | 'study';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

const palette: Record<Variant, { bg: string; fg: string; border: string; dashed?: boolean }> = {
  primary: { bg: colors.green, fg: colors.white, border: colors.green },
  secondary: { bg: 'transparent', fg: colors.green, border: colors.green },
  dashed: { bg: 'transparent', fg: colors.green, border: colors.green, dashed: true },
  danger: { bg: 'transparent', fg: colors.brick, border: colors.brick },
  ghost: { bg: 'transparent', fg: colors.inkSoft, border: 'transparent' },
  wattpad: { bg: colors.wattpad, fg: colors.white, border: colors.wattpad },
  study: { bg: colors.study, fg: colors.white, border: colors.study },
};

export function Button({
  label, onPress, variant = 'primary', icon, disabled, loading, full = true, small, style,
}: Props) {
  const p = palette[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: p.bg,
          borderColor: p.border,
          borderStyle: p.dashed ? 'dashed' : 'solid',
          alignSelf: full ? 'stretch' : 'flex-start',
          paddingVertical: small ? spacing.sm : spacing.md,
          paddingHorizontal: small ? spacing.md : spacing.lg,
          opacity: inactive ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <View style={styles.row}>
          {icon ? <Text style={[type.button, { color: p.fg, marginRight: 6 }]}>{icon}</Text> : null}
          <Text style={[type.button, { color: p.fg, fontSize: small ? 13 : 15 }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
