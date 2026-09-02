// Attrape les liens /@handle → profil lectrice (avec ?follow=1 pour suivre directement).
// Tout autre segment inconnu → accueil.
import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ManentLoader from '@/src/components/ManentLoader';

export default function RootCatch() {
  const { slug, follow } = useLocalSearchParams<{ slug: string; follow?: string }>();
  const router = useRouter();
  useEffect(() => {
    const s = decodeURIComponent(slug || '');
    if (s.startsWith('@') && s.length > 1) {
      router.replace({ pathname: '/reader/[handle]', params: { handle: s.slice(1), follow: follow || '' } });
    } else {
      router.replace('/(tabs)/home');
    }
  }, [slug, follow, router]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>;
}
