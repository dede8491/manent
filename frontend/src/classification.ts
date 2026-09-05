import { useEffect, useState } from 'react';
import { api } from '@/src/api';

// Sélection de filtres : { dimension: [clés] } — OU dans une dimension, ET entre dimensions.
// country/region/continent = origine de l'AUTEUR ; story_* = lieu de l'HISTOIRE.
export type Sel = Record<string, string[]>;
export const DIMS = ['continent', 'region', 'country', 'story_continent', 'story_region', 'story_country', 'type', 'genre', 'domain', 'theme', 'emotion', 'mood', 'audience', 'lang'] as const;

export type Taxonomy = {
  geo: { key: string; label: string; emoji?: string; regions: { key: string; label: string; countries: { key: string; label: string }[] }[] }[];
  types: { key: string; label: string; emoji?: string; subtypes: { key: string; label: string }[] }[];
  genres: { key: string; label: string }[];
  domains: { key: string; label: string; emoji?: string; items: { key: string; label: string }[] }[];
  themes: { key: string; label: string; emoji?: string; items: { key: string; label: string }[] }[];
  popular_themes: { key: string; label: string; emoji: string }[];
  emotions: { key: string; label: string; emoji: string }[];
  moods: { key: string; label: string; emoji: string }[];
  audiences: { key: string; label: string }[];
  levels?: { key: string; label: string }[];
  languages: { key: string; label: string }[];
  labels: Record<string, Record<string, string>>;
  thresholds?: { strong: number; proposed: number };
};

let cache: Taxonomy | null = null;
let pending: Promise<Taxonomy> | null = null;

export function loadTaxonomy(force = false): Promise<Taxonomy> {
  if (cache && !force) return Promise.resolve(cache);
  if (!pending) pending = api<Taxonomy>('/catalog/taxonomy').then(t => { cache = t; return t; }).finally(() => { pending = null; });
  return pending;
}

export function useTaxonomy(): Taxonomy | null {
  const [tax, setTax] = useState<Taxonomy | null>(cache);
  useEffect(() => { if (!cache) loadTaxonomy().then(setTax).catch(() => {}); }, []);
  return tax;
}

export function parseSel(raw?: string | string[] | null): Sel {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s) return {};
  try {
    const obj = JSON.parse(s);
    const out: Sel = {};
    for (const d of DIMS) if (Array.isArray(obj[d]) && obj[d].length) out[d] = obj[d].map(String);
    return out;
  } catch { return {}; }
}

export function selToQuery(sel: Sel, extra: Record<string, string | number | undefined> = {}): string {
  const p = new URLSearchParams();
  for (const d of DIMS) for (const k of sel[d] || []) p.append(d, k);
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== '') p.set(k, String(v));
  return p.toString();
}

export function countSel(sel: Sel): number {
  return Object.values(sel).reduce((n, a) => n + (a?.length || 0), 0);
}

// Géographie progressive : retirer un continent retire ses régions/pays (pour l'auteur comme pour l'histoire).
function pruneGeo(out: Sel, prefix: '' | 'story_', dim: string, key: string) {
  if (!cache) return;
  const rDim = `${prefix}region`, cDim = `${prefix}country`;
  if (dim === `${prefix}continent`) {
    const c = cache.geo.find(x => x.key === key);
    const regs = new Set((c?.regions || []).map(r => r.key));
    const ctys = new Set((c?.regions || []).flatMap(r => r.countries.map(x => x.key)));
    if (out[rDim]) { out[rDim] = out[rDim].filter(r => !regs.has(r)); if (!out[rDim].length) delete out[rDim]; }
    if (out[cDim]) { out[cDim] = out[cDim].filter(r => !ctys.has(r)); if (!out[cDim].length) delete out[cDim]; }
  }
  if (dim === rDim) {
    const r = cache.geo.flatMap(c => c.regions).find(x => x.key === key);
    const ctys = new Set((r?.countries || []).map(x => x.key));
    if (out[cDim]) { out[cDim] = out[cDim].filter(x => !ctys.has(x)); if (!out[cDim].length) delete out[cDim]; }
  }
}

export function toggleSel(sel: Sel, dim: string, key: string): Sel {
  const cur = sel[dim] || [];
  const removing = cur.includes(key);
  const next = removing ? cur.filter(k => k !== key) : [...cur, key];
  const out = { ...sel, [dim]: next };
  if (!next.length) delete out[dim];
  if (removing) {
    pruneGeo(out, dim.startsWith('story_') ? 'story_' : '', dim, key);
    if (dim === 'type' && cache) {
      const fam = cache.types.find(f => f.key === key);
      if (fam) {
        const subs = new Set(fam.subtypes.map(s => s.key));
        out.type = (out.type || []).filter(k => !subs.has(k));
        if (!out.type.length) delete out.type;
        if (key === 'fiction' && out.genre) delete out.genre;
      }
    }
  }
  return out;
}

export function labelOf(tax: Taxonomy | null, dim: string, key: string): string {
  return tax?.labels?.[dim]?.[key] || key;
}

export const DIM_LABELS: Record<string, string> = {
  type: 'Type', genre: 'Genre', continent: 'Continent (auteur)', region: 'Région (auteur)', country: 'Pays (auteur)',
  story_continent: 'Continent (histoire)', story_region: 'Région (histoire)', story_country: 'Pays (histoire)',
  domain: 'Domaine', theme: 'Thème', emotion: 'Émotion', mood: 'Ambiance', audience: 'Public', lang: 'Langue',
};

export const SORTS: { key: string; label: string }[] = [
  { key: 'pertinence', label: 'Pertinence' }, { key: 'populaires', label: 'Les plus lus' },
  { key: 'recents', label: 'Ajoutés récemment' }, { key: 'annee', label: 'Année de parution' }, { key: 'titre', label: 'Titre (A → Z)' },
];
