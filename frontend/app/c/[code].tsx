// Lien universel /c/{code} → rejoint le club puis l'ouvre.
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
      } catch {
        router.replace('/(tabs)/community');
      }
    })();
  }, [code, router]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>;
}
