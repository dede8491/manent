import { File } from 'expo-file-system';

import { supabase } from '@/services/supabase';
import type { BoardRow, BookRow, PinRow, QuoteRow } from './mappers';
import type { SyncEntity, SyncedRow } from './types';

/**
 * Tout ce que le moteur de synchronisation demande au réseau. L'interface
 * existe pour que le moteur soit testable sans backend : les tests injectent
 * une passerelle en mémoire.
 */
export interface SyncGateway {
  /** Identifiant de la personne connectée, ou null. */
  currentUserId(): Promise<string | null>;
  /** Écrit (insert ou update) des lignes complètes. */
  upsert(entity: SyncEntity, rows: Record<string, unknown>[]): Promise<void>;
  /** Suppression douce : la ligne reste, `deleted_at` est renseigné. */
  softDelete(entity: SyncEntity, ids: string[]): Promise<void>;
  /**
   * Téléverse la photo d'une page dans le bucket privé et renvoie son chemin.
   * Le bucket n'est jamais public : la photo relève de l'usage personnel, seule
   * la citation transcrite peut circuler.
   */
  uploadPagePhoto(userId: string, quoteId: string, localUri: string): Promise<string>;
  /**
   * Lignes modifiées depuis `since` (null = tout), suppressions comprises.
   * La requête est restreinte aux lignes de `userId` : les politiques RLS
   * autorisent aussi la lecture des citations publiques d'autrui, qui n'ont
   * rien à faire dans le miroir local.
   */
  changedSince(entity: SyncEntity, since: string | null, userId: string): Promise<SyncedRow[]>;
}

export type RowOf = {
  books: BookRow;
  quotes: QuoteRow;
  boards: BoardRow;
  board_quotes: PinRow;
};

/** Passerelle réelle, adossée à Supabase. */
export function supabaseGateway(): SyncGateway | null {
  const client = supabase();
  if (!client) return null;

  return {
    async currentUserId() {
      const { data } = await client.auth.getUser();
      return data.user?.id ?? null;
    },

    async upsert(entity, rows) {
      if (rows.length === 0) return;
      const { error } = await client.from(entity).upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    },

    async softDelete(entity, ids) {
      if (ids.length === 0) return;
      const { error } = await client
        .from(entity)
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw new Error(error.message);
    },

    async uploadPagePhoto(userId, quoteId, localUri) {
      const path = `${userId}/${quoteId}.jpg`;
      const bytes = await new File(localUri).bytes();
      const { error } = await client.storage
        .from('page-photos')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(error.message);
      return path;
    },

    async changedSince(entity, since, userId) {
      // Les épingles d'un tableau collaboratif appartiennent à leurs auteurs :
      // une fonction Postgres rend celles des tableaux auxquels j'ai accès.
      if (entity === 'board_quotes') {
        const { data, error } = await client.rpc('my_board_quotes', { since });
        if (error) throw new Error(error.message);
        return (data ?? []) as SyncedRow[];
      }

      const ownerColumn = entity === 'boards' ? 'owner_id' : 'user_id';
      let query = client.from(entity).select('*').eq(ownerColumn, userId);
      if (since) query = query.gt('updated_at', since);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as SyncedRow[];
    },
  };
}
