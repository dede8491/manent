import type { AffiliateLink } from '@/types';

/**
 * Liens d'achat affiliés. En France la loi Lang impose un prix unique du
 * livre : on affiche donc le même prix chez tous les marchands, la
 * différenciation se fait sur le marchand et la livraison. La mention
 * « lien affilié » est obligatoire et non masquable.
 */
const PARTNER_TAGS = {
  amazon: process.env.EXPO_PUBLIC_AMAZON_TAG ?? 'manent-21',
  awin: process.env.EXPO_PUBLIC_AWIN_ID ?? '000000',
  leslibraires: process.env.EXPO_PUBLIC_LESLIBRAIRES_ID ?? 'manent',
};

export const AFFILIATE_DISCLOSURE =
  'Commission reversée à Manent, sans surcoût pour toi.';

export const LANG_LAW_NOTICE =
  'Prix unique du livre : le même prix partout en France, seul le marchand change.';

/** Génère les trois liens d'achat d'un livre, dans l'ordre affiché. */
export function affiliateLinks(params: {
  title: string;
  author: string;
  isbn: string | null;
  price?: string;
  country?: 'FR' | 'BE' | 'CH';
}): AffiliateLink[] {
  const { title, author, isbn, price = '9,90 €', country = 'FR' } = params;
  const q = encodeURIComponent(isbn ?? `${title} ${author}`);
  const amazonHost = country === 'BE' ? 'amazon.com.be' : country === 'CH' ? 'amazon.fr' : 'amazon.fr';

  return [
    {
      merchant: 'leslibraires',
      label: 'Librairies indépendantes',
      price,
      url: `https://www.leslibraires.fr/recherche/?q=${q}&partner=${PARTNER_TAGS.leslibraires}`,
      note: 'Retrait en librairie près de chez toi',
    },
    {
      merchant: 'fnac',
      label: 'Fnac',
      price,
      url: `https://www.awin1.com/cread.php?awinmid=${PARTNER_TAGS.awin}&ued=${encodeURIComponent(
        `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${q}`,
      )}`,
      note: 'Livraison ou retrait magasin',
    },
    {
      merchant: 'amazon',
      label: 'Amazon',
      price,
      url: `https://www.${amazonHost}/s?k=${q}&tag=${PARTNER_TAGS.amazon}`,
      note: 'Livraison rapide',
    },
  ];
}
