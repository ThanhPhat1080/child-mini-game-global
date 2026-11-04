import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import { FindHelp } from '@/components/FindHelp';

afterEach(cleanup);

describe('FindHelp', () => {
  it('is a dialog named "How to play Find It" with 3 steps', () => {
    render(<FindHelp onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'How to play Find It' });
    expect(dialog.querySelectorAll('h2')).toHaveLength(3);
    expect(within(dialog).getAllByRole('button', { name: /Go to step/ })).toHaveLength(3);
  });

  it('the first step is titled "What is Find It?" and the last "Find them all"', () => {
    render(<FindHelp onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'How to play Find It' });
    const titles = Array.from(dialog.querySelectorAll('h2')).map((h) => h.textContent);
    expect(titles[0]).toBe('What is Find It?');
    expect(titles[1]).toBe('Listen and look');
    expect(titles[2]).toBe('Find them all');
  });

  it('the last step links to /games/find by default', () => {
    render(<FindHelp onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.getByRole('link', { name: 'Play Find It' }).getAttribute('href')).toBe('/games/find');
  });

  it('with playHref null the last button only closes', () => {
    const onClose = vi.fn();
    render(<FindHelp playHref={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.queryByRole('link', { name: 'Play Find It' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play Find It' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc closes the popup', () => {
    const onClose = vi.fn();
    render(<FindHelp onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
