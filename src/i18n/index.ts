import { fr, type TranslationKey } from './fr';

/**
 * Traduction minimale mais réelle : dictionnaires par locale, interpolation
 * `{clé}` et pluriel « singulier|pluriel ». Le français est la langue par
 * défaut et sert de référence — ajouter une langue revient à déposer un
 * dictionnaire de mêmes clés dans `dictionaries`.
 */
const dictionaries: Record<string, Partial<Record<TranslationKey, string>>> = { fr };

let locale = 'fr';

export function setLocale(next: string): void {
  locale = dictionaries[next] ? next : 'fr';
}

export function getLocale(): string {
  return locale;
}

interface Options {
  /** Valeurs interpolées dans les `{jetons}` de la chaîne. */
  values?: Record<string, string | number>;
  /** Quantité, pour choisir entre « singulier|pluriel ». */
  count?: number;
}

export function t(key: TranslationKey, options: Options = {}): string {
  const raw = dictionaries[locale]?.[key] ?? fr[key] ?? key;

  const forms = raw.split('|');
  const chosen =
    forms.length > 1 && options.count !== undefined
      ? forms[options.count > 1 ? 1 : 0]
      : forms[0];

  const values: Record<string, string | number> = {
    ...options.values,
    ...(options.count !== undefined ? { n: options.count } : {}),
  };

  return chosen.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
