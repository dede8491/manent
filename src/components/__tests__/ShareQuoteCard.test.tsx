import { render, screen } from '@testing-library/react-native';

import { ShareQuoteCard } from '@/components/ShareQuoteCard';
import { quoteCardStyles } from '@/theme';

const base = {
  text: 'On ne voit bien qu’avec le cœur.',
  locator: 72,
  locatorLabel: 'PAGE',
  bookTitle: 'Le Petit Prince',
  bookAuthor: 'Antoine de Saint-Exupéry',
  format: 'post' as const,
  width: 320,
};

describe('ShareQuoteCard', () => {
  it('porte le filigrane sur le plan gratuit', async () => {
    await render(<ShareQuoteCard {...base} styleKey="encre" watermark />);
    expect(screen.getByText('capturé avec Manent')).toBeTruthy();
  });

  it('retire le filigrane en Premium', async () => {
    await render(<ShareQuoteCard {...base} styleKey="encre" watermark={false} />);
    expect(screen.queryByText('capturé avec Manent')).toBeNull();
  });

  it('applique le fond du style choisi', async () => {
    const { toJSON } = await render(
      <ShareQuoteCard {...base} styleKey="foret" watermark={false} />,
    );
    const root = toJSON() as unknown as { props: { style: Record<string, unknown>[] } };

    expect(root.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: quoteCardStyles.foret.bg }),
      ]),
    );
  });

  it('donne à la story un format 9:16', async () => {
    const { toJSON } = await render(
      <ShareQuoteCard {...base} styleKey="papier" format="story" watermark={false} />,
    );
    const root = toJSON() as unknown as { props: { style: Record<string, number>[] } };
    const box = root.props.style.find((s) => s.height !== undefined)!;

    expect(box.height).toBe(Math.round((320 * 16) / 9));
  });
});
