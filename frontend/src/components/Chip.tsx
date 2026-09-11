import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts, radius } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';

// Chip de filtre ou de segment : 36 px de haut, pilule, état sélectionné Chambray, zone tactile étendue, rôle accessible.
export function Chip({ label, selected, onPress, testID, icon, style, role = 'button', tone = 'chambray' }: {
  label: string; selected?: boolean; onPress?: () => void; testID?: string; icon?: React.ComponentProps<typeof Feather>['name'];
  style?: ViewStyle; role?: 'button' | 'tab' | 'radio'; tone?: 'chambray' | 'espresso';
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const onColor = tone === 'espresso' ? colors.espresso : colors.chambray;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      accessibilityRole={role}
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [styles.chip, selected && { backgroundColor: onColor, borderColor: onColor }, pressed && { opacity: 0.8 }, style]}
    >
      <View style={styles.inner}>
        {icon ? <Feather name={icon} size={13} color={selected ? colors.creme : colors.espresso} /> : null}
        <Text style={[styles.text, selected && styles.textOn]} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, justifyContent: 'center' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  textOn: { color: colors.creme, fontFamily: fonts.bodyMedium },
});
