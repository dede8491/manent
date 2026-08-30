import {
  daysUntil, formatDay, formatEvent, normalizeTheme, ordinal, percent, plural, timeAgo,
} from '@/lib/format';

describe('formatDay', () => {
  it('écrit la date à la française', () => {
    expect(formatDay('2026-06-12T00:00:00.000Z')).toBe('12 juin');
  });

  it('rend la chaîne telle quelle si elle n’est pas une date', () => {
    expect(formatDay('bientôt')).toBe('bientôt');
  });
});

describe('formatEvent', () => {
  it('donne le jour et l’heure, sans minutes quand elles sont à zéro', () => {
    // Construit en heure locale pour ne pas dépendre du fuseau du runner.
    const sunday = new Date(2026, 5, 14, 20, 0);
    expect(formatEvent(sunday.toISOString())).toBe('dimanche 20 h');
  });

  it('affiche les minutes quand il y en a', () => {
    const sunday = new Date(2026, 5, 14, 20, 30);
    expect(formatEvent(sunday.toISOString())).toBe('dimanche 20 h 30');
  });
});

describe('timeAgo', () => {
  const at = (ms: number) => new Date(Date.now() - ms).toISOString();

  it('couvre les paliers de la minute à la semaine', () => {
    expect(timeAgo(at(10_000))).toBe("à l'instant");
    expect(timeAgo(at(5 * 60_000))).toBe('il y a 5 min');
    expect(timeAgo(at(3 * 3_600_000))).toBe('il y a 3 h');
    expect(timeAgo(at(2 * 86_400_000))).toBe('il y a 2 j');
    expect(timeAgo(at(10 * 86_400_000))).toBe('il y a 1 sem.');
  });

  it('bascule sur la date au-delà d’un mois', () => {
    expect(timeAgo('2026-01-05T12:00:00.000Z')).toBe('5 janvier');
  });
});

describe('daysUntil', () => {
  it('compte les jours restants', () => {
    expect(daysUntil(new Date(Date.now() + 3.2 * 86_400_000).toISOString())).toBe(4);
  });

  it('ne descend jamais sous zéro pour une échéance passée', () => {
    expect(daysUntil('2020-01-01T00:00:00.000Z')).toBe(0);
  });
});

describe('percent', () => {
  it('arrondit et plafonne à 100', () => {
    expect(percent(96, 288)).toBe(33);
    expect(percent(400, 288)).toBe(100);
  });

  it('renvoie 0 quand le total est inconnu', () => {
    expect(percent(50, null)).toBe(0);
    expect(percent(50, 0)).toBe(0);
  });
});

describe('ordinal', () => {
  it('écrit « 1re » au premier rang', () => {
    expect(ordinal(1)).toBe('1re');
    expect(ordinal(3)).toBe('3e');
  });
});

describe('plural', () => {
  it('accorde selon la quantité', () => {
    expect(plural(1, 'citation', 'citations')).toBe('1 citation');
    expect(plural(0, 'citation', 'citations')).toBe('0 citation');
    expect(plural(4, 'citation', 'citations')).toBe('4 citations');
  });
});

describe('normalizeTheme', () => {
  it('retire le dièse, met en minuscules et relie les mots', () => {
    expect(normalizeTheme('  #Développement Personnel ')).toBe('développement-personnel');
    expect(normalizeTheme('##Foi')).toBe('foi');
  });
});
