// Lien universel /api/s/u/{handle}/bibliotheque ouvert dans l'app → bibliothèque de la lectrice.
import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ManentLoader from '@/src/components/ManentLoader';

export default function ShareLibraryLink() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  useEffect(() => { router.replace({ pathname: '/reader/[handle]', params: { handle: (handle || '').replace(/^@/, ''), section: 'library' } }); }, [handle, router]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>;
}
