import {
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_900Black,
  useFonts as useFraunces,
} from '@expo-google-fonts/fraunces';
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_700Bold,
} from '@expo-google-fonts/public-sans';

/** Charge les deux familles typographiques de Manent. */
export function useAppFonts(): boolean {
  const [loaded, error] = useFraunces({
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Fraunces_900Black,
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_700Bold,
  });
  // En cas d'échec de chargement on n'immobilise pas l'app : les polices
  // système prendront le relais.
  return loaded || !!error;
}
