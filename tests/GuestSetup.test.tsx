// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// GU2-GU4: the visitor setup on /play/guest: Boy or Girl, then name and age, then OK to Welcome.
const h = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, replace: h.push, refresh: vi.fn() }) }));

import GuestSetup from '@/app/play/guest/page';
import { getVisitor, clearVisitor } from '@/lib/visitor';

beforeEach(() => {
  h.push.mockReset();
  localStorage.clear();
  clearVisitor();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  clearVisitor();
});

const pickGirl = () => fireEvent.click(screen.getByRole('button', { name: 'Girl' }));

describe('guest setup (GU2-GU4)', () => {
  it('step 1 shows the Who are you? title and the Boy and Girl cards', () => {
    render(<GuestSetup />);
    expect(screen.getByText('Who are you?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Boy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Girl' })).toBeTruthy();
  });

  it('Left and Right move between Boy and Girl, Enter picks', () => {
    render(<GuestSetup />);
    const boy = screen.getByRole('button', { name: 'Boy' });
    const girl = screen.getByRole('button', { name: 'Girl' });
    boy.focus();
    fireEvent.keyDown(boy, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(girl);
    fireEvent.keyDown(girl, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(boy);
  });

  it('picking Girl shows the name field, age 2-5 pressed, and OK disabled until the name is valid', async () => {
    render(<GuestSetup />);
    pickGirl();
    const name = await screen.findByLabelText("Child's name");
    expect(screen.getByRole('button', { name: '2-5' }).getAttribute('aria-pressed')).toBe('true');
    const ok = screen.getByRole('button', { name: 'Play now!' }) as HTMLButtonElement;
    expect(ok.disabled).toBe(true);
    fireEvent.change(name, { target: { value: '   ' } });
    expect(ok.disabled).toBe(true);
    fireEvent.change(name, { target: { value: 'Mai' } });
    expect(ok.disabled).toBe(false);
  });

  it('a 21-character name keeps OK disabled', async () => {
    render(<GuestSetup />);
    pickGirl();
    const name = await screen.findByLabelText("Child's name");
    fireEvent.change(name, { target: { value: 'a'.repeat(21) } });
    expect((screen.getByRole('button', { name: 'Play now!' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Enter in the name field saves the visitor and goes to Welcome', async () => {
    render(<GuestSetup />);
    pickGirl();
    const name = await screen.findByLabelText("Child's name");
    fireEvent.change(name, { target: { value: 'Mai' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    fireEvent.submit(name.closest('form')!);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/'));
    expect(getVisitor()).toEqual({ name: 'Mai', gender: 'female', ageBand: '2-5' });
  });

  it('OK with a 5-10 age saves that band', async () => {
    render(<GuestSetup />);
    pickGirl();
    const name = await screen.findByLabelText("Child's name");
    fireEvent.change(name, { target: { value: 'Mai' } });
    fireEvent.click(screen.getByRole('button', { name: '5-10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play now!' }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/'));
    expect(getVisitor()?.ageBand).toBe('5-10');
  });

  it('the X on the details goes back to Boy or Girl and keeps the typed name', async () => {
    render(<GuestSetup />);
    pickGirl();
    const name = await screen.findByLabelText("Child's name");
    fireEvent.change(name, { target: { value: 'Mai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('button', { name: 'Boy' })).toBeTruthy();
    pickGirl();
    expect(((await screen.findByLabelText("Child's name")) as HTMLInputElement).value).toBe('Mai');
  });

  it('the top-left back on step 1 is the in-game Back link to the sign-in chooser', () => {
    render(<GuestSetup />);
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/play/sign-in');
  });

  it('nothing is saved until OK', async () => {
    render(<GuestSetup />);
    pickGirl();
    const name = await screen.findByLabelText("Child's name");
    fireEvent.change(name, { target: { value: 'Mai' } });
    expect(getVisitor()).toBeNull();
  });
});
