import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';

// Toast discret Manent : confirmation courte au-dessus de la barre d'onglets, avec
// une action optionnelle (« Voir »). Disparaît seul après `duration` ms.
export function Toast({ visible, text, actionLabel, onAction, onHide, duration = 2600, testID = 'toast' }: {
  visible: boolean; text: string; actionLabel?: string; onAction?: () => void; onHide: () => void; duration?: number; testID?: string;
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const id = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => onHide());
    }, duration);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 76, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]} testID={testID}>
      <View style={styles.box}>
        <Feather name="check" size={14} color={colors.chambray} />
        <Text style={styles.text} numberOfLines={2}>{text}</Text>
        {!!actionLabel && (
          <Pressable testID={`${testID}-action`} onPress={onAction} hitSlop={8}>
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.xl, right: spacing.xl, alignItems: 'center' },
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.espresso, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 12, maxWidth: '100%' },
  text: { fontFamily: fonts.body, fontSize: 13, color: colors.creme, flexShrink: 1 },
  action: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.chambray, marginLeft: 4 },
});
