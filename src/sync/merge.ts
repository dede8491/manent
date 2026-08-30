/**
 * Fusion des entités locales et distantes : dernière écriture gagnante.
 *
 * Chaque entité porte un `updatedAt`. À égalité stricte, on garde la version
 * distante : c'est elle que voient les autres appareils, et deux écritures à la
 * milliseconde près sur la même ligne relèvent de l'accident.
 */
interface Timestamped {
  id: string;
  updatedAt: string;
}

export interface MergeResult<T> {
  items: T[];
  /** Lignes distantes retenues — celles qui ont réellement changé l'état local. */
  applied: number;
  /** Lignes locales conservées parce qu'elles étaient plus récentes. */
  kept: number;
}

export function mergeById<T extends Timestamped>(local: T[], remote: T[]): MergeResult<T> {
  const byId = new Map(local.map((item) => [item.id, item]));
  let applied = 0;
  let kept = 0;

  for (const incoming of remote) {
    const current = byId.get(incoming.id);
    if (!current) {
      byId.set(incoming.id, incoming);
      applied += 1;
      continue;
    }
    if (incoming.updatedAt >= current.updatedAt) {
      byId.set(incoming.id, incoming);
      applied += 1;
    } else {
      kept += 1;
    }
  }

  return { items: [...byId.values()], applied, kept };
}

/** Retire les lignes supprimées côté serveur. */
export function removeDeleted<T extends { id: string }>(items: T[], deletedIds: string[]): T[] {
  if (deletedIds.length === 0) return items;
  const gone = new Set(deletedIds);
  return items.filter((item) => !gone.has(item.id));
}

/** Trie du plus récent au plus ancien, l'ordre d'affichage de l'app. */
export function newestFirst<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
