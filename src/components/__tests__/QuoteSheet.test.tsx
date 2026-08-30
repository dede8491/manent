import { render, screen } from '@testing-library/react-native';

import { QuoteSheet } from '@/components/QuoteSheet';
import { colors } from '@/theme';

const base = {
  text: 'Il faut avoir un peu de folie, qui ne veut avoir plus de sottise.',
  locator: 187,
  bookTitle: 'Essais, livre I',
  bookAuthor: 'Michel de Montaigne',
};

describe('QuoteSheet', () => {
  it('annonce le repère PAGE pour un livre papier', async () => {
    await render(<QuoteSheet {...base} />);

    expect(screen.getByText('PAGE')).toBeTruthy();
    expect(screen.getByText('187')).toBeTruthy();
  });

  it('bascule sur CHAP. en orange pour une histoire Wattpad', async () => {
    await render(<QuoteSheet {...base} locator={12} bookKind="wattpad" />);

    const label = screen.getByText('CHAP.');
    expect(label).toBeTruthy();
    expect(screen.queryByText('PAGE')).toBeNull();
    expect(label).toHaveStyle({ color: colors.wattpad });
  });

  it('masque le repère quand la citation n’a pas de numéro', async () => {
    await render(<QuoteSheet {...base} locator={null} />);

    expect(screen.queryByText('PAGE')).toBeNull();
    expect(screen.queryByText('CHAP.')).toBeNull();
  });

  it('rappelle le titre et l’auteur, comme l’exige la courte citation', async () => {
    await render(<QuoteSheet {...base} />);
    expect(screen.getByText('Essais, livre I · Michel de Montaigne')).toBeTruthy();
  });

  it('signale une citation privée et n’affiche que trois thèmes', async () => {
    await render(
      <QuoteSheet {...base} isPrivate themes={['confiance', 'résilience', 'foi', 'amour']} />,
    );

    expect(screen.getByText('🔒 privée')).toBeTruthy();
    expect(screen.getByText('#confiance')).toBeTruthy();
    expect(screen.queryByText('#amour')).toBeNull();
  });

  it('crédite la personne qui a épinglé la citation', async () => {
    await render(
      <QuoteSheet {...base} byline={{ pseudo: 'lina', avatarEmoji: '📗', prefix: 'épinglée par' }} />,
    );
    expect(screen.getByText(/épinglée par/)).toBeTruthy();
  });
});
