/**
 * Métadonnées de livres via l'API Google Books (publique, sans clé pour la
 * recherche simple). Utilisée par l'écran « Ajouter une lecture » (scan ISBN
 * et recherche par titre).
 */
const ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';

export interface BookMetadata {
  title: string;
  author: string;
  coverUrl: string | null;
  pageCount: number | null;
  isbn: string | null;
  publisher: string | null;
  year: string | null;
  description: string | null;
}

interface GoogleVolume {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    pageCount?: number;
    publisher?: string;
    publishedDate?: string;
    description?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

function mapVolume(v: GoogleVolume): BookMetadata {
  const info = v.volumeInfo ?? {};
  const isbn13 = info.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier;
  const isbn10 = info.industryIdentifiers?.find((i) => i.type === 'ISBN_10')?.identifier;
  const raw = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;
  return {
    title: info.title ?? 'Titre inconnu',
    author: info.authors?.join(', ') ?? 'Auteur inconnu',
    // Google renvoie du http et une image minuscule : on force https et zoom 2.
    coverUrl: raw ? raw.replace(/^http:/, 'https:').replace('zoom=1', 'zoom=2') : null,
    pageCount: info.pageCount ?? null,
    isbn: isbn13 ?? isbn10 ?? null,
    publisher: info.publisher ?? null,
    year: info.publishedDate?.slice(0, 4) ?? null,
    description: info.description ?? null,
  };
}

async function query(q: string, max = 12): Promise<BookMetadata[]> {
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&maxResults=${max}&langRestrict=fr&country=FR`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Books a répondu ${res.status}`);
  const json = (await res.json()) as { items?: GoogleVolume[] };
  return (json.items ?? []).map(mapVolume);
}

/** Recherche par ISBN — renvoie null si aucun volume ne correspond. */
export async function lookupIsbn(isbn: string): Promise<BookMetadata | null> {
  const clean = isbn.replace(/[^0-9Xx]/g, '');
  if (clean.length < 10) return null;
  const results = await query(`isbn:${clean}`, 1);
  if (results.length === 0) return null;
  return { ...results[0], isbn: results[0].isbn ?? clean };
}

/** Recherche libre par titre ou auteur. */
export async function searchBooks(term: string): Promise<BookMetadata[]> {
  if (term.trim().length < 2) return [];
  return query(term.trim());
}
