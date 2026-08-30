import { Redirect } from 'expo-router';

import { useStore } from '@/store/useStore';

/** Point d'entrée : onboarding tant que le compte n'est pas créé. */
export default function Index() {
  const onboarded = useStore((s) => s.onboarded);
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding/bienvenue'} />;
}
