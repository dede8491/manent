import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { Text } from './Text';

interface Props {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}

/** Note sur 5 étoiles ambre. Sans `onChange`, l'affichage est en lecture seule. */
export function StarRating({ value, onChange, size = 20 }: Props) {
  return (
    <View style={styles.row} accessibilityLabel={`Note : ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!onChange}
          accessibilityRole="button"
          accessibilityLabel={`Noter ${n} sur 5`}
          onPress={() => onChange?.(n === value ? 0 : n)}
          hitSlop={4}
        >
          <Text style={{ fontSize: size, color: n <= value ? colors.amber : colors.rule, marginRight: 2 }}>
            {n <= value ? '★' : '☆'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center' } });
