import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { fonts } from '@/src/theme';
import { useColors } from '@/src/themeCtx';

// Avatar rond avec repli sur l'initiale. Image mise en cache (mémoire + disque) : plus de rechargement réseau à chaque montage.
export function Avatar({ uri, name, size = 40, testID }: { uri?: string | null; name?: string | null; size?: number; testID?: string }) {
  const colors = useColors();
  const base = { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bisque };
  if (!uri) {
    return (
      <View style={[base, styles.center]} testID={testID} accessibilityLabel={name || undefined}>
        <Text style={{ fontFamily: fonts.displayMedium, fontSize: Math.round(size * 0.42), color: colors.espresso }}>{(name?.trim()?.[0] || 'M').toUpperCase()}</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={base} contentFit="cover" cachePolicy="memory-disk" transition={120} accessibilityLabel={name || undefined} testID={testID} />;
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } });
