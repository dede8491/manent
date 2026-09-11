// Lien universel /api/s/t/{slug} ouvert dans l'app → tableau.
import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ManentLoader from '@/src/components/ManentLoader';

export default function ShareBoardLink() {
  const { slug, code } = useLocalSearchParams<{ slug: string; code?: string }>();
  const router = useRouter();
  useEffect(() => { router.replace({ pathname: '/t/[slug]', params: { slug, ...(code ? { code } : {}) } }); }, [slug, code, router]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>;
}
