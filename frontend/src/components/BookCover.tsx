import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { fonts } from '@/src/theme';
import { useColors } from '@/src/themeCtx';

// Couverture de livre avec repli élégant sur l'initiale du titre.
// Image mise en cache (mémoire + disque) : les couvertures ne se rechargent plus à chaque écran.
export function BookCover({ uri, title, width = 44, height = 60, radius = 6, initialSize = 20 }:
  { uri?: string | null; title?: string; width?: number; height?: number; radius?: number; initialSize?: number }) {
  const colors = useColors();
  const [failed, setFailed] = useState(false);
  const base = { width, height, borderRadius: radius, backgroundColor: colors.bisque } as const;
  if (!uri || failed) {
    return (
      <View style={[base, styles.center]} accessibilityLabel={title || undefined}>
        <Text style={{ fontFamily: fonts.displayMedium, fontSize: initialSize, color: colors.espresso }}>
          {(title?.trim()?.[0] || 'M').toUpperCase()}
        </Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={base} contentFit="cover" cachePolicy="memory-disk" transition={120} onError={() => setFailed(true)} accessibilityLabel={title || undefined} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
