import type { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components';
import { t } from '@/i18n';
import { useStore } from '@/store/useStore';
import { colors, radii, shadow, spacing } from '@/theme';
import type { BoardVisibility } from '@/types';

/** Le routeur est transmis par l'onglet parent pour éviter deux hooks concurrents. */
type Router = ReturnType<typeof useRouter>;

/** Libellé lisible d'une visibilité de tableau. */
export const visibilityLabel = (v: BoardVisibility) => t(`boardVisibility.${v}`);

/** Grille 2 colonnes de tableaux, façon planche de moodboard. */
export function BoardsPane({ router }: { router: Router }) {
  const boards = useStore((s) => s.boards);
  const pins = useStore((s) => s.pins);
  const quotes = useStore((s) => s.quotes);

  return (
    <View style={styles.grid}>
      {boards.map((board) => {
        const boardPins = pins.filter((p) => p.boardId === board.id);
        const preview = quotes.find((q) => q.id === boardPins[0]?.quoteId);
        return (
          <Pressable
            key={board.id}
            accessibilityRole="button"
            accessibilityLabel={board.name}
            onPress={() => router.push(`/tableau/${board.id}`)}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          >
            <Text variant="sectionTitle" color={colors.green} numberOfLines={2}>
              {board.name}
            </Text>
            <Text variant="quote" numberOfLines={3} style={styles.preview}>
              {preview ? `« ${preview.text} »` : 'Tableau vide pour l’instant.'}
            </Text>
            <View style={styles.meta}>
              <Text variant="small">{visibilityLabel(board.visibility)}</Text>
              <Text variant="small">{t('count.pin', { count: boardPins.length })}</Text>
            </View>
          </Pressable>
        );
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nouveau tableau"
        onPress={() => router.push('/tableau/nouveau')}
        style={({ pressed }) => [styles.tile, styles.newTile, pressed && styles.pressed]}
      >
        <Text style={styles.plus}>＋</Text>
        <Text variant="label" color={colors.green} center>
          Nouveau tableau
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    minHeight: 168,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: spacing.md,
    marginBottom: spacing.md,
    justifyContent: 'space-between',
    ...shadow.card,
  },
  newTile: {
    borderStyle: 'dashed',
    borderColor: colors.green,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { fontSize: 30, color: colors.green, marginBottom: spacing.sm },
  preview: { fontSize: 14, lineHeight: 20, marginVertical: spacing.sm, flex: 1 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pressed: { opacity: 0.85 },
});
