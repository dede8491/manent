// Liens de partage — une seule source de configuration : EXPO_PUBLIC_PUBLIC_BASE_URL.
// Le jour où le domaine manent.app arrive, on change la variable, rien d'autre.
const BASE = (process.env.EXPO_PUBLIC_PUBLIC_BASE_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

// Les liens partagés pointent vers les pages backend /api/s/* : elles portent les
// balises Open Graph (aperçus riches WhatsApp/iMessage) + boutons stores + manent://.
export const shareUrl = {
  profile: (handle: string) => `${BASE}/api/s/u/${handle}`,
  quote: (quoteId: string) => `${BASE}/api/s/q/${quoteId}`,
  book: (catalogId: string) => `${BASE}/api/s/b/${catalogId}`,
  club: (code: string) => `${BASE}/api/s/c/${code}`,
};
