import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';

// Feuille glissante Manent : LE gabarit de toute action secondaire (ajouter une lecture,
// créer un club, sondage, partage…). Poignée, titre Cormorant, fermeture par glissement
// ou tap sur le fond. Le contenu défile si nécessaire (85 % de l'écran au maximum).
type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  testID?: string;
  scroll?: boolean;
  maxHeightRatio?: number;
};

export function BottomSheet({ visible, onClose, title, subtitle, children, testID, scroll = true, maxHeightRatio = 0.85 }: Props) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(height)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(height);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: height, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) onClose();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    }),
  ).current;

  if (!mounted) return null;

  const body = (
    <>
      <View {...pan.panHandlers} style={styles.handleZone}>
        <View style={styles.grabber} />
        {!!title && <Text style={styles.title} testID={testID ? `${testID}-title` : undefined}>{title}</Text>}
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg }}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg }}>{children}</View>
      )}
    </>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }} testID={testID}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(58,33,25,0.45)', opacity: backdrop }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} testID={testID ? `${testID}-backdrop` : undefined} />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { maxHeight: height * maxHeightRatio, transform: [{ translateY }], backgroundColor: colors.glacier }]}>
            {body}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handleZone: { paddingTop: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  grabber: { width: 44, height: 4, backgroundColor: colors.borderSoft, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 2, lineHeight: 18 },
});
