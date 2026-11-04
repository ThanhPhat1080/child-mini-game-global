import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import { ListenHelp } from '@/components/ListenHelp';

afterEach(cleanup);

describe('ListenHelp', () => {
  it('is a dialog named "How to play Listen & Pick" with 3 steps', () => {
    render(<ListenHelp onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'How to play Listen & Pick' });
    expect(dialog.querySelectorAll('section')).toHaveLength(3);
    expect(within(dialog).getAllByRole('button', { name: /Go to step/ })).toHaveLength(3);
  });

  it('with playHref null the last button only closes', () => {
    const onClose = vi.fn();
    render(<ListenHelp playHref={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.queryByRole('link', { name: 'Play Listen & Pick' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play Listen & Pick' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc closes it', () => {
    const onClose = vi.fn();
    render(<ListenHelp onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
