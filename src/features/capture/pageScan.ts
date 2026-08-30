import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { readPageNumber } from '@/services/ocr';
import { toBase64 } from '@/services/share';

/**
 * Prend une photo de la page en cours et en extrait le numéro imprimé.
 * Renvoie `null` si l'utilisateur annule. Lève une erreur explicite quand la
 * transcription échoue, pour que l'appelant propose la saisie manuelle.
 */
export async function pickPageNumberFromPhoto(): Promise<number | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Appareil photo indisponible',
      "Autorise Manent à utiliser l'appareil photo pour lire le numéro de page.",
    );
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    allowsEditing: false,
    exif: false,
  });
  if (result.canceled || !result.assets[0]) return null;

  const base64 = await toBase64(result.assets[0].uri);
  const page = await readPageNumber(base64);
  if (page == null) {
    throw new Error("Le numéro de page n'a pas été reconnu. Saisis-le à la main sur la fiche du livre.");
  }
  return page;
}
