import { guessFromUrl, importStory, isWattpadUrl } from '@/services/wattpad';

describe('isWattpadUrl', () => {
  it('accepte les liens d’histoire et de chapitre', () => {
    expect(isWattpadUrl('https://www.wattpad.com/story/123-les-nuits-de-bamako')).toBe(true);
    expect(isWattpadUrl('http://wattpad.com/456789-chapitre-un')).toBe(true);
    expect(isWattpadUrl('  https://www.wattpad.com/story/1  ')).toBe(true);
  });

  it('refuse tout ce qui n’est pas Wattpad', () => {
    expect(isWattpadUrl('https://wattpad.evil.com/story/1')).toBe(false);
    expect(isWattpadUrl('https://www.babelio.com/livres/1')).toBe(false);
    expect(isWattpadUrl('pas une url')).toBe(false);
  });
});

describe('guessFromUrl', () => {
  it('reconstruit un titre lisible depuis le slug', () => {
    const story = guessFromUrl('https://www.wattpad.com/story/123456-les-nuits-de-bamako');
    expect(story.title).toBe('Les Nuits De Bamako');
    expect(story.publisher).toBe('Wattpad');
  });

  it('ignore les paramètres de requête et la barre finale', () => {
    const story = guessFromUrl('https://www.wattpad.com/story/1-mon-histoire/?utm_source=x');
    expect(story.title).toBe('Mon Histoire');
  });

  it('reste exploitable quand le slug est vide', () => {
    const story = guessFromUrl('https://www.wattpad.com/');
    expect(story.title).toBe('Histoire Wattpad');
    expect(story.author).toBe('@auteur');
  });
});

describe('importStory', () => {
  it('retombe sur les métadonnées déduites de l’URL sans backend', async () => {
    const url = 'https://www.wattpad.com/story/123456-les-nuits-de-bamako';
    // Aucune variable EXPO_PUBLIC_SUPABASE_* n'est définie en test.
    await expect(importStory(url)).resolves.toMatchObject({
      title: 'Les Nuits De Bamako',
      url,
      chapters: 0,
    });
  });
});
