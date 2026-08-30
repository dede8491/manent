import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/theme';
import { Text } from './Text';

interface Props {
  label: string;
  bg?: string;
  fg?: string;
  style?: StyleProp<ViewStyle>;
}

/** Petit badge d'état (statut de livre, « Sponsorisé », « lien affilié »…). */
export function Pill({ label, bg = colors.greenPale, fg = colors.green, style }: Props) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text variant="overline" color={fg}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
});
