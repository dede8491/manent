import type { SyncGateway } from '@/sync/gateway';
import type { SyncEntity, SyncedRow } from '@/sync/types';

type Tables = Record<SyncEntity, Record<string, SyncedRow & Record<string, unknown>>>;

export interface FakeGateway extends SyncGateway {
  tables: Tables;
  /** Écrit une ligne côté « serveur », comme le ferait un autre appareil. */
  seed(entity: SyncEntity, row: SyncedRow & Record<string, unknown>): void;
  rows(entity: SyncEntity): (SyncedRow & Record<string, unknown>)[];
  /** Fait échouer la prochaine écriture sur cette entité. */
  failOn(entity: SyncEntity | null): void;
  /** Photos téléversées, indexées par chemin. */
  photos: Record<string, string>;
  failPhotoUpload(shouldFail: boolean): void;
  upsertCalls: { entity: SyncEntity; ids: string[] }[];
}

/** Backend en mémoire : le moteur de synchronisation se teste sans réseau. */
export function fakeGateway(userId: string | null = 'user_1'): FakeGateway {
  const tables: Tables = { books: {}, quotes: {}, boards: {}, board_quotes: {} };
  let failing: SyncEntity | null = null;
  const upsertCalls: { entity: SyncEntity; ids: string[] }[] = [];
  const photos: Record<string, string> = {};
  let photoFails = false;

  return {
    tables,
    upsertCalls,
    photos,

    failPhotoUpload(shouldFail) {
      photoFails = shouldFail;
    },

    async uploadPagePhoto(userId, quoteId, localUri) {
      if (photoFails) throw new Error('téléversement refusé');
      const path = `${userId}/${quoteId}.jpg`;
      photos[path] = localUri;
      return path;
    },

    seed(entity, row) {
      tables[entity][row.id] = { ...row, deleted_at: row.deleted_at ?? null };
    },

    rows(entity) {
      return Object.values(tables[entity]);
    },

    failOn(entity) {
      failing = entity;
    },

    async currentUserId() {
      return userId;
    },

    async upsert(entity, rows) {
      if (failing === entity) throw new Error(`écriture refusée sur ${entity}`);
      upsertCalls.push({ entity, ids: rows.map((r) => String(r.id)) });
      for (const row of rows) {
        const typed = row as SyncedRow & Record<string, unknown>;
        tables[entity][typed.id] = { ...typed, deleted_at: null };
      }
    },

    async softDelete(entity, ids) {
      if (failing === entity) throw new Error(`suppression refusée sur ${entity}`);
      for (const id of ids) {
        const existing = tables[entity][id];
        const at = new Date().toISOString();
        tables[entity][id] = existing
          ? { ...existing, deleted_at: at, updated_at: at }
          : { id, updated_at: at, deleted_at: at };
      }
    },

    async changedSince(entity, since) {
      return Object.values(tables[entity]).filter((r) => !since || r.updated_at > since);
    },

  };
}
