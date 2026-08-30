import { ScrollView, StyleSheet } from 'react-native';

import { spacing } from '@/theme';
import { Chip } from './Chip';

interface Props {
  themes: string[];
  selected: string;
  onSelect: (theme: string) => void;
}

/** Rangée horizontale de chips thématiques qui filtre le fil instantanément. */
export function ThemeRow({ themes, selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.row}
    >
      {themes.map((t) => (
        <Chip
          key={t}
          label={t === 'Pour toi' ? t : `#${t}`}
          selected={selected === t}
          onPress={() => onSelect(t)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { marginHorizontal: -spacing.lg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 0 },
});
