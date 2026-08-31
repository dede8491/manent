// Enregistrement du device pour les notifications push (Emergent managed).
// Ne fonctionne que sur un vrai appareil avec un build natif — no-op sur web / simulateur.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { api } from './api';

export async function registerForPush(userId: string) {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    // Permission d'abord, jeton ensuite. Ne jamais bloquer le flux d'auth.
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await api('/register-push', {
      method: 'POST',
      body: JSON.stringify({
        platform: Platform.OS,
        device_token: tokenResp.data,
      }),
    });
  } catch (e) {
    // Expo Go ne supporte pas les push natifs — silencieux.
    console.log('[push] registration skipped:', e);
  }
}
