// Liens de partage — une seule source de configuration : EXPO_PUBLIC_PUBLIC_BASE_URL.
// Le jour où le domaine manent.app arrive, on change la variable, rien d'autre.
const BASE = (process.env.EXPO_PUBLIC_PUBLIC_BASE_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

export const shareUrl = {
  profile: (handle: string) => `${BASE}/@${handle}`,
  quote: (quoteId: string) => `${BASE}/q/${quoteId}`,
  book: (catalogId: string) => `${BASE}/b/${catalogId}`,
  club: (code: string) => `${BASE}/c/${code}`,
};
