import React from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { MONOGRAM_XML, WORDMARK_PRINCIPAL_XML, LOGO_HORIZONTAL_XML, WORDMARK_DARK_XML } from '@/src/brand';
import { useScheme } from '@/src/themeCtx';

// Wordmark officiel Manent (SVG). `size` ≈ hauteur du texte.
export function Wordmark({ size = 34, variant = 'principal' }: { size?: number; variant?: 'principal' | 'horizontal' | 'dark' }) {
  const scheme = useScheme();
  const dark = scheme === 'dark';
  if (variant === 'horizontal') {
    if (dark) {
      // le lockup horizontal est en encre Espresso : on bascule sur le wordmark crème
      const w = size * 4.6;
      return (
        <View testID="wordmark">
          <SvgXml xml={WORDMARK_DARK_XML} width={w} height={w * (160 / 420)} />
        </View>
      );
    }
    const h = size * 1.6;
    return (
      <View testID="wordmark">
        <SvgXml xml={LOGO_HORIZONTAL_XML} width={h * 4} height={h} />
      </View>
    );
  }
  const useDarkXml = variant === 'dark' || dark;
  const xml = useDarkXml ? WORDMARK_DARK_XML : WORDMARK_PRINCIPAL_XML;
  const ratio = useDarkXml ? 160 / 420 : 220 / 420;
  const w = size * 6.2;
  return (
    <View testID="wordmark" style={{ alignItems: 'center' }}>
      <SvgXml xml={xml} width={w} height={w * ratio} />
    </View>
  );
}

// Monogramme « M. » officiel (carré arrondi espresso, point Chambray).
export function Monogram({ size = 76 }: { size?: number }) {
  return <SvgXml xml={MONOGRAM_XML} width={size} height={size} />;
}
