import { render, screen, userEvent } from '@testing-library/react-native';

import Ajouter from '@/../app/ajouter';
import { useStore } from '@/store/useStore';

const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn().mockResolvedValue({ granted: true })],
}));

const store = () => useStore.getState();

const volume = {
  volumeInfo: {
    title: 'Des lignes de faille',
    authors: ['Éloi Ravenne'],
    pageCount: 342,
    publishedDate: '2025',
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9782000000024' }],
  },
};

beforeEach(() => {
  mockParams = {};
  mockReplace.mockClear();
  store().resetAll();
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ items: [volume] }),
  }) as unknown as typeof fetch;
});

afterEach(() => jest.restoreAllMocks());

describe('écran d’ajout d’une lecture', () => {
  it('ouvre sur le scan ISBN', async () => {
    await render(<Ajouter />);
    expect(screen.getByText('Scanner le code-barres')).toBeTruthy();
  });

  it('respecte la méthode passée en paramètre', async () => {
    mockParams = { methode: 'wattpad' };
    await render(<Ajouter />);

    expect(screen.getByPlaceholderText('https://www.wattpad.com/story/…')).toBeTruthy();
  });

  it('ajoute un livre trouvé par titre, avec ses métadonnées', async () => {
    const user = userEvent.setup();
    await render(<Ajouter />);

    await user.press(screen.getByText('🔍 Titre'));
    await user.type(screen.getByPlaceholderText('Le Rouge et le Noir'), 'lignes de faille');
    await user.press(screen.getByText('Rechercher'));

    await user.press(await screen.findByText('342 pages'));
    await user.press(screen.getByText('Ajouter à ma bibliothèque'));

    const added = store().books[0];
    expect(added).toMatchObject({
      title: 'Des lignes de faille',
      author: 'Éloi Ravenne',
      totalUnits: 342,
      isbn: '9782000000024',
      kind: 'papier',
      status: 'en-cours',
    });
    expect(mockReplace).toHaveBeenCalledWith(`/livre/${added.id}`);
  });

  it('inscrit le nouveau livre dans l’outbox', async () => {
    const user = userEvent.setup();
    await render(<Ajouter />);

    await user.press(screen.getByText('🔍 Titre'));
    await user.type(screen.getByPlaceholderText('Le Rouge et le Noir'), 'lignes');
    await user.press(screen.getByText('Rechercher'));
    await user.press(await screen.findByText('342 pages'));
    await user.press(screen.getByText('Ajouter à ma bibliothèque'));

    expect(store().outbox.filter((o) => o.entity === 'books')).toHaveLength(1);
  });

  it('bascule la lecture en mode études avec niveau et date d’examen', async () => {
    const user = userEvent.setup();
    await render(<Ajouter />);

    await user.press(screen.getByText('🔍 Titre'));
    await user.type(screen.getByPlaceholderText('Le Rouge et le Noir'), 'lignes');
    await user.press(screen.getByText('Rechercher'));
    await user.press(await screen.findByText('342 pages'));

    await user.press(screen.getByText('🎓 Pour mes études'));
    await user.type(screen.getByPlaceholderText('Programme 1re'), 'Programme Terminale');
    await user.type(screen.getByPlaceholderText('2026-06-12'), '2026-06-18');
    await user.press(screen.getByText('Ajouter à ma bibliothèque'));

    expect(store().books[0]).toMatchObject({
      kind: 'etude',
      schoolLevel: 'Programme Terminale',
      examDate: '2026-06-18',
    });
    // Une fiche neuve a ses cinq rubriques, toutes à compléter.
    expect(store().books[0].studySheet).toHaveLength(5);
  });

  it('importe une histoire Wattpad depuis son lien', async () => {
    const user = userEvent.setup();
    mockParams = { methode: 'wattpad' };
    await render(<Ajouter />);

    await user.type(
      screen.getByPlaceholderText('https://www.wattpad.com/story/…'),
      'https://www.wattpad.com/story/123456-les-nuits-de-bamako',
    );
    await user.press(screen.getByText("Importer l'histoire"));
    await user.press(await screen.findByText('Ajouter à ma bibliothèque'));

    expect(store().books[0]).toMatchObject({
      kind: 'wattpad',
      title: 'Les Nuits De Bamako',
      wattpadUrl: 'https://www.wattpad.com/story/123456-les-nuits-de-bamako',
      notifyNewChapters: true,
    });
  });

  it('ne propose pas le mode études pour une histoire Wattpad', async () => {
    const user = userEvent.setup();
    mockParams = { methode: 'wattpad' };
    await render(<Ajouter />);

    await user.type(
      screen.getByPlaceholderText('https://www.wattpad.com/story/…'),
      'https://www.wattpad.com/story/1-mon-histoire',
    );
    await user.press(screen.getByText("Importer l'histoire"));
    await screen.findByText('Ajouter à ma bibliothèque');

    expect(screen.queryByText('🎓 Pour mes études')).toBeNull();
  });
});
