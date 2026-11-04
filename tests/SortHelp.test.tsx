import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import { SortHelp } from '@/components/SortHelp';

afterEach(cleanup);

describe('SortHelp', () => {
  it('is a dialog named "How to play Sort It" with 3 steps', () => {
    render(<SortHelp onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'How to play Sort It' });
    expect(dialog.querySelectorAll('section')).toHaveLength(3);
    expect(within(dialog).getAllByRole('button', { name: /Go to step/ })).toHaveLength(3);
  });

  it('the last step links to the game by default', () => {
    render(<SortHelp onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.getByRole('link', { name: 'Play Sort It' }).getAttribute('href')).toBe('/games/sort');
  });

  it('with playHref null the last button only closes', () => {
    const onClose = vi.fn();
    render(<SortHelp playHref={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.queryByRole('link', { name: 'Play Sort It' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play Sort It' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc closes it', () => {
    const onClose = vi.fn();
    render(<SortHelp onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
