import { Text as RNText, TextProps, TextStyle } from 'react-native';

import { type as typeStyles } from '@/theme';

type Variant = keyof typeof typeStyles;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
}

/** Texte typé sur les styles du design system : jamais de fontFamily en dur. */
export function Text({ variant = 'body', color, center, style, ...rest }: Props) {
  const base = typeStyles[variant] as TextStyle;
  return (
    <RNText
      {...rest}
      style={[base, color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
    />
  );
}
