import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/theme';
import { Text } from './Text';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'green' | 'amber' | 'wattpad' | 'study' | 'neutral';
  style?: StyleProp<ViewStyle>;
}

const tones = {
  green: { on: colors.green, onBg: colors.greenPale, off: colors.inkSoft },
  amber: { on: colors.amber, onBg: colors.amberPale, off: colors.inkSoft },
  wattpad: { on: colors.wattpad, onBg: colors.wattpadPale, off: colors.inkSoft },
  study: { on: colors.study, onBg: colors.studyPale, off: colors.inkSoft },
  neutral: { on: colors.ink, onBg: colors.rule, off: colors.inkSoft },
};

export function Chip({ label, selected, onPress, tone = 'green', style }: Props) {
  const t = tones[tone];
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? t.onBg : colors.card,
          borderColor: selected ? t.on : colors.rule,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text variant="label" color={selected ? t.on : t.off}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
});
