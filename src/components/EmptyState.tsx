import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

interface Props {
  emoji: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ emoji, title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text variant="sectionTitle" center style={styles.title}>
        {title}
      </Text>
      <Text variant="bodySoft" center style={styles.body}>
        {body}
      </Text>
      {actionLabel ? (
        <Button label={actionLabel} onPress={onAction} full={false} variant="secondary" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    borderStyle: 'dashed',
  },
  emoji: { fontSize: 34, marginBottom: spacing.sm },
  title: { marginBottom: spacing.xs },
  body: { marginBottom: spacing.lg },
});
