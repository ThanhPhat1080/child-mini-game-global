import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fetchActiveFindLevels: vi.fn(), push: vi.fn() }));

vi.mock('@/lib/find/levels', () => ({ fetchActiveFindLevels: h.fetchActiveFindLevels }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }), usePathname: () => '/games/find' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import FindLevels from '@/app/games/find/page';

const levels = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: `l${i + 1}`, image_path: 'seed/apple.svg',
  objects: [{ x: 0.5, y: 0.5, r: 0.06, word: 'apple', audio_path: null }, { x: 0.2, y: 0.3, r: 0.06, word: 'ball', audio_path: null }],
  active: true, sort_order: i + 1,
}));
const link = (n: number) => screen.getByRole('link', { name: `Play level ${n}` });

beforeEach(() => { h.fetchActiveFindLevels.mockReset(); h.push.mockReset(); });
afterEach(cleanup);

describe('Find It level select (F1)', () => {
  it('renders one link per level in order, with the picture as thumbnail', async () => {
    h.fetchActiveFindLevels.mockResolvedValue(levels(5));
    render(<FindLevels />);
    await screen.findByRole('link', { name: 'Play level 1' });
    expect(screen.getAllByRole('link', { name: /Play level/ })).toHaveLength(5);
    for (let n = 1; n <= 5; n++) {
      expect(link(n).getAttribute('href')).toBe(`/games/find/l${n}`);
      expect(link(n).getAttribute('data-level-link')).not.toBeNull();
      const img = link(n).querySelector('img') as HTMLImageElement;
      expect(img.getAttribute('alt')).toBe('');
      expect(img.getAttribute('src')).toBe('/seed/apple.svg');
    }
  });

  it('an empty list shows the friendly status, no links, no alert', async () => {
    h.fetchActiveFindLevels.mockResolvedValue([]);
    render(<FindLevels />);
    expect(await screen.findByRole('status', { name: 'New levels are coming soon' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('link', { name: /Play level/ })).toBeNull();
  });

  it('a load failure shows the same friendly status', async () => {
    h.fetchActiveFindLevels.mockRejectedValue(new Error('boom'));
    render(<FindLevels />);
    expect(await screen.findByRole('status', { name: 'New levels are coming soon' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('link', { name: /Play level/ })).toBeNull();
  });

  it('the first level is focused on arrival', async () => {
    h.fetchActiveFindLevels.mockResolvedValue(levels(6));
    render(<FindLevels />);
    await waitFor(() => expect(document.activeElement).toBe(link(1)));
  });

  it('arrows move focus in a 4-column grid', async () => {
    h.fetchActiveFindLevels.mockResolvedValue(levels(6));
    render(<FindLevels />);
    await waitFor(() => expect(document.activeElement).toBe(link(1)));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(link(2));
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(link(6));
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(link(2));
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(link(1));
  });

  it('Space clicks the focused link', async () => {
    h.fetchActiveFindLevels.mockResolvedValue(levels(3));
    render(<FindLevels />);
    await waitFor(() => expect(document.activeElement).toBe(link(1)));
    const click = vi.fn((e: Event) => e.preventDefault());
    link(1).addEventListener('click', click);
    fireEvent.keyDown(link(1), { key: ' ' });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('Esc goes to the game list; the back button links there', async () => {
    h.fetchActiveFindLevels.mockResolvedValue(levels(3));
    render(<FindLevels />);
    await screen.findByRole('link', { name: 'Play level 1' });
    expect(screen.getByRole('link', { name: 'Back to games' }).getAttribute('href')).toBe('/games');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games');
  });

  describe('help badge', () => {
    const badge = () => screen.getByRole('button', { name: 'What is Find It? Show how to play' });

    it('is a real button and also shows when the list is empty', async () => {
      h.fetchActiveFindLevels.mockResolvedValue([]);
      render(<FindLevels />);
      await screen.findByRole('status');
      expect(badge().tagName).toBe('BUTTON');
      expect(badge().textContent).toBe('Find It');
    });

    it('opens the dialog; arrows do not move focus; Esc closes it and returns focus to the badge', async () => {
      h.fetchActiveFindLevels.mockResolvedValue(levels(6));
      render(<FindLevels />);
      await waitFor(() => expect(document.activeElement).toBe(link(1)));
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      try {
        fireEvent.click(badge());
        expect(screen.getByRole('dialog', { name: 'How to play Find It' })).toBeTruthy();
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(document.activeElement).not.toBe(link(2));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        vi.runAllTimers();
        expect(document.activeElement).toBe(badge());
        expect(h.push).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
