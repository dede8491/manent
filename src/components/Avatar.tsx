import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { Text } from './Text';

interface Props {
  emoji: string;
  size?: number;
  bg?: string;
}

export function Avatar({ emoji, size = 36, bg = colors.greenPale }: Props) {
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
