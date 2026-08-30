import { ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  /** Rend le contenu dans un ScrollView (par défaut). */
  scroll?: boolean;
  /** Fond alternatif — utilisé par les écrans sombres (détail citation). */
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  /** Marge basse supplémentaire pour dégager la barre d'onglets. */
  tabBarPadding?: boolean;
}

export function Screen({
  children,
  scroll = true,
  background = colors.paper,
  contentStyle,
  edges = ['top'],
  tabBarPadding = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const bottom = tabBarPadding ? 96 : Math.max(insets.bottom, spacing.lg);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={edges}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: bottom }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
