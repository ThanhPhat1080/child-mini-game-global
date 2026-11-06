import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import { CaroHelp } from '@/components/CaroHelp';

afterEach(cleanup);

describe('CaroHelp', () => {
  it('is a dialog named "How to play Caro" with 3 steps', () => {
    render(<CaroHelp onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'How to play Caro' });
    expect(dialog.querySelectorAll('h2')).toHaveLength(3);
    expect(within(dialog).getAllByRole('button', { name: /Go to step/ })).toHaveLength(3);
  });

  it('the steps are titled What is Caro?, Take turns and Five in a row!', () => {
    render(<CaroHelp onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'How to play Caro' });
    const titles = Array.from(dialog.querySelectorAll('h2')).map((h) => h.textContent);
    expect(titles).toEqual(['What is Caro?', 'Take turns', 'Five in a row!']);
  });

  it('the last step links to /games/caro by default', () => {
    render(<CaroHelp onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.getByRole('link', { name: 'Play Caro' }).getAttribute('href')).toBe('/games/caro');
  });

  it('with playHref null the last button only closes', () => {
    const onClose = vi.fn();
    render(<CaroHelp playHref={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.queryByRole('link', { name: 'Play Caro' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play Caro' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc closes the popup', () => {
    const onClose = vi.fn();
    render(<CaroHelp onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
