import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fonts } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { MOODS, moodOf } from '@/src/journal';

export type MoodPoint = { date: string; mood: number; page?: number | null; entry_id?: string };

// Frise des humeurs d'un livre : une colonne par session, hauteur = humeur (1 à 5), couleur de la palette.
// Rendu 100 % natif (Views), donc capturable en image et lisible hors ligne.
export function MoodTimeline({ points, height = 96, compact = false, colorsOverride }: { points: MoodPoint[]; height?: number; compact?: boolean; colorsOverride?: { line: string; label: string } }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const line = colorsOverride?.line || colors.borderSoft;
  const label = colorsOverride?.label || colors.clay;
  if (!points.length) return null;
  const shown = points.slice(-24);
  const step = (height - 16) / 4;
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: compact ? 4 : 6 }}>
        {[1, 2, 3, 4, 5].map(l => <View key={l} pointerEvents="none" style={[styles.grid, { bottom: 8 + (l - 1) * step, backgroundColor: line }]} />)}
        {shown.map((p, i) => {
          const m = moodOf(p.mood) || MOODS[2];
          const h = 8 + (p.mood - 1) * step;
          return (
            <View key={p.entry_id || i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}>
              <View style={{ width: compact ? 3 : 4, height: h, backgroundColor: m.color, opacity: 0.35, borderRadius: 2 }} />
              <View style={[styles.dot, { backgroundColor: m.color, bottom: h - 5 }, compact && { width: 8, height: 8, borderRadius: 4 }]} />
            </View>
          );
        })}
      </View>
      {!compact && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={[styles.axis, { color: label }]}>{fmt(shown[0].date)}</Text>
          {shown.length > 1 && <Text style={[styles.axis, { color: label }]}>{fmt(shown[shown.length - 1].date)}</Text>}
        </View>
      )}
    </View>
  );
}

function fmt(d: string) {
  try { return new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch { return d; }
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.creme },
  axis: { fontFamily: fonts.body, fontSize: 10.5 },
});
