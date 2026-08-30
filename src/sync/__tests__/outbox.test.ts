import { dequeue, enqueue, groupByEntity, OUTBOX_LIMIT } from '@/sync/outbox';
import type { SyncOperation } from '@/sync/types';

describe('enqueue', () => {
  it('ajoute une opération à la file', () => {
    const out = enqueue([], 'books', 'upsert', 'book_1');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ entity: 'books', op: 'upsert', rowId: 'book_1' });
  });

  it('ne garde qu’une opération par ligne : la dernière', () => {
    let out = enqueue([], 'books', 'upsert', 'book_1');
    out = enqueue(out, 'books', 'upsert', 'book_1');
    out = enqueue(out, 'books', 'delete', 'book_1');

    expect(out).toHaveLength(1);
    expect(out[0].op).toBe('delete');
  });

  it('distingue deux lignes de même identifiant dans des entités différentes', () => {
    let out = enqueue([], 'books', 'upsert', 'x');
    out = enqueue(out, 'quotes', 'upsert', 'x');
    expect(out).toHaveLength(2);
  });

  it('replace l’opération réécrite en fin de file', () => {
    let out = enqueue([], 'books', 'upsert', 'a');
    out = enqueue(out, 'books', 'upsert', 'b');
    out = enqueue(out, 'books', 'upsert', 'a');

    expect(out.map((o) => o.rowId)).toEqual(['b', 'a']);
  });

  it('abandonne les plus vieilles opérations au-delà du plafond', () => {
    let out: SyncOperation[] = [];
    for (let i = 0; i < OUTBOX_LIMIT + 10; i += 1) {
      out = enqueue(out, 'quotes', 'upsert', `q_${i}`);
    }

    expect(out).toHaveLength(OUTBOX_LIMIT);
    expect(out[0].rowId).toBe('q_10');
  });
});

describe('dequeue', () => {
  it('retire uniquement les opérations traitées', () => {
    let out = enqueue([], 'books', 'upsert', 'a');
    out = enqueue(out, 'quotes', 'upsert', 'b');

    const remaining = dequeue(out, [out[0]]);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].rowId).toBe('b');
  });

  it('ne fait rien si rien n’a été traité', () => {
    const out = enqueue([], 'books', 'upsert', 'a');
    expect(dequeue(out, [])).toEqual(out);
  });
});

describe('groupByEntity', () => {
  it('range les entités dans l’ordre des dépendances', () => {
    let out = enqueue([], 'board_quotes', 'upsert', 'pin');
    out = enqueue(out, 'quotes', 'upsert', 'quote');
    out = enqueue(out, 'books', 'upsert', 'book');
    out = enqueue(out, 'boards', 'upsert', 'board');

    // Une épingle référence un tableau et une citation : elle part en dernier.
    expect(groupByEntity(out).map((g) => g.entity)).toEqual([
      'books',
      'quotes',
      'boards',
      'board_quotes',
    ]);
  });

  it('ignore les entités sans opération', () => {
    const out = enqueue([], 'quotes', 'upsert', 'q');
    expect(groupByEntity(out)).toHaveLength(1);
  });
});
