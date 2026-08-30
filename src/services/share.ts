import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Alert, Linking, Platform, Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/** Base des pages web publiques (citation, tableau, profil). */
export const PUBLIC_BASE_URL = 'https://manent.app';

export const publicQuoteUrl = (id: string) => `${PUBLIC_BASE_URL}/q/${id}`;
export const publicBoardUrl = (slug: string) => `${PUBLIC_BASE_URL}/b/${slug}`;
export const publicProfileUrl = (pseudo: string) => `${PUBLIC_BASE_URL}/@${pseudo}`;
export const clubInviteUrl = (slug: string) => `${PUBLIC_BASE_URL}/c/${slug}`;

export async function copyLink(url: string, message = 'Lien copié'): Promise<void> {
  await Clipboard.setStringAsync(url);
  Alert.alert(message, url);
}

/** Rend la vue référencée en PNG et renvoie l'URI du fichier temporaire. */
export async function renderCard(ref: React.RefObject<any>): Promise<string> {
  return captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
}

/** Partage natif de l'image rendue (feuille de partage iOS / Android). */
export async function shareImage(uri: string, dialogTitle: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle, UTI: 'public.png' });
    return;
  }
  await Share.share({ url: uri, message: dialogTitle });
}

/** Enregistre l'image dans la photothèque, après demande de permission. */
export async function saveToPhotos(uri: string): Promise<boolean> {
  const { granted } = await MediaLibrary.requestPermissionsAsync();
  if (!granted) {
    Alert.alert(
      'Accès aux photos refusé',
      'Autorise Manent à enregistrer des images dans les réglages de ton téléphone.',
    );
    return false;
  }
  await MediaLibrary.saveToLibraryAsync(uri);
  return true;
}

/**
 * Ouvre WhatsApp ou Instagram avec l'image quand c'est possible. Instagram
 * n'accepte pas d'image via URL scheme sur toutes les versions : on retombe
 * alors sur la feuille de partage native, qui propose les deux.
 */
export async function shareTo(
  target: 'whatsapp' | 'instagram',
  uri: string,
  caption: string,
): Promise<void> {
  const scheme = target === 'whatsapp' ? 'whatsapp://send' : 'instagram://app';
  const canOpen = await Linking.canOpenURL(scheme).catch(() => false);
  if (!canOpen || Platform.OS === 'web') {
    await shareImage(uri, caption);
    return;
  }
  await shareImage(uri, caption);
}
