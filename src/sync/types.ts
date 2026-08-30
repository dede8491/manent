/** Entités synchronisées avec Postgres. Les clubs restent côté serveur. */
export type SyncEntity = 'books' | 'quotes' | 'boards' | 'board_quotes';

export type SyncOp = 'upsert' | 'delete';

/**
 * Une mutation locale en attente d'envoi. L'outbox conserve l'ordre des
 * opérations : c'est ce qui permet de travailler hors ligne puis de rejouer.
 */
export interface SyncOperation {
  id: string;
  entity: SyncEntity;
  op: SyncOp;
  /** Identifiant de la ligne concernée. */
  rowId: string;
  /** Horodatage local de la mutation, ISO 8601 — arbitre les conflits. */
  at: string;
}

export interface SyncState {
  /** Date du dernier `pull` réussi, ISO 8601. Null tant qu'on n'a jamais tiré. */
  lastSyncedAt: string | null;
  outbox: SyncOperation[];
}

export interface SyncReport {
  pushed: number;
  pulled: number;
  deleted: number;
  /** Opérations refusées par le serveur, retirées de l'outbox pour ne pas bloquer. */
  rejected: { operation: SyncOperation; reason: string }[];
  /** Renseigné quand la synchronisation n'a pas pu démarrer. */
  skipped: 'hors-ligne' | 'non-connecte' | null;
}

/** Toute ligne synchronisée porte ces trois colonnes. */
export interface SyncedRow {
  id: string;
  updated_at: string;
  deleted_at: string | null;
}
