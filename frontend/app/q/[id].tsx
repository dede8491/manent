// Lien universel /q/{id} → citation dans l'app.
import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ManentLoader from '@/src/components/ManentLoader';
import { View } from 'react-native';

export default function QuoteLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: '/quote/[id]', params: { id } });
  }, [id, router]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>;
}
