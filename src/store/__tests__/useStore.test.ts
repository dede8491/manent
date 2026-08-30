import { FREE_MONTHLY_CAPTURES, useStore } from '@/store/useStore';

const store = () => useStore.getState();

beforeEach(() => {
  store().resetAll();
});

describe('progression', () => {
  it('passe le livre en terminé quand on atteint la dernière page', () => {
    const book = store().books.find((b) => b.id === 'book_atelier')!;
    store().setProgress(book.id, book.totalUnits!);

    const updated = store().books.find((b) => b.id === book.id)!;
    expect(updated.progressUnits).toBe(book.totalUnits);
    expect(updated.status).toBe('termine');
  });

  it('plafonne la progression au nombre de pages du livre', () => {
    store().setProgress('book_atelier', 9999);
    expect(store().books.find((b) => b.id === 'book_atelier')!.progressUnits).toBe(288);
  });

  it('refuse une progression négative', () => {
    store().setProgress('book_atelier', -20);
    expect(store().books.find((b) => b.id === 'book_atelier')!.progressUnits).toBe(0);
  });

  it('fait passer un livre à lire en cours de lecture', () => {
    expect(store().books.find((b) => b.id === 'book_lignes')!.status).toBe('a-lire');
    store().setProgress('book_lignes', 40);
    expect(store().books.find((b) => b.id === 'book_lignes')!.status).toBe('en-cours');
  });

  it('suit les chapitres pour une histoire Wattpad', () => {
    store().setProgress('book_bamako', 24);
    const story = store().books.find((b) => b.id === 'book_bamako')!;
    expect(story.progressUnits).toBe(24);
    expect(story.status).toBe('termine');
  });
});

describe('citations', () => {
  it('ajoute une citation en tête de liste', () => {
    const before = store().quotes.length;
    const quote = store().addQuote({
      text: 'Une phrase gardée.',
      locator: 12,
      note: '',
      themes: ['confiance'],
      sourceImageUri: null,
      isPublic: false,
      bookId: 'book_atelier',
    });

    expect(store().quotes).toHaveLength(before + 1);
    expect(store().quotes[0].id).toBe(quote.id);
    expect(quote.createdAt).toBeTruthy();
  });

  it('supprime les épingles de la citation supprimée', () => {
    expect(store().pins.some((p) => p.quoteId === 'quote_1')).toBe(true);
    store().removeQuote('quote_1');
    expect(store().pins.some((p) => p.quoteId === 'quote_1')).toBe(false);
  });

  it('supprime les citations du livre retiré', () => {
    store().removeBook('book_essais');
    expect(store().books.some((b) => b.id === 'book_essais')).toBe(false);
    expect(store().quotes.some((q) => q.bookId === 'book_essais')).toBe(false);
  });
});

describe('tableaux', () => {
  it('épingle puis désépingle la même citation', () => {
    const board = store().addBoard('Test', '', 'prive');
    store().togglePin(board.id, 'quote_3');
    expect(store().pins.some((p) => p.boardId === board.id && p.quoteId === 'quote_3')).toBe(true);

    store().togglePin(board.id, 'quote_3');
    expect(store().pins.some((p) => p.boardId === board.id && p.quoteId === 'quote_3')).toBe(false);
  });

  it('donne à chaque tableau un slug de partage distinct', () => {
    const a = store().addBoard('A', '', 'public');
    const b = store().addBoard('B', '', 'public');
    expect(a.shareSlug).not.toBe(b.shareSlug);
  });

  it('retire les épingles du tableau supprimé sans toucher aux citations', () => {
    store().removeBoard('board_matins');
    expect(store().pins.some((p) => p.boardId === 'board_matins')).toBe(false);
    expect(store().quotes.some((q) => q.id === 'quote_1')).toBe(true);
  });
});

describe('quota de transcriptions IA', () => {
  it('décompte les captures du plan gratuit', () => {
    expect(store().remainingCaptures()).toBe(FREE_MONTHLY_CAPTURES);
    store().consumeCapture();
    store().consumeCapture();
    expect(store().remainingCaptures()).toBe(FREE_MONTHLY_CAPTURES - 2);
  });

  it('ne descend jamais sous zéro', () => {
    for (let i = 0; i < FREE_MONTHLY_CAPTURES + 5; i += 1) store().consumeCapture();
    expect(store().remainingCaptures()).toBe(0);
  });

  it('repart à zéro au changement de mois', () => {
    useStore.setState({ captureMonth: '2020-01', captureCount: FREE_MONTHLY_CAPTURES });
    expect(store().remainingCaptures()).toBe(FREE_MONTHLY_CAPTURES);

    store().consumeCapture();
    expect(store().captureMonth).toBe(new Date().toISOString().slice(0, 7));
    expect(store().captureCount).toBe(1);
  });

  it('est illimité en Premium', () => {
    store().startPremium('annuel');
    expect(store().remainingCaptures()).toBe(Infinity);
  });
});

