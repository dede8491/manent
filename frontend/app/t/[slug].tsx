// Lien universel /t/{slug} : ouvre un tableau (public ou dont je suis membre) ; avec ?code=… on le rejoint.
import React, { useEffect } from 'react';
import { View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/src/api';
import ManentLoader from '@/src/components/ManentLoader';
import { useT } from '@/src/i18n';

export default function BoardLink() {
  const t = useT();
  const { slug, code } = useLocalSearchParams<{ slug: string; code?: string }>();
  const router = useRouter();
  useEffect(() => {
    (async () => {
      try {
        if (code) {
          const r = await api<{ board_id: string }>('/boards/join', { method: 'POST', body: JSON.stringify({ code: String(code).toUpperCase() }) });
          router.replace({ pathname: '/board/[id]', params: { id: r.board_id } });
          return;
        }
        const b = await api<{ board_id: string }>(`/boards/by-slug/${encodeURIComponent(String(slug || ''))}`);
        router.replace({ pathname: '/board/[id]', params: { id: b.board_id } });
      } catch {
        Alert.alert(t('Tableau privé'), t('Ce tableau est privé : demande une invitation à sa créatrice.'));
        router.replace('/(tabs)/community');
      }
    })();
  }, [slug, code, router, t]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>;
}
