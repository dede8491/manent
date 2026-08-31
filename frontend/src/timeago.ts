// Dates relatives en français (« il y a 2 h », « hier », « 12 mars »)
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function timeAgo(iso: string | Date, lang: 'fr' | 'en' = 'fr'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  const fr = lang === 'fr';
  if (sec < 60) return fr ? 'à l’instant' : 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return fr ? `il y a ${min} min` : `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return fr ? `il y a ${h} h` : `${h} h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return fr ? 'hier' : 'yesterday';
  if (days < 7) return fr ? `il y a ${days} j` : `${days} d ago`;
  const months = fr ? MONTHS_FR : MONTHS_EN;
  const label = `${d.getDate()} ${months[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? label : `${label} ${d.getFullYear()}`;
}

export function dateFr(iso: string | Date, lang: 'fr' | 'en' = 'fr'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '';
  const months = lang === 'fr' ? MONTHS_FR : MONTHS_EN;
  const hm = `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()} ${months[d.getMonth()]} · ${hm}`;
}
