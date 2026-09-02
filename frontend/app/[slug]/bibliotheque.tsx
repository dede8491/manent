// Lien /@handle/bibliotheque → profil lectrice, section bibliothèque.
import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ManentLoader from '@/src/components/ManentLoader';

export default function LibraryLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  useEffect(() => {
    const s = decodeURIComponent(slug || '').replace(/^@/, '');
    if (s) router.replace({ pathname: '/reader/[handle]', params: { handle: s, section: 'library' } });
    else router.replace('/(tabs)/home');
  }, [slug, router]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>;
}
