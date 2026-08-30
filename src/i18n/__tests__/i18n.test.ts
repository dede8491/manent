import { getLocale, setLocale, t } from '@/i18n';

describe('t', () => {
  afterEach(() => setLocale('fr'));

  it('rend le libellé du dictionnaire', () => {
    expect(t('app.tagline')).toBe('Ce que tes lectures laissent derrière elles');
  });

  it('accorde le pluriel selon la quantité', () => {
    expect(t('count.quote', { count: 1 })).toBe('1 citation');
    expect(t('count.quote', { count: 7 })).toBe('7 citations');
    // Zéro reste au singulier en français.
    expect(t('count.quote', { count: 0 })).toBe('0 citation');
  });

  it('interpole les jetons nommés', () => {
    expect(t('count.member', { count: 12 })).toBe('12 membres');
  });

  it('laisse le jeton en place quand la valeur manque', () => {
    expect(t('count.day')).toBe('{n} jour');
  });

  it('retombe sur le français pour une locale inconnue', () => {
    setLocale('de');
    expect(getLocale()).toBe('fr');
    expect(t('status.termine')).toBe('terminé');
  });
});
