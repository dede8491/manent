import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { colors, radii, spacing, type } from '@/theme';
import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
  hint?: string;
  multiline?: boolean;
}

export function Field({ label, hint, style, multiline, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="overline" style={styles.label}>
          {label.toUpperCase()}
        </Text>
      ) : null}
      <TextInput
        {...rest}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.multiline, style]}
      />
      {hint ? (
        <Text variant="small" style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs },
  input: {
    ...type.body,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 46,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  hint: { marginTop: spacing.xs },
});
