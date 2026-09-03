import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { loadTaxonomy } from '@/src/classification';

// Ancienne page « Littérature » (aire) : redirige vers la navigation par origine du moteur de classification.
// Les anciens liens (c-afrique, africaine, SN…) restent valides.
const LEGACY: Record<string, string> = {
  africaine: 'afrique', 'maghrébine': 'afrique', antillaise: 'ameriques', 'québécoise': 'ameriques', 'haïtienne': 'ameriques',
  'française': 'europe', belge: 'europe', suisse: 'europe', 'libanaise': 'asie', 'asiatique': 'asie', 'sud-américaine': 'ameriques',
};

export default function AreaRedirect() {
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  useEffect(() => {
    (async () => {
      let k = (key || '').replace(/^c-/, '');
      let f: Record<string, string[]> = {};
      let title = '';
      try {
        const tax = await loadTaxonomy();
        if (/^[A-Za-z]{2}$/.test(k) && tax.labels.country?.[k.toUpperCase()]) { f = { country: [k.toUpperCase()] }; title = tax.labels.country[k.toUpperCase()]; }
        else {
          k = tax.labels.continent?.[k] ? k : (LEGACY[k] || k);
          if (tax.labels.continent?.[k]) { f = { continent: [k] }; title = tax.labels.continent[k]; }
        }
      } catch {}
      router.replace({ pathname: '/browse', params: { f: JSON.stringify(f), title } });
    })();
  }, [key, router]);
  return null;
}
