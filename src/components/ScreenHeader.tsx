import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { Text } from './Text';

interface Props {
  title: string;
  subtitle?: string;
  /** Libellé de l'action de droite (ex. « Enregistrer »). */
  action?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  backLabel?: string;
  onBack?: () => void;
  hideBack?: boolean;
}

export function ScreenHeader({
  title, subtitle, action, onAction, actionDisabled, backLabel = 'Retour', onBack, hideBack,
}: Props) {
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        {hideBack ? (
          <View style={styles.spacer} />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={back} hitSlop={10}>
            <Text variant="label" color={colors.green}>
              ‹ {backLabel}
            </Text>
          </Pressable>
        )}
        {action ? (
          <Pressable
            accessibilityRole="button"
            disabled={actionDisabled}
            onPress={onAction}
            hitSlop={10}
            style={actionDisabled && styles.disabled}
          >
            <Text variant="label" color={colors.green}>
              {action}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text variant="title" style={styles.title}>
        {title}
      </Text>
      {subtitle ? <Text variant="bodySoft">{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
    marginBottom: spacing.md,
  },
  spacer: { flex: 1 },
  title: { marginBottom: spacing.xs },
  disabled: { opacity: 0.4 },
});
