import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AdminLoading } from '@/components/admin/AdminLoading';

// The admin wait: the bundled fish over soft ripples, no visible "Loading" text (spec A30, A36).
afterEach(cleanup);

describe('AdminLoading', () => {
  it('shows the fish and announces the wait to a screen reader', () => {
    const { container } = render(<AdminLoading />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Loading…');
    expect(container.querySelector('img[src="/seed/fish.svg"]')).not.toBeNull();
  });

  it('hides the words from sighted users', () => {
    render(<AdminLoading />);
    const word = screen.getByText('Loading…');
    expect(word.className).toMatch(/srOnly/);
  });

  it('takes a custom screen reader label', () => {
    render(<AdminLoading label="Loading your profile…" />);
    expect(screen.getByRole('status').textContent).toBe('Loading your profile…');
  });
});
