/** Les 12 thèmes proposés à l'onboarding, plus les stats de la page thème. */
export const ONBOARDING_THEMES = [
  { slug: 'résilience', emoji: '🪵' },
  { slug: 'argent', emoji: '💶' },
  { slug: 'amour', emoji: '💌' },
  { slug: 'entrepreneuriat', emoji: '🚀' },
  { slug: 'foi', emoji: '🕊' },
  { slug: 'leadership', emoji: '🧭' },
  { slug: 'deuil', emoji: '🕯' },
  { slug: 'confiance', emoji: '🌱' },
  { slug: 'famille', emoji: '🏡' },
  { slug: 'spiritualité', emoji: '🌙' },
  { slug: 'santé', emoji: '🍃' },
  { slug: 'voyage', emoji: '🧳' },
] as const;

export const THEME_EMOJIS: Record<string, string> = Object.fromEntries(
  ONBOARDING_THEMES.map((t) => [t.slug, t.emoji]),
);

/** Thèmes mis en avant dans la recherche (« populaires cette semaine »). */
export const TRENDING_THEMES = [
  'résilience',
  'rentrée',
  'confiance',
  'amour',
  'entrepreneuriat',
  'deuil',
  'sororité',
  'spiritualité',
];

export const THEME_STATS: Record<string, { quotes: number; books: number; readers: number }> = {
  résilience: { quotes: 4820, books: 612, readers: 2940 },
  argent: { quotes: 3110, books: 401, readers: 1880 },
  amour: { quotes: 9450, books: 1204, readers: 5120 },
  entrepreneuriat: { quotes: 2740, books: 388, readers: 1640 },
  foi: { quotes: 1980, books: 254, readers: 1210 },
  leadership: { quotes: 2260, books: 297, readers: 1390 },
  deuil: { quotes: 1470, books: 210, readers: 990 },
  confiance: { quotes: 3890, books: 445, readers: 2310 },
  famille: { quotes: 2610, books: 340, readers: 1560 },
  spiritualité: { quotes: 2050, books: 276, readers: 1320 },
  santé: { quotes: 1720, books: 233, readers: 1050 },
  voyage: { quotes: 1340, books: 198, readers: 870 },
};

export function themeStats(slug: string) {
  return THEME_STATS[slug] ?? { quotes: 128, books: 24, readers: 76 };
}

export function themeEmoji(slug: string): string {
  return THEME_EMOJIS[slug] ?? '#';
}
