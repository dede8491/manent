import { callEdgeFunction, hasBackend } from './supabase';

export interface GeneratedCard {
  question: string;
  answer: string;
}

/**
 * Demande au backend des cartes de révision fabriquées à partir de la fiche de
 * lecture et des citations de l'élève. La génération vit côté serveur : c'est
 * là que la clé du modèle et le plafond du plan gratuit sont appliqués.
 */
export async function generateFlashcards(bookId: string): Promise<GeneratedCard[]> {
  if (!hasBackend()) {
    throw new Error(
      "La génération de cartes demande un backend configuré. Tu peux réviser avec les cartes déjà présentes.",
    );
  }
  const { cards } = await callEdgeFunction<{ cards: GeneratedCard[] }>('flashcards', { bookId });
  return cards;
}
