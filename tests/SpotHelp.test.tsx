import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import { SpotHelp } from '@/components/SpotHelp';

afterEach(cleanup);

describe('SpotHelp', () => {
  it('is a dialog named "How to play Spot the Differences" with 3 steps', () => {
    render(<SpotHelp onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'How to play Spot the Differences' });
    expect(dialog.querySelectorAll('h2')).toHaveLength(3);
    expect(within(dialog).getAllByRole('button', { name: /Go to step/ })).toHaveLength(3);
  });

  it('the last step links to /games/spot by default', () => {
    render(<SpotHelp onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.getByRole('link', { name: 'Play Spot the Differences' }).getAttribute('href')).toBe('/games/spot');
  });

  it('with playHref null the last button only closes', () => {
    const onClose = vi.fn();
    render(<SpotHelp playHref={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.queryByRole('link', { name: 'Play Spot the Differences' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play Spot the Differences' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
