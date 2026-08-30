/** Identifiants locaux — remplacés par les UUID Postgres côté Supabase. */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Slug court et lisible utilisé dans les URL publiques manent.app/q/… */
export function slug(len = 8): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
