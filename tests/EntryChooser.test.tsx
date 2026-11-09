// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EntryChooser } from '@/components/play/EntryChooser';

// GU1: the chooser on /play/sign-in: Log in (the parent form) or Guest (the visitor setup).
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

afterEach(cleanup);

describe('EntryChooser (GU1)', () => {
  it('shows the Log in and Play as guest cards', () => {
    render(<EntryChooser onLogin={() => {}} />);
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Play as guest' })).toBeTruthy();
  });

  it('the Guest card goes to /play/guest', () => {
    render(<EntryChooser onLogin={() => {}} />);
    expect(screen.getByRole('link', { name: 'Play as guest' }).getAttribute('href')).toBe('/play/guest');
  });

  it('ArrowRight moves focus from Log in to Guest, ArrowLeft back', () => {
    render(<EntryChooser onLogin={() => {}} />);
    const login = screen.getByRole('button', { name: 'Log in' });
    const guest = screen.getByRole('link', { name: 'Play as guest' });
    login.focus();
    fireEvent.keyDown(login, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(guest);
    fireEvent.keyDown(guest, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(login);
  });

  it('Enter on Log in calls onLogin', () => {
    const onLogin = vi.fn();
    render(<EntryChooser onLogin={onLogin} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Log in' }), { key: 'Enter' });
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('a click on Log in calls onLogin', () => {
    const onLogin = vi.fn();
    render(<EntryChooser onLogin={onLogin} />);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});
