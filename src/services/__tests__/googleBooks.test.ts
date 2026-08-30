import { lookupIsbn, searchBooks } from '@/services/googleBooks';

const volume = (over: Record<string, unknown> = {}) => ({
  volumeInfo: {
    title: 'Le Rouge et le Noir',
    authors: ['Stendhal'],
    pageCount: 576,
    publisher: 'Gallimard',
    publishedDate: '1972-03-01',
    imageLinks: { thumbnail: 'http://books.google.com/cover?zoom=1' },
    industryIdentifiers: [
      { type: 'ISBN_10', identifier: '2070413608' },
      { type: 'ISBN_13', identifier: '9782070413607' },
    ],
    ...over,
  },
});

const respondWith = (body: unknown, ok = true, status = 200) => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
};

afterEach(() => jest.restoreAllMocks());

describe('lookupIsbn', () => {
  it('renvoie les métadonnées et préfère l’ISBN-13', async () => {
    respondWith({ items: [volume()] });
    const meta = await lookupIsbn('978-2-07-041360-7');

    expect(meta).toMatchObject({
      title: 'Le Rouge et le Noir',
      author: 'Stendhal',
      pageCount: 576,
      isbn: '9782070413607',
      year: '1972',
    });
  });

  it('force le https et une couverture lisible', async () => {
    respondWith({ items: [volume()] });
    const meta = await lookupIsbn('9782070413607');
    expect(meta!.coverUrl).toBe('https://books.google.com/cover?zoom=2');
  });

  it('interroge Google Books avec le préfixe isbn:', async () => {
    respondWith({ items: [volume()] });
    await lookupIsbn('9782070413607');

    const url = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('isbn%3A9782070413607');
  });

  it('renvoie null quand aucun volume ne correspond', async () => {
    respondWith({});
    expect(await lookupIsbn('9782070413607')).toBeNull();
  });

  it('retombe sur l’ISBN scanné si Google n’en fournit pas', async () => {
    respondWith({ items: [volume({ industryIdentifiers: undefined })] });
    const meta = await lookupIsbn('9782070413607');
    expect(meta!.isbn).toBe('9782070413607');
  });

  it('ignore un code-barres trop court sans appeler le réseau', async () => {
    respondWith({ items: [volume()] });
    expect(await lookupIsbn('12345')).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('remonte une erreur lisible quand l’API échoue', async () => {
    respondWith({}, false, 503);
    await expect(lookupIsbn('9782070413607')).rejects.toThrow('503');
  });
});

describe('searchBooks', () => {
  it('mappe chaque résultat', async () => {
    respondWith({ items: [volume(), volume({ title: 'Autre', authors: ['A', 'B'] })] });
    const results = await searchBooks('stendhal');

    expect(results).toHaveLength(2);
    expect(results[1].author).toBe('A, B');
  });

  it('remplit les champs manquants sans planter', async () => {
    respondWith({ items: [{ volumeInfo: {} }] });
    const [only] = await searchBooks('inconnu');

    expect(only).toMatchObject({
      title: 'Titre inconnu',
      author: 'Auteur inconnu',
      coverUrl: null,
      pageCount: null,
      isbn: null,
    });
  });

  it('n’interroge pas le réseau pour un terme trop court', async () => {
    respondWith({ items: [] });
    expect(await searchBooks(' a ')).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
