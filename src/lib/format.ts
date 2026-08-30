const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** « 12 juin » */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** « dimanche 20 h » */
export function formatEvent(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const h = d.getHours();
  const m = d.getMinutes();
  return `${DAYS[d.getDay()]} ${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`;
}

/** « il y a 3 j » — libellés courts pour le fil et les notifications. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  const w = Math.floor(d / 7);
  if (w < 5) return `il y a ${w} sem.`;
  return formatDay(iso);
}

/** Nombre de jours restants avant une échéance, jamais négatif. */
export function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function percent(current: number, total: number | null): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

/** « 3e » — rang à la française. */
export function ordinal(n: number): string {
  return n === 1 ? '1re' : `${n}e`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** Normalise un thème saisi librement : minuscules, sans # ni espaces superflus. */
export function normalizeTheme(raw: string): string {
  return raw.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');
}
