import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fetchActiveLevels: vi.fn(), push: vi.fn() }));

vi.mock('@/lib/spot/levels', () => ({ fetchActiveLevels: h.fetchActiveLevels }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }), usePathname: () => '/games/spot' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import SpotLevels from '@/app/games/spot/page';

const levels = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: `l${i + 1}`, image_a_path: `seed/spot/garden-a.svg`, image_b_path: 'seed/spot/garden-b.svg',
  differences: [{ x: 0.5, y: 0.5, r: 0.06 }], active: true, sort_order: i + 1,
}));
const link = (n: number) => screen.getByRole('link', { name: `Play level ${n}` });

beforeEach(() => { h.fetchActiveLevels.mockReset(); h.push.mockReset(); });
afterEach(cleanup);

describe('Spot level select (S1)', () => {
  it('renders one link per level with picture A (empty alt) and the level number label', async () => {
    h.fetchActiveLevels.mockResolvedValue(levels(5));
    render(<SpotLevels />);
    await screen.findByRole('link', { name: 'Play level 1' });
    expect(screen.getAllByRole('link', { name: /Play level/ })).toHaveLength(5);
    for (let n = 1; n <= 5; n++) {
      expect(link(n).getAttribute('href')).toBe(`/games/spot/l${n}`);
      const img = link(n).querySelector('img') as HTMLImageElement;
      expect(img.getAttribute('alt')).toBe('');
      expect(img.getAttribute('src')).toBe('/seed/spot/garden-a.svg');
    }
  });

  it('an empty list shows the friendly status, no links, no alert', async () => {
    h.fetchActiveLevels.mockResolvedValue([]);
    render(<SpotLevels />);
    const s = await screen.findByRole('status', { name: 'New levels are coming soon' });
    expect(s).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('link', { name: /Play level/ })).toBeNull();
  });

  it('a load failure shows the same friendly status', async () => {
    h.fetchActiveLevels.mockRejectedValue(new Error('boom'));
    render(<SpotLevels />);
    expect(await screen.findByRole('status', { name: 'New levels are coming soon' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('link', { name: /Play level/ })).toBeNull();
  });

  it('the first level is focused on arrival', async () => {
    h.fetchActiveLevels.mockResolvedValue(levels(6));
    render(<SpotLevels />);
    await waitFor(() => expect(document.activeElement).toBe(link(1)));
  });

  it('arrows move focus in a 4-column grid', async () => {
    h.fetchActiveLevels.mockResolvedValue(levels(6));
    render(<SpotLevels />);
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
    h.fetchActiveLevels.mockResolvedValue(levels(3));
    render(<SpotLevels />);
    await waitFor(() => expect(document.activeElement).toBe(link(1)));
    const click = vi.fn((e: Event) => e.preventDefault());
    link(1).addEventListener('click', click);
    fireEvent.keyDown(link(1), { key: ' ' });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('Esc goes to the game list; the back button links there', async () => {
    h.fetchActiveLevels.mockResolvedValue(levels(3));
    render(<SpotLevels />);
    await screen.findByRole('link', { name: 'Play level 1' });
    expect(screen.getByRole('link', { name: 'Back to games' }).getAttribute('href')).toBe('/games');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games');
  });

  describe('help badge', () => {
    const badge = () => screen.getByRole('button', { name: 'What is Spot the Differences? Show how to play' });

    it('is a real button and also shows when the list is empty', async () => {
      h.fetchActiveLevels.mockResolvedValue([]);
      render(<SpotLevels />);
      await screen.findByRole('status');
      expect(badge().tagName).toBe('BUTTON');
      expect(badge().textContent).toBe('Spot the Differences');
    });

    it('opens the dialog; arrows do not move focus; Esc closes it and returns focus to the badge', async () => {
      h.fetchActiveLevels.mockResolvedValue(levels(6));
      render(<SpotLevels />);
      await waitFor(() => expect(document.activeElement).toBe(link(1)));
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      try {
        fireEvent.click(badge());
        expect(screen.getByRole('dialog', { name: 'How to play Spot the Differences' })).toBeTruthy();
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
