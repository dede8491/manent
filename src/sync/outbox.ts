import { uid } from '@/lib/id';
import type { SyncEntity, SyncOp, SyncOperation } from './types';

/** Plafond de l'outbox : au-delà, on abandonne les opérations les plus vieilles. */
export const OUTBOX_LIMIT = 500;

/**
 * Ajoute une mutation à l'outbox.
 *
 * Une seule opération est conservée par ligne : la dernière écrase les
 * précédentes, puisque l'envoi transmet l'état courant de la ligne et non un
 * diff. Supprimer une ligne que le serveur n'a jamais reçue est sans effet —
 * inutile de traiter ce cas à part.
 */
export function enqueue(
  outbox: SyncOperation[],
  entity: SyncEntity,
  op: SyncOp,
  rowId: string,
  at = new Date().toISOString(),
): SyncOperation[] {
  const rest = outbox.filter((o) => !(o.entity === entity && o.rowId === rowId));
  const next = [...rest, { id: uid('op'), entity, op, rowId, at }];
  return next.length > OUTBOX_LIMIT ? next.slice(next.length - OUTBOX_LIMIT) : next;
}

/** Retire les opérations traitées (envoyées ou refusées définitivement). */
export function dequeue(outbox: SyncOperation[], done: SyncOperation[]): SyncOperation[] {
  const ids = new Set(done.map((o) => o.id));
  return outbox.filter((o) => !ids.has(o.id));
}

/** Regroupe les opérations par entité, en préservant leur ordre. */
export function groupByEntity(
  outbox: SyncOperation[],
): { entity: SyncEntity; operations: SyncOperation[] }[] {
  const order: SyncEntity[] = ['books', 'quotes', 'boards', 'board_quotes'];
  return order
    .map((entity) => ({ entity, operations: outbox.filter((o) => o.entity === entity) }))
    .filter((group) => group.operations.length > 0);
}