describe('premium', () => {
  it('ouvre un essai de 7 jours et retient la formule', () => {
    store().startPremium('annuel');
    const { premium, plan, premiumTrialEndsAt } = store().user;

    expect(premium).toBe(true);
    expect(plan).toBe('annuel');
    const days = (new Date(premiumTrialEndsAt!).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(7);
  });

  it('efface la formule à la résiliation', () => {
    store().startPremium('mensuel');
    store().cancelPremium();
    expect(store().user).toMatchObject({ premium: false, plan: null, premiumTrialEndsAt: null });
  });
});

describe('flashcards à répétition espacée', () => {
  it('avance le palier et repousse la carte sue', () => {
    const card = store().flashcards.find((f) => f.id === 'fc_1')!;
    store().reviewFlashcard(card.id, true);

    const reviewed = store().flashcards.find((f) => f.id === card.id)!;
    expect(reviewed.box).toBe(card.box + 1);
    // Palier 1 → révision dans 2 jours.
    const days = (new Date(reviewed.dueAt).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(2);
  });

  it('ramène la carte ratée au palier zéro, à revoir tout de suite', () => {
    store().reviewFlashcard('fc_3', false);
    const reviewed = store().flashcards.find((f) => f.id === 'fc_3')!;

    expect(reviewed.box).toBe(0);
    expect(new Date(reviewed.dueAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('plafonne le palier à 5', () => {
    for (let i = 0; i < 10; i += 1) store().reviewFlashcard('fc_1', true);
    expect(store().flashcards.find((f) => f.id === 'fc_1')!.box).toBe(5);
  });
});

describe('thèmes suivis', () => {
  it('ajoute puis retire un thème, en le normalisant', () => {
    store().toggleFollowedTheme('#Deuil');
    expect(store().user.followedThemes).toContain('deuil');

    store().toggleFollowedTheme('deuil');
    expect(store().user.followedThemes).not.toContain('deuil');
  });
});

describe('clubs', () => {
  it('rejoint un club ouvert et incrémente le nombre de membres', () => {
    const before = store().clubs.find((c) => c.id === 'club_resilience')!;
    store().joinClub(before.id);

    const after = store().clubs.find((c) => c.id === before.id)!;
    expect(after.joined).toBe(true);
    expect(after.role).toBe('membre');
    expect(after.memberCount).toBe(before.memberCount + 1);
  });

  it('quitte un club sans passer sous zéro membre', () => {
    store().leaveClub('club_encre');
    const club = store().clubs.find((c) => c.id === 'club_encre')!;
    expect(club.joined).toBe(false);
    expect(club.role).toBeNull();
    expect(club.memberCount).toBeGreaterThanOrEqual(0);
  });

  it('crée un club dont je suis l’animatrice', () => {
    const club = store().createClub({
      name: 'Nouveau cercle',
      description: '',
      type: 'ouvert',
      bookTitle: 'Des lignes de faille',
      bookAuthor: 'Éloi Ravenne',
      deadline: '2026-12-01',
    });

    expect(club.role).toBe('animatrice');
    expect(club.joined).toBe(true);
    expect(club.commonRead?.bookTitle).toBe('Des lignes de faille');
    expect(club.memberProgress).toHaveLength(1);
  });

  it('ne crée pas de lecture commune sans livre choisi', () => {
    const club = store().createClub({
      name: 'Sans lecture',
      description: '',
      type: 'ouvert',
      bookTitle: '',
      bookAuthor: '',
      deadline: '2026-12-01',
    });
    expect(club.commonRead).toBeNull();
  });

  it('bascule ma présence à un événement', () => {
    store().toggleEventAttendance('club_encre', 'event_1');
    const going = store().clubs.find((c) => c.id === 'club_encre')!.events[0].attendeeIds;
    expect(going).toContain('user_me');

    store().toggleEventAttendance('club_encre', 'event_1');
    expect(store().clubs.find((c) => c.id === 'club_encre')!.events[0].attendeeIds).not.toContain(
      'user_me',
    );
  });

  it('ajoute mon commentaire au passage de la semaine', () => {
    store().addClubComment('post_1', '  Je suis d’accord avec theo.  ');
    const comments = store().clubPosts.find((p) => p.id === 'post_1')!.comments;

    expect(comments[comments.length - 1]).toMatchObject({
      pseudo: store().user.pseudo,
      text: 'Je suis d’accord avec theo.',
    });
  });
});

describe('fiche de lecture scolaire', () => {
  it('marque une rubrique comme faite dès qu’elle est remplie', () => {
    store().updateStudySection('book_rouge', 'themes', 'Ambition, hypocrisie sociale, énergie.');
    const section = store()
      .books.find((b) => b.id === 'book_rouge')!
      .studySheet.find((s) => s.key === 'themes')!;

    expect(section.done).toBe(true);
  });

  it('repasse la rubrique à compléter quand on la vide', () => {
    store().updateStudySection('book_rouge', 'auteur', '   ');
    const section = store()
      .books.find((b) => b.id === 'book_rouge')!
      .studySheet.find((s) => s.key === 'auteur')!;

    expect(section.done).toBe(false);
  });
});

describe('enseignements', () => {
  it('ajoute un enseignement en le débarrassant des espaces', () => {
    store().addLesson('book_atelier', '  Commencer petit.  ');
    expect(store().books.find((b) => b.id === 'book_atelier')!.lessons).toContain('Commencer petit.');
  });

  it('retire l’enseignement au bon index', () => {
    const before = store().books.find((b) => b.id === 'book_essais')!.lessons;
    store().removeLesson('book_essais', 0);
    const after = store().books.find((b) => b.id === 'book_essais')!.lessons;

    expect(after).toHaveLength(before.length - 1);
    expect(after[0]).toBe(before[1]);
  });
});

describe('onboarding', () => {
  it('retient le pseudo et l’e-mail, et ouvre l’app', () => {
    store().completeOnboarding('  lina  ', 'lina@exemple.fr');
    expect(store().onboarded).toBe(true);
    expect(store().user.pseudo).toBe('lina');
    expect(store().user.email).toBe('lina@exemple.fr');
  });

  it('garde le pseudo existant si le champ est vide', () => {
    const before = store().user.pseudo;
    store().completeOnboarding('   ', null);
    expect(store().user.pseudo).toBe(before);
  });
});

describe('nouveau livre', () => {
  it('crée une histoire Wattpad avec l’alerte chapitres activée', () => {
    const book = store().addBook({
      kind: 'wattpad',
      title: 'Les Nuits de Bamako',
      author: '@amina_ecrit',
      wattpadUrl: 'https://www.wattpad.com/story/1',
      totalUnits: 24,
    });

    expect(book.notifyNewChapters).toBe(true);
    expect(book.status).toBe('a-lire');
    expect(book.studySheet).toHaveLength(5);
    expect(book.studySheet.every((s) => !s.done)).toBe(true);
  });

  it('n’active pas l’alerte chapitres pour un livre papier', () => {
    const book = store().addBook({ kind: 'papier', title: 'Essai', author: 'X' });
    expect(book.notifyNewChapters).toBe(false);
  });
});

describe('génération de flashcards', () => {
  it('ajoute les cartes fabriquées au paquet du livre', () => {
    const added = store().addFlashcards('book_rouge', [
      { question: 'Qui est l’abbé Pirard ?', answer: 'Le directeur du séminaire de Besançon.' },
    ]);

    expect(added).toBe(1);
    const deck = store().flashcards.filter((f) => f.bookId === 'book_rouge');
    expect(deck.some((f) => f.question === 'Qui est l’abbé Pirard ?')).toBe(true);
  });

  it('ouvre les cartes neuves au premier palier, à revoir tout de suite', () => {
    store().addFlashcards('book_rouge', [{ question: 'Nouvelle ?', answer: 'Oui.' }]);
    const card = store().flashcards.find((f) => f.question === 'Nouvelle ?')!;

    expect(card.box).toBe(0);
    expect(new Date(card.dueAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('ne duplique pas une question déjà présente, à la casse près', () => {
    const existing = store().flashcards.find((f) => f.bookId === 'book_rouge')!;
    const before = store().flashcards.length;

    const added = store().addFlashcards('book_rouge', [
      { question: `  ${existing.question.toUpperCase()}  `, answer: 'Autre formulation.' },
    ]);

    expect(added).toBe(0);
    expect(store().flashcards).toHaveLength(before);
  });

  it('n’écrase pas la progression des cartes déjà révisées', () => {
    store().reviewFlashcard('fc_1', true);
    const boxBefore = store().flashcards.find((f) => f.id === 'fc_1')!.box;

    store().addFlashcards('book_rouge', [{ question: 'Question inédite ?', answer: 'Réponse.' }]);

    expect(store().flashcards.find((f) => f.id === 'fc_1')!.box).toBe(boxBefore);
  });

  it('sépare les paquets par livre', () => {
    store().addFlashcards('book_essais', [{ question: 'Montaigne ?', answer: 'Essais.' }]);

    expect(store().flashcards.filter((f) => f.bookId === 'book_essais')).toHaveLength(1);
    expect(store().flashcards.filter((f) => f.bookId === 'book_rouge').length).toBeGreaterThan(1);
  });
});
