/**
 * Palette « bibliothèque à l'encre verte » de Manent.
 * Toute couleur utilisée dans l'app doit venir d'ici — aucun littéral hexadécimal
 * ne doit apparaître dans les écrans.
 */
export const colors = {
  /** Fond général : papier froid */
  paper: '#F5F4EF',
  /** Fond des cartes */
  card: '#FFFFFF',
  /** Texte principal */
  ink: '#1F2430',
  /** Texte secondaire */
  inkSoft: '#5A6072',
  /** Filets, séparateurs, contours discrets */
  rule: '#E3E1D8',

  /** Accent principal : vert bibliothèque */
  green: '#275C4B',
  /** Vert pâle : fonds de badges, surfaces vertes */
  greenPale: '#E4EDE7',

  /** Ambre marque-page : numéros de page, étoiles, surlignages */
  amber: '#C9973B',
  /** Ambre pâle */
  amberPale: '#F6EBD6',

  /** Rouge brique : destructif */
  brick: '#A8422F',

  /** Orange Wattpad */
  wattpad: '#E96C10',
  wattpadPale: '#FCE9DC',

  /** Bleu ardoise : mode études */
  study: '#3E5C76',
  studyPale: '#E4EAF0',

  /** Utilitaires */
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(31, 36, 48, 0.55)',
  inkOn: '#F5F4EF',
  muted: '#9AA0AE',
} as const;

export type ColorName = keyof typeof colors;

/** Les trois fonds proposés pour les quote cards de partage. */
export const quoteCardStyles = {
  encre: { key: 'encre', label: 'Encre', bg: colors.ink, text: colors.paper, accent: colors.amber, meta: '#A7ADBC' },
  papier: { key: 'papier', label: 'Papier', bg: colors.paper, text: colors.ink, accent: colors.amber, meta: colors.inkSoft },
  foret: { key: 'foret', label: 'Forêt', bg: colors.green, text: '#F2F7F3', accent: colors.amber, meta: '#B9CFC4' },
} as const;

export type QuoteCardStyleKey = keyof typeof quoteCardStyles;
