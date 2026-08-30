import { AFFILIATE_DISCLOSURE, affiliateLinks, LANG_LAW_NOTICE } from '@/services/affiliate';

const book = { title: 'Le Rouge et le Noir', author: 'Stendhal', isbn: '9782070413607' };

describe('affiliateLinks', () => {
  it('propose les librairies indépendantes en premier', () => {
    const links = affiliateLinks(book);
    expect(links.map((l) => l.merchant)).toEqual(['leslibraires', 'fnac', 'amazon']);
  });

  it('affiche le même prix partout — loi Lang', () => {
    const prices = affiliateLinks({ ...book, price: '11,50 €' }).map((l) => l.price);
    expect(new Set(prices).size).toBe(1);
    expect(prices[0]).toBe('11,50 €');
  });

  it('cherche par ISBN quand il est connu', () => {
    const links = affiliateLinks(book);
    links.forEach((l) => expect(l.url).toContain('9782070413607'));
  });

  it('retombe sur le titre et l’auteur sans ISBN', () => {
    const links = affiliateLinks({ ...book, isbn: null });
    expect(links[0].url).toContain(encodeURIComponent('Le Rouge et le Noir Stendhal'));
  });

  it('porte le tag partenaire sur le lien Amazon', () => {
    const amazon = affiliateLinks(book).find((l) => l.merchant === 'amazon')!;
    expect(amazon.url).toContain('tag=');
  });

  it('adresse le bon domaine Amazon selon le pays', () => {
    const be = affiliateLinks({ ...book, country: 'BE' }).find((l) => l.merchant === 'amazon')!;
    expect(be.url).toContain('amazon.com.be');
  });

  it('énonce la commission et le prix unique', () => {
    expect(AFFILIATE_DISCLOSURE).toMatch(/commission/i);
    expect(LANG_LAW_NOTICE).toMatch(/prix unique/i);
  });
});
