// Lien universel /c/{code} → rejoint le club puis l'ouvre.
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/src/api';
import ManentLoader from '@/src/components/ManentLoader';

export default function ClubInviteLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ club_id: string }>('/clubs/join', { method: 'POST', body: JSON.stringify({ code: (code || '').toUpperCase() }) });
        router.replace({ pathname: '/club/[id]', params: { id: r.club_id } });
      } catch (e: any) {
        if (e?.status === 401) {
          // Pas encore de compte : le lien est gardé, l'onboarding le rejouera après la création du compte.
          await AsyncStorage.setItem('pending_deep_link', `/c/${(code || '').toUpperCase()}`).catch(() => {});
          router.replace('/onboarding');
          return;
        }
        router.replace({ pathname: '/(tabs)/community', params: { join: '1', code: (code || '').toUpperCase() } });
      }
    })();
  }, [code, router]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>;
}
