import { TextStyle } from 'react-native';
import { colors } from './colors';

/**
 * Deux familles : Fraunces (titres, citations, grands chiffres) et
 * Public Sans (toute l'interface). Les noms correspondent aux clés
 * chargées par `useAppFonts` dans src/theme/fonts.ts.
 */
export const fonts = {
  serifSemi: 'Fraunces_600SemiBold',
  serifBlack: 'Fraunces_900Black',
  serifItalic: 'Fraunces_400Regular_Italic',
  sans: 'PublicSans_400Regular',
  sansMedium: 'PublicSans_500Medium',
  sansBold: 'PublicSans_700Bold',
} as const;

export const type = {
  display: { fontFamily: fonts.serifBlack, fontSize: 32, lineHeight: 38, color: colors.ink },
  title: { fontFamily: fonts.serifSemi, fontSize: 24, lineHeight: 30, color: colors.ink },
  sectionTitle: { fontFamily: fonts.serifSemi, fontSize: 18, lineHeight: 24, color: colors.ink },
  quote: { fontFamily: fonts.serifSemi, fontSize: 18, lineHeight: 27, color: colors.ink },
  quoteLarge: { fontFamily: fonts.serifSemi, fontSize: 24, lineHeight: 34, color: colors.ink },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.ink },
  bodySoft: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, color: colors.ink },
  small: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
  button: { fontFamily: fonts.sansBold, fontSize: 15, lineHeight: 20 },
  overline: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.4,
    color: colors.inkSoft,
  },
  pageNumber: { fontFamily: fonts.serifBlack, fontSize: 30, lineHeight: 34, color: colors.amber },
} satisfies Record<string, TextStyle>;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radii = { sm: 8, md: 12, lg: 14, xl: 20, pill: 999 } as const;

export const shadow = {
  card: {
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  floating: {
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;
