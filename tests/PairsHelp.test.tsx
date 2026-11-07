import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import { PairsHelp } from '@/components/PairsHelp';

afterEach(cleanup);

describe('PairsHelp', () => {
  it('is a dialog named "How to play Puzzle Pairs" with 3 steps', () => {
    render(<PairsHelp onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'How to play Puzzle Pairs' });
    expect(dialog.querySelectorAll('section')).toHaveLength(3);
    expect(within(dialog).getAllByRole('button', { name: /Go to step/ })).toHaveLength(3);
  });

  it('the last step links to the game by default', () => {
    render(<PairsHelp onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.getByRole('link', { name: 'Play Puzzle Pairs' }).getAttribute('href')).toBe('/games/pairs');
  });

  it('with playHref null the last button only closes', () => {
    const onClose = vi.fn();
    render(<PairsHelp playHref={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.queryByRole('link', { name: 'Play Puzzle Pairs' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play Puzzle Pairs' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc closes it', () => {
    const onClose = vi.fn();
    render(<PairsHelp onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
