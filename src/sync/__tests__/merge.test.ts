import { mergeById, newestFirst, removeDeleted } from '@/sync/merge';

const item = (id: string, updatedAt: string, label = id) => ({ id, updatedAt, label });

describe('mergeById', () => {
  it('ajoute les lignes distantes inconnues', () => {
    const result = mergeById([item('a', '2026-01-01')], [item('b', '2026-01-02')]);

    expect(result.items).toHaveLength(2);
    expect(result.applied).toBe(1);
  });

  it('laisse gagner la version la plus récente, quel que soit le côté', () => {
    const local = [item('a', '2026-03-01', 'local')];
    const remote = [item('a', '2026-03-05', 'distant')];

    expect(mergeById(local, remote).items[0].label).toBe('distant');
    expect(mergeById(remote, local).items[0].label).toBe('distant');
  });

  it('conserve la version locale quand elle est plus récente', () => {
    const result = mergeById([item('a', '2026-03-10', 'local')], [item('a', '2026-03-01')]);

    expect(result.items[0].label).toBe('local');
    expect(result.kept).toBe(1);
    expect(result.applied).toBe(0);
  });

  it('tranche en faveur du serveur à horodatage identique', () => {
    const result = mergeById([item('a', '2026-03-01', 'local')], [item('a', '2026-03-01', 'distant')]);
    expect(result.items[0].label).toBe('distant');
  });

  it('ne perd rien quand il n’y a rien à tirer', () => {
    const local = [item('a', '2026-01-01'), item('b', '2026-01-02')];
    expect(mergeById(local, []).items).toHaveLength(2);
  });
});

describe('removeDeleted', () => {
  it('retire les identifiants supprimés', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(removeDeleted(items, ['b']).map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('renvoie la liste intacte sans suppression', () => {
    const items = [{ id: 'a' }];
    expect(removeDeleted(items, [])).toBe(items);
  });
});

describe('newestFirst', () => {
  it('classe du plus récent au plus ancien', () => {
    const sorted = newestFirst([
      { id: 'vieux', createdAt: '2026-01-01' },
      { id: 'neuf', createdAt: '2026-06-01' },
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['neuf', 'vieux']);
  });
});
