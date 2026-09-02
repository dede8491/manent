import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';

export type ClassLine = { icon: string; text: string };

// Lignes de classification d'un livre (type · origine · thèmes · ambiance), calculées côté serveur.
// `compact` : deux lignes maximum, pour les cartes et listes.
export function ClassificationLines({ lines, compact, style, testID }: { lines?: ClassLine[]; compact?: boolean; style?: any; testID?: string }) {
  const styles = useStyles(makeStyles);
  const list = (lines || []).slice(0, compact ? 2 : 4);
  if (!list.length) return null;
  return (
    <View style={[styles.wrap, style]} testID={testID || 'classification-lines'}>
      {list.map((l, i) => (
        <Text key={i} style={[styles.line, compact && styles.lineCompact]} numberOfLines={1}>
          <Text style={styles.icon}>{l.icon} </Text>{l.text}
        </Text>
      ))}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  wrap: { gap: 3 },
  line: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, lineHeight: 17 },
  lineCompact: { fontSize: 11, lineHeight: 15 },
  icon: { fontSize: 11 },
});
