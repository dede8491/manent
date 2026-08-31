import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { fonts } from '@/src/theme';
import { useColors } from '@/src/themeCtx';

// Couverture de livre avec repli élégant sur l'initiale du titre.
export function BookCover({ uri, title, width = 44, height = 60, radius = 6, initialSize = 20 }:
  { uri?: string | null; title?: string; width?: number; height?: number; radius?: number; initialSize?: number }) {
  const colors = useColors();
  const [failed, setFailed] = useState(false);
  const base = { width, height, borderRadius: radius, backgroundColor: colors.bisque } as const;
  if (!uri || failed) {
    return (
      <View style={[base, styles.center]}>
        <Text style={{ fontFamily: fonts.displayMedium, fontSize: initialSize, color: colors.espresso }}>
          {(title?.trim()?.[0] || 'M').toUpperCase()}
        </Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={base} resizeMode="cover" onError={() => setFailed(true)} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
