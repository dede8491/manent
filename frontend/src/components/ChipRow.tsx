import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';

export function ChipRow<T extends string>({ items, selected, onSelect, testID }: {
  items: readonly T[]; selected: T | null; onSelect: (v: T) => void; testID?: string;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.wrap} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.lg }}
      >
        {items.map(it => {
          const active = selected === it;
          return (
            <Pressable
              key={it}
              testID={`chip-${it}`}
              onPress={() => onSelect(it)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{it}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  wrap: { height: 56, justifyContent: 'center' },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  chipActive: { borderColor: colors.chambray, backgroundColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
});
