// Lien universel /b/{catalog_id} → fiche découverte du livre.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/src/api';
import ManentLoader from '@/src/components/ManentLoader';

export default function BookLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const b = await api<any>(`/catalog/book/${id}`);
        router.replace({ pathname: '/discover/book', params: { title: b.title, author: b.author || '', cover: b.cover || '', year: b.year || '', summary: b.summary || '' } });
      } catch { setFailed(true); router.replace('/(tabs)/home'); }
    })();
  }, [id, router]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{!failed && <ManentLoader />}</View>;
}
