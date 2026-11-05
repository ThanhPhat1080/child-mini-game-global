import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Child } from '@/lib/children';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  list: vi.fn(),
  session: vi.fn(),
  signOut: vi.fn(),
  setActive: vi.fn(),
  clear: vi.fn(),
  router: {} as Record<string, unknown>,
}));
h.router = { push: h.push, replace: h.replace, refresh: h.refresh };

vi.mock('next/navigation', () => ({ useRouter: () => h.router }));
vi.mock('@/lib/children', () => ({ listMyChildren: h.list }));
vi.mock('@/lib/childSession', () => ({ setActiveChild: h.setActive, clearActiveChild: h.clear }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: { getSession: h.session, signOut: h.signOut } }) }));

import Play from '@/app/play/page';

const kid = (n: number, over: Partial<Child> = {}): Child => ({
  id: `c${n}`, parent_id: 'p1', child_name: `kid${n}`, display_name: `Kid ${n}`, avatar_path: null,
  gender: n % 2 ? 'female' : 'male', age_band: '2-5', pin: 'ab12', ...over,
});

beforeEach(() => {
  [h.push, h.replace, h.refresh, h.list, h.session, h.signOut, h.setActive, h.clear].forEach((f) => f.mockReset());
  h.session.mockResolvedValue({ data: { session: { user: { id: 'p1' } } } });
  h.list.mockResolvedValue([kid(1), kid(2, { avatar_path: 'a/b.png' })]);
  h.signOut.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const cardNames = () => screen.getAllByRole('button').filter((b) => b.hasAttribute('data-pick-card') || b.getAttribute('aria-label') === 'Parent configuration').map((b) => b.getAttribute('aria-label'));
const boxes = () => screen.getAllByRole('textbox') as HTMLInputElement[];
const type = (text: string) => [...text].forEach((c, i) => fireEvent.change(boxes()[i], { target: { value: c } }));
async function ready() {
  render(<Play />);
  await screen.findByRole('button', { name: 'Parent configuration' });
}
const answer = (v: string) => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: v } });
  fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
};

describe('Play picker (K7-K12, KU9-KU12)', () => {
  it('shows a card per child in the gender colors, then Parent Configuration last', async () => {
    await ready();
    expect(cardNames()).toEqual(['Kid 1', 'Kid 2', 'Parent configuration']);
    const girl = screen.getByRole('button', { name: 'Kid 1' });
    const boy = screen.getByRole('button', { name: 'Kid 2' });
    expect(girl.getAttribute('data-gender')).toBe('female');
    expect(boy.getAttribute('data-gender')).toBe('male');
    expect(girl.textContent).toContain('Kid 1');
    expect(boy.querySelector('img')?.getAttribute('src')).toContain('/media/a/b.png');
    expect(girl.textContent).toContain('K'); // initial fallback
  });

  it('lists only the signed-in parent, never other families (Super Admin)', async () => {
    h.session.mockResolvedValue({ data: { session: { user: { id: 'admin1' } } } });
    h.list.mockResolvedValue([kid(1), kid(2, { parent_id: 'other' })]);
    await ready();
    expect(cardNames()).toEqual(['Parent configuration']);
    expect(h.list).toHaveBeenCalledWith(undefined, 'admin1');
  });

  it('still shows Parent Configuration with zero children', async () => {
    h.list.mockResolvedValue([]);
    await ready();
    expect(cardNames()).toEqual(['Parent configuration']);
  });

  it('without a session goes to /play/sign-in', async () => {
    h.session.mockResolvedValue({ data: { session: null } });
    render(<Play />);
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/play/sign-in'));
    expect(h.list).not.toHaveBeenCalled();
  });

  it('shows a calm retry state when the list fails, and retry reloads', async () => {
    h.list.mockRejectedValueOnce(new Error('boom'));
    render(<Play />);
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(document.body.textContent).not.toMatch(/boom/);
    fireEvent.click(retry);
    await screen.findByRole('button', { name: 'Kid 1' });
    expect(h.replace).not.toHaveBeenCalled();
  });

  it('tapping a card shows the PIN step; Esc leaves it', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Kid 1' }));
    expect(boxes()).toHaveLength(4);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(h.setActive).not.toHaveBeenCalled();
  });

  it('a wrong PIN shakes and stays', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Kid 1' }));
    type('0000');
    expect(boxes()).toHaveLength(4);
    expect(h.setActive).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('the right PIN stores the child and goes to the welcome screen', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Kid 2' }));
    type('ab12');
    expect(h.setActive).toHaveBeenCalledWith('c2');
    expect(h.push).toHaveBeenCalledWith('/');
  });

  it('Left/Right move across the cards, Enter picks', async () => {
    await ready();
    const [a, b, cfg] = [screen.getByRole('button', { name: 'Kid 1' }), screen.getByRole('button', { name: 'Kid 2' }), screen.getByRole('button', { name: 'Parent configuration' })];
    expect(document.activeElement).toBe(a);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(b);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cfg);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(b);
    fireEvent.keyDown(b, { key: 'Enter' });
    expect(boxes()).toHaveLength(4);
  });

  describe('Parent configuration', () => {
    it('opens the grown-up check; a wrong sum shows a new sum and stays', async () => {
      await ready();
      fireEvent.click(screen.getByRole('button', { name: 'Parent configuration' }));
      expect(screen.getByRole('dialog')).toBeTruthy();
      answer('1');
      expect(h.push).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByTestId('adult-question')).toBeTruthy();
    });

    it('the right sum goes to /admin and sets no cookie', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await ready();
      fireEvent.click(screen.getByRole('button', { name: 'Parent configuration' }));
      answer('12');
      expect(h.push).toHaveBeenCalledWith('/admin');
      expect(h.setActive).not.toHaveBeenCalled();
      expect(h.clear).not.toHaveBeenCalled();
    });

    it('Esc closes the check', async () => {
      await ready();
      fireEvent.click(screen.getByRole('button', { name: 'Parent configuration' }));
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(h.push).not.toHaveBeenCalled();
    });
  });

  describe('back to sign-in corner button', () => {
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Sign out (grown-ups)' }));

    it('needs the check: a wrong sum signs nothing out', async () => {
      await ready();
      open();
      answer('1');
      expect(h.signOut).not.toHaveBeenCalled();
      expect(h.clear).not.toHaveBeenCalled();
    });

    it('the right sum signs out, clears the cookie and goes to /admin/sign-in', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await ready();
      open();
      answer('12');
      await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/sign-in'));
      expect(h.signOut).toHaveBeenCalledTimes(1);
      expect(h.clear).toHaveBeenCalledTimes(1);
    });
  });
});
