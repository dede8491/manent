import { render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import Capture from '@/../app/capture';
import { FREE_MONTHLY_CAPTURES, useStore } from '@/store/useStore';

// Les fabriques de `jest.mock` sont hissées : leurs variables doivent être
// préfixées par `mock` pour être accessibles.
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

const store = () => useStore.getState();

beforeEach(() => {
  mockParams = {};
  mockPush.mockClear();
  store().resetAll();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('écran de capture', () => {
  it('propose la photo et la photothèque', async () => {
    await render(<Capture />);

    expect(screen.getByText('Photographier la page')).toBeTruthy();
    expect(screen.getByText('Depuis mes photos')).toBeTruthy();
    // Les captures d'écran Wattpad passent par la photothèque.
    expect(screen.getByText('captures Wattpad incluses')).toBeTruthy();
  });

  it('annonce le quota restant du plan gratuit', async () => {
    await render(<Capture />);
    expect(screen.getByText(new RegExp(`${FREE_MONTHLY_CAPTURES} TRANSCRIPTIONS`, 'i'))).toBeTruthy();
  });

  it('n’affiche pas de quota en Premium', async () => {
    store().startPremium('annuel');
    await render(<Capture />);

    expect(screen.queryByText(/TRANSCRIPTION/i)).toBeNull();
  });

  it('applique la visibilité par défaut choisie dans les paramètres', async () => {
    store().updateUser({ defaultQuoteVisibility: 'publique' });
    await render(<Capture />);

    // Le segment « Publique » est sélectionné à l'ouverture.
    expect(
      screen.getByText(/Publiée avec le titre et l’auteur de l’œuvre/),
    ).toBeTruthy();
  });

  it('rappelle que la photo d’origine reste privée', async () => {
    await render(<Capture />);
    expect(screen.getByText(/droit de courte citation|reste privée|Visible de toi seule/)).toBeTruthy();
  });

  it('préselectionne le livre passé en paramètre', async () => {
    mockParams = { bookId: 'book_bamako' };
    await render(<Capture />);

    // Une histoire Wattpad se repère par chapitre, pas par page.
    expect(screen.getByText('NUMÉRO DE CHAPITRE')).toBeTruthy();
  });

  it('parle de page pour un livre papier', async () => {
    mockParams = { bookId: 'book_essais' };
    await render(<Capture />);

    expect(screen.getByText('NUMÉRO DE PAGE')).toBeTruthy();
  });

  it('enregistre une citation saisie à la main', async () => {
    const user = userEvent.setup();
    mockParams = { bookId: 'book_essais' };
    await render(<Capture />);

    const before = store().quotes.length;
    await user.type(
      screen.getByPlaceholderText('Écris ou colle ta citation ici…'),
      'Une phrase que je veux garder.',
    );
    await user.press(screen.getByText('Enregistrer la citation'));

    expect(store().quotes).toHaveLength(before + 1);
    expect(store().quotes[0]).toMatchObject({
      text: 'Une phrase que je veux garder.',
      bookId: 'book_essais',
      isPublic: false,
    });
  });

  it('inscrit la nouvelle citation dans l’outbox de synchronisation', async () => {
    const user = userEvent.setup();
    await render(<Capture />);

    await user.type(screen.getByPlaceholderText('Écris ou colle ta citation ici…'), 'À garder.');
    await user.press(screen.getByText('Enregistrer la citation'));

    const queued = store().outbox.filter((o) => o.entity === 'quotes');
    expect(queued).toHaveLength(1);
    expect(queued[0].op).toBe('upsert');
  });

  it('normalise les thèmes saisis librement', async () => {
    const user = userEvent.setup();
    await render(<Capture />);

    await user.type(screen.getByPlaceholderText('Écris ou colle ta citation ici…'), 'À garder.');
    await user.type(screen.getByPlaceholderText('résilience'), '#Développement Personnel');
    await user.press(screen.getByText('Ajouter'));
    await user.press(screen.getByText('Enregistrer la citation'));

    expect(store().quotes[0].themes).toEqual(['développement-personnel']);
  });

  it('refuse un numéro de page qui n’est pas un nombre', async () => {
    const user = userEvent.setup();
    mockParams = { bookId: 'book_essais' };
    await render(<Capture />);

    const before = store().quotes.length;
    await user.type(screen.getByPlaceholderText('Écris ou colle ta citation ici…'), 'À garder.');
    await user.type(screen.getByPlaceholderText('187'), 'cent');
    await user.press(screen.getByText('Enregistrer la citation'));

    expect(Alert.alert).toHaveBeenCalledWith('Numéro invalide', expect.any(String));
    expect(store().quotes).toHaveLength(before);
  });

  it('propose de mettre à jour la progression quand la page capturée la dépasse', async () => {
    const user = userEvent.setup();
    mockParams = { bookId: 'book_atelier' }; // progression : p. 96
    await render(<Capture />);

    await user.type(screen.getByPlaceholderText('Écris ou colle ta citation ici…'), 'À garder.');
    await user.type(screen.getByPlaceholderText('187'), '210');
    await user.press(screen.getByText('Enregistrer la citation'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Mettre à jour ta progression ?',
      expect.stringContaining('210'),
      expect.any(Array),
    );
  });

  it('ne propose rien quand la page capturée est en deçà de la progression', async () => {
    const user = userEvent.setup();
    mockParams = { bookId: 'book_atelier' };
    await render(<Capture />);

    await user.type(screen.getByPlaceholderText('Écris ou colle ta citation ici…'), 'À garder.');
    await user.type(screen.getByPlaceholderText('187'), '20');
    await user.press(screen.getByText('Enregistrer la citation'));

    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
