// Loader Manent — le M s'écrit à la plume, puis le point Chambray apparaît.
// Version React Native (react-native-svg + Animated), fidèle au kit de marque.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useScheme } from '@/src/themeCtx';

const M_PATH =
  'M 10 95 C 18 90 26 60 34 26 C 36 18 40 16 41 22 C 42 26 40 40 37 58 L 33 82 C 32 92 35 95 39 88 C 47 72 55 44 61 28 C 63 22 67 19 69 24 C 71 28 69 42 66 60 L 62 84 C 61 93 65 96 72 88';
const PATH_LENGTH = 340; // longueur approx. du tracé

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  size?: number;
  variant?: 'auto' | 'clair' | 'sombre';
  fullscreen?: boolean;
};

export default function ManentLoader({ size = 96, variant = 'auto', fullscreen = false }: Props) {
  const scheme = useScheme();
  const dark = variant === 'auto' ? scheme === 'dark' : variant === 'sombre';
  const ink = dark ? '#F5EDE4' : '#3A2119';
  const bg = dark ? '#3A2119' : '#D2E2EC';
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 3000,
        easing: Easing.bezier(0.45, 0, 0.25, 1),
        useNativeDriver: false, // props SVG non supportées par le driver natif
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  // Tracé du M : 0 → 55 % du cycle, puis pause, puis fondu
  const dashOffset = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [PATH_LENGTH, 0, 0],
  });
  const strokeOpacity = progress.interpolate({
    inputRange: [0, 0.82, 0.92, 1],
    outputRange: [1, 1, 0, 0],
  });
  // Point Chambray : apparaît à 54 %, petit rebond, puis fondu
  const dotR = progress.interpolate({
    inputRange: [0, 0.54, 0.62, 0.68, 1],
    outputRange: [0.01, 0.01, 8.1, 6, 6],
  });
  const dotOpacity = progress.interpolate({
    inputRange: [0, 0.82, 0.92, 1],
    outputRange: [1, 1, 0, 0],
  });

  const svg = (
    <Svg viewBox="0 0 120 110" width={size} height={(size * 110) / 120}>
      <AnimatedPath
        d={M_PATH}
        stroke={ink}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={`${PATH_LENGTH}`}
        strokeDashoffset={dashOffset as any}
        strokeOpacity={strokeOpacity as any}
      />
      <AnimatedCircle cx={96} cy={91} r={dotR as any} fill="#79A3C3" fillOpacity={dotOpacity as any} />
    </Svg>
  );

  if (fullscreen) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center', zIndex: 999 }]} testID="manent-loader">
        {svg}
      </View>
    );
  }
  return <View style={{ alignItems: 'center', justifyContent: 'center' }} testID="manent-loader">{svg}</View>;
}
