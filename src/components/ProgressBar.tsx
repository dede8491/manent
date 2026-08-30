import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/theme';

interface Props {
  value: number;
  total: number | null;
  color?: string;
  height?: number;
  track?: string;
}

export function ProgressBar({ value, total, color = colors.green, height = 8, track = colors.rule }: Props) {
  const pct = !total || total <= 0 ? 0 : Math.min(100, Math.max(0, (value / total) * 100));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[styles.track, { height, backgroundColor: track, borderRadius: height / 2 }]}
    >
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden', borderRadius: radii.pill },
  fill: { height: '100%' },
});
