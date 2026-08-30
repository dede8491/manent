import type { BookMetadata } from './googleBooks';

/**
 * Wattpad n'expose pas d'API publique. L'import se fait par lien collé :
 * le backend récupère la page et en extrait les métadonnées Open Graph
 * (titre, auteur, couverture, nombre de chapitres). Côté app on valide le
 * lien et on appelle la fonction edge `wattpad-import`.
 */
import { callEdgeFunction, hasBackend } from './supabase';

const WATTPAD_URL = /^https?:\/\/(www\.)?wattpad\.com\/(story\/)?[\w\-/]+/i;

export function isWattpadUrl(url: string): boolean {
  return WATTPAD_URL.test(url.trim());
}

export interface WattpadStory extends BookMetadata {
  chapters: number;
  genre: string | null;
  url: string;
}

/** Deep link vers l'app Wattpad, avec repli navigateur. */
export function wattpadDeepLink(url: string): string {
  return url;
}

/**
 * Devine un titre lisible à partir du slug de l'URL — utilisé comme repli
 * hors ligne et comme pré-remplissage instantané avant la réponse du backend.
 */
export function guessFromUrl(url: string): WattpadStory {
  // On ne lit que le dernier segment du chemin : sans chemin utile (lien vers
  // l'accueil), il ne faut surtout pas retomber sur le nom de domaine.
  const path = url.trim().split('?')[0].replace(/^https?:\/\/[^/]+/i, '');
  const tail = path.split('/').filter(Boolean).pop() ?? '';
  const words = tail
    .replace(/^\d+-/, '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return {
    title: words.join(' ') || 'Histoire Wattpad',
    author: '@auteur',
    coverUrl: null,
    pageCount: null,
    isbn: null,
    publisher: 'Wattpad',
    year: null,
    description: null,
    chapters: 0,
    genre: null,
    url: url.trim(),
  };
}

export async function importStory(url: string): Promise<WattpadStory> {
  const fallback = guessFromUrl(url);
  if (!hasBackend()) return fallback;
  try {
    const data = await callEdgeFunction<{
      title: string;
      author: string;
      coverUrl: string | null;
      chapters: number;
      genre: string | null;
    }>('wattpad-import', { url: url.trim() });
    return {
      ...fallback,
      title: data.title || fallback.title,
      author: data.author || fallback.author,
      coverUrl: data.coverUrl,
      chapters: data.chapters,
      genre: data.genre,
    };
  } catch {
    // Le scraping peut échouer (page privée, mise en page modifiée) :
    // l'utilisateur complètera à la main.
    return fallback;
  }
}
