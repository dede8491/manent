// Lien universel /q/{id} → citation dans l'app.
import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ManentLoader from '@/src/components/ManentLoader';
import { View } from 'react-native';
import { useAuth } from '@/src/auth';

export default function QuoteLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading || !user || !id) return; // sans session : NavGate mémorise le lien
    router.replace({ pathname: '/quote/[id]', params: { id } });
  }, [id, router, user, loading]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>;
}
