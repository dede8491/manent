/** Dictionnaire français — langue par défaut et référence des clés. */
export const fr = {
  'app.name': 'Manent',
  'app.tagline': 'Ce que tes lectures laissent derrière elles',
  'app.watermark': 'capturé avec Manent',

  'action.save': 'Enregistrer',
  'action.cancel': 'Annuler',
  'action.delete': 'Supprimer',
  'action.close': 'Fermer',
  'action.back': 'Retour',
  'action.share': 'Partager',
  'action.follow': 'Suivre',
  'action.join': 'Rejoindre',
  'action.copyLink': 'Copier le lien',

  'status.a-lire': 'à lire',
  'status.en-cours': 'en cours',
  'status.termine': 'terminé',

  'visibility.privee': '🔒 privée',
  'visibility.publique': '🌍 publique',
  'boardVisibility.prive': '🔒 privé',
  'boardVisibility.public': '🌍 public',
  'boardVisibility.collaboratif': '👥 collaboratif',

  'unit.page.short': 'p.',
  'unit.chapter.short': 'chap.',
  'unit.page.label': 'PAGE',
  'unit.chapter.label': 'CHAP.',

  'count.quote': '{n} citation|{n} citations',
  'count.pin': '{n} épingle|{n} épingles',
  'count.member': '{n} membre|{n} membres',
  'count.day': '{n} jour|{n} jours',
  'count.comment': '{n} commentaire|{n} commentaires',
} as const;

export type TranslationKey = keyof typeof fr;
