export const colors = {
  espresso: '#3A2119',
  glacier: '#D2E2EC',
  bisque: '#EBCDB7',
  chambray: '#79A3C3',
  clay: '#957662',
  creme: '#F5EDE4',
  borderSoft: '#BBA99C',
  darkCard: '#4A2E23',
  darkBg: '#2D1913',
} as const;

export const fonts = {
  display: 'CormorantGaramond-Italic',
  displayMedium: 'CormorantGaramond-MediumItalic',
  body: 'Inter-Regular',
  bodyMedium: 'Inter-Medium',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 4, md: 8, lg: 16, pill: 999 } as const;

export const type = {
  wordmark: { fontFamily: fonts.displayMedium, fontSize: 34, color: colors.espresso },
  title: { fontFamily: fonts.displayMedium, fontSize: 26, color: colors.espresso },
  subtitle: { fontFamily: fonts.display, fontSize: 20, color: colors.espresso },
  body: { fontFamily: fonts.body, fontSize: 15, color: colors.espresso, lineHeight: 22 },
  bodySmall: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.6, textTransform: 'uppercase' as const },
  metaLarge: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' as const },
  quote: { fontFamily: fonts.display, fontSize: 22, color: colors.espresso, lineHeight: 30 },
  button: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.creme, letterSpacing: 0.3 },
};
