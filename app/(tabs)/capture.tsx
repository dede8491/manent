import { Redirect } from 'expo-router';

/**
 * Onglet fantôme : l'entrée centrale de la barre ouvre la modale `/capture`
 * (cf. `CaptureButton` dans _layout). Si la route est atteinte autrement, on
 * redirige vers la modale.
 */
export default function CaptureTab() {
  return <Redirect href="/capture" />;
}
