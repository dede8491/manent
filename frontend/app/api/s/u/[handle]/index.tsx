// Lien universel /api/s/u/{handle} ouvert dans l'app → profil lectrice (follow=1 : suivre).
import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ManentLoader from '@/src/components/ManentLoader';

export default function ShareProfileLink() {
  const { handle, follow } = useLocalSearchParams<{ handle: string; follow?: string }>();
  const router = useRouter();
  useEffect(() => { router.replace({ pathname: '/reader/[handle]', params: { handle: (handle || '').replace(/^@/, ''), follow: follow || '' } }); }, [handle, follow, router]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View>;
}
