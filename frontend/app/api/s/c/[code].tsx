// Lien universel /api/s/c/{code} ouvert dans l'app → rejoindre le club.
import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ManentLoader from '@/src/components/ManentLoader';

export default function ShareClubLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  useEffect(() => { router.replace({ pathname: '/c/[code]', params: { code } }); }, [code, router]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>;
}
