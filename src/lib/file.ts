import { File } from 'expo-file-system';

/**
 * Encode un fichier local en base64, pour l'envoyer aux fonctions edge
 * (transcription d'une citation, lecture d'un numéro de page).
 */
export async function toBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}
