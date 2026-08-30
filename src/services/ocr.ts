import { callEdgeFunction, hasBackend } from './supabase';

/**
 * Transcription par IA. Une seule brique côté backend (fonction edge `ocr`),
 * deux consignes différentes :
 *  - `citation` : rendre le texte de la page tel quel, sans commentaire ;
 *  - `page`     : ne renvoyer que le numéro de page imprimé.
 * La clé de l'API vision reste côté serveur.
 */
export type OcrTask = 'citation' | 'page';

export interface OcrResult {
  text: string;
  /** Numéro de page détecté sur l'image, quand il est lisible. */
  detectedPage: number | null;
  confidence: number;
}

/** Transcrit une image (URI local) en texte éditable. */
export async function transcribe(imageBase64: string, task: OcrTask): Promise<OcrResult> {
  if (!hasBackend()) throw new Error('offline');
  return callEdgeFunction<OcrResult>('ocr', { image: imageBase64, task });
}

/** Lit uniquement le numéro de page imprimé, pour la mise à jour de progression. */
export async function readPageNumber(imageBase64: string): Promise<number | null> {
  const result = await transcribe(imageBase64, 'page');
  if (result.detectedPage != null) return result.detectedPage;
  const match = result.text.match(/\d{1,4}/);
  return match ? Number(match[0]) : null;
}

/** Message d'erreur unique, pour ne pas dupliquer la formulation dans les écrans. */
export const OCR_FALLBACK_MESSAGE =
  "La transcription automatique n'a pas abouti. Tu peux saisir la citation à la main : ton texte est conservé.";
