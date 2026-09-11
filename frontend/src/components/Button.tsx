import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts, radius } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import ManentLoader from '@/src/components/ManentLoader';

type Size = 'compact' | 'standard' | 'large';
type Variant = 'primary' | 'secondary' | 'danger';
const HEIGHTS: Record<Size, number> = { compact: 36, standard: 44, large: 52 };

// Système de boutons : pilule (le langage de toute l'app), trois tailles (36 / 44 / 52), trois variantes.
// Primaire Chambray, secondaire bordure douce, danger terre cuite. Toujours accessible (rôle, état).
export function Button({ title, onPress, loading, disabled, testID, style, size = 'standard', variant = 'primary', icon }: {
  title: string; onPress: () => void; loading?: boolean; disabled?: boolean; testID?: string; style?: ViewStyle;
  size?: Size; variant?: Variant; icon?: React.ComponentProps<typeof Feather>['name'];
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const bg = variant === 'primary' ? colors.chambray : variant === 'danger' ? colors.danger : colors.creme;
  const fg = variant === 'secondary' ? colors.espresso : colors.creme;
  const fontSize = size === 'compact' ? 12.5 : size === 'large' ? 15 : 14;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={loading || disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(loading || disabled), busy: !!loading }}
      style={({ pressed }) => [
        styles.btn,
        { height: HEIGHTS[size], backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'secondary' && styles.secondary,
        style,
      ]}
    >
      {loading ? <ManentLoader size={20} variant={variant === 'secondary' ? 'auto' : 'sombre'} /> : (
        <View style={styles.inner}>
          {icon ? <Feather name={icon} size={size === 'compact' ? 13 : 16} color={fg} /> : null}
          <Text style={[styles.text, { color: fg, fontSize }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// Alias historiques (15 écrans) : même rendu qu'avant, aligné sur la pilule.
export function PrimaryButton(props: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean; testID?: string; style?: ViewStyle }) {
  return <Button {...props} size="large" variant="primary" />;
}

export function GhostButton({ title, onPress, testID, style }: { title: string; onPress: () => void; testID?: string; style?: ViewStyle }) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.ghost, { opacity: pressed ? 0.7 : 1 }, style]}>
      <Text style={styles.ghostText}>{title}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  btn: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  secondary: { borderWidth: 1, borderColor: colors.borderSoft },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontFamily: fonts.bodyMedium, letterSpacing: 0.3 },
  ghost: { height: 44, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.chambray },
});
