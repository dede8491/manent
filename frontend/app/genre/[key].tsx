import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Ancienne page « Genre » (champ genre hérité, peu rempli) : redirige vers la navigation filtrée
// du moteur de classification, bien plus complète. Les anciens liens restent valides.
const MAP: Record<string, Record<string, string[]>> = {
  litterature: { type: ['fiction'] }, polar: { genre: ['polar'] }, imaginaire: { genre: ['imaginaire'] },
  romance: { genre: ['romance'] }, jeunesse: { type: ['jeunesse'] }, bd: { type: ['bande-dessinee'] },
  manga: { type: ['manga'] }, nonfiction: { type: ['nonfiction'] },
};
const LABEL: Record<string, string> = {
  litterature: 'Littérature', polar: 'Polar et thriller', imaginaire: 'Imaginaire', romance: 'Romance',
  jeunesse: 'Jeunesse', bd: 'Bande dessinée', manga: 'Manga', nonfiction: 'Non-fiction',
};

export default function GenreRedirect() {
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  useEffect(() => {
    const k = String(key || '');
    router.replace({ pathname: '/browse', params: { f: JSON.stringify(MAP[k] || { genre: [k] }), title: LABEL[k] || k } });
  }, [key, router]);
  return null;
}
