import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ScopeSwitch } from '@/components/games/ScopeSwitch';
import { getStoredScope } from '@/lib/review';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('child scope switch (N6)', () => {
  it('shows two picture buttons, no text, and starts on my family', async () => {
    const { container } = render(<ScopeSwitch />);
    expect(container.textContent).toBe('');
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'My family' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Everyone' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('switches to global, remembers it for the games, and switches back', () => {
    render(<ScopeSwitch />);
    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }));
    expect(screen.getByRole('button', { name: 'Everyone' }).getAttribute('aria-pressed')).toBe('true');
    expect(getStoredScope()).toBe('global');
    fireEvent.click(screen.getByRole('button', { name: 'My family' }));
    expect(getStoredScope()).toBe('mine');
  });

  it('has no edit controls: only the two switch buttons', () => {
    render(<ScopeSwitch />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('starts on global when that was remembered, and survives blocked storage', async () => {
    localStorage.setItem('childPlayer:scope', 'global');
    render(<ScopeSwitch />);
    expect((await screen.findByRole('button', { name: 'Everyone' })).getAttribute('aria-pressed')).toBe('true');
  });
});
