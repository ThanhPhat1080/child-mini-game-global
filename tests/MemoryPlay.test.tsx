import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryCard } from '@/lib/memory/types';
import type { DeckTile, Level } from '@/lib/memory/deck';

const h = vi.hoisted(() => ({
  level: '12',
  fetchActiveCards: vi.fn(),
  sayWord: vi.fn(),
  stopWord: vi.fn(),
  flipTick: vi.fn(),
  chime: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  drawDeck: vi.fn(),
  settings: vi.fn(),
}));

vi.mock('@/lib/memory/cards', () => ({ fetchActiveCards: h.fetchActiveCards, sayWord: h.sayWord, stopWord: h.stopWord }));
vi.mock('@/lib/sfx', () => ({ flipTick: h.flipTick, chime: h.chime, applause: vi.fn(), speakKid: vi.fn(), playFile: vi.fn() }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: () => h.settings() }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('@/lib/memory/deck', async (orig) => ({ ...(await orig<typeof import('@/lib/memory/deck')>()), drawDeck: h.drawDeck }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ level: h.level }),
  useRouter: () => ({ push: h.push, replace: h.replace }),
  usePathname: () => `/games/memory/${h.level}`,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import MemoryPlay from '@/app/games/memory/[level]/page';
import { MISMATCH_MS, WIN_DELAY_MS } from '@/lib/memory/rules';
import { PRELOAD_MS } from '@/lib/memory/preload';

const cards = (n: number): MemoryCard[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, word: `word${i}`, image_path: `c${i}.svg`, audio_path: null, active: true }));

/** Fixed deck: c0..c(p-1), then c0..c(p-1) again. Tile i matches tile i + p; tiles 0 and 1 never match. */
const fixedDeck = (all: readonly MemoryCard[], level: Level): DeckTile[] => {
  const p = level / 2;
  const chosen = all.slice(0, p);
  return [...chosen.map((card) => ({ key: `${card.id}:0`, card })), ...chosen.map((card) => ({ key: `${card.id}:1`, card }))];
};

const tile = (n: number) => screen.getByRole('button', { name: `card ${n}` });
const tiles = () => Array.from(document.querySelectorAll<HTMLElement>('[data-tile]'));
const root = () => document.querySelector<HTMLElement>('[data-memory-play]')!;
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

async function ready(level = '12', pool = cards(15)) {
  h.level = level;
  h.fetchActiveCards.mockResolvedValue(pool);
  const r = render(<MemoryPlay />);
  await advance(PRELOAD_MS + 10);
  return r;
}

beforeEach(() => {
  vi.useFakeTimers();
  for (const f of [h.fetchActiveCards, h.sayWord, h.stopWord, h.flipTick, h.chime, h.push, h.replace, h.drawDeck, h.settings]) f.mockReset();
  h.settings.mockResolvedValue({ child_name: 'Mi', complete_path: null });
  h.drawDeck.mockImplementation(fixedDeck);
  h.sayWord.mockImplementation((_card: MemoryCard, onEnd?: () => void) => onEnd?.()); // a word that finishes at once
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Memory play screen (M2-M6, M8-M10)', () => {
  it('an invalid level goes back to the level screen', async () => {
    await ready('13');
    expect(h.replace).toHaveBeenCalledWith('/games/memory');
    expect(tiles()).toHaveLength(0);
  });

  it('too few active cards for the level: friendly status screen, no grid', async () => {
    await ready('30', cards(10));
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(tiles()).toHaveLength(0);
  });

  it('a fetch error: a retry screen, no grid', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.level = '12';
    h.fetchActiveCards.mockRejectedValue(new Error('boom'));
    render(<MemoryPlay />);
    await advance(PRELOAD_MS + 10);
    expect(screen.getByRole('alert', { name: /went wrong/ })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(tiles()).toHaveLength(0);
  });

  it.each([12, 16, 20, 24, 30])('level %i shows that many tile buttons, drawn once', async (n) => {
    await ready(String(n));
    expect(tiles()).toHaveLength(n);
    expect(tiles().every((t) => t.tagName === 'BUTTON')).toBe(true);
    expect(h.drawDeck).toHaveBeenCalledTimes(1);
  });

  it.each([[12, 4], [16, 4], [20, 5], [24, 6], [30, 6]])('level %i lays out %i columns of square tiles', async (n, cols) => {
    await ready(String(n));
    const grid = tiles()[0].parentElement as HTMLElement;
    expect(grid.style.gridTemplateColumns).toMatch(new RegExp(`^repeat\\(${cols}, `));
    const px = (t: HTMLElement) => parseInt(t.style.width, 10);
    expect(px(tiles()[0])).toBeGreaterThan(100);
    expect(tiles()[0].style.height).toBe(tiles()[0].style.width);
  });

  it('Down moves by 5 on the 20-card grid and by 4 on the 16-card grid', async () => {
    await ready('20');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tile(6));
    cleanup();
    await ready('16');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tile(5));
  });

  it('the first press ticks and shows the picture', async () => {
    await ready();
    expect(tile(1).querySelector('img')).toBeNull();
    expect(tile(1).getAttribute('data-face-up')).toBe('false');
    fireEvent.click(tile(1));
    expect(h.flipTick).toHaveBeenCalledTimes(1);
    expect(tile(1).getAttribute('data-face-up')).toBe('true');
    expect(tile(1).getAttribute('aria-pressed')).toBe('true');
    expect(new URL(tile(1).querySelector('img')!.src).pathname).toBe('/media/c0.svg'); // next/image sets src again on mount, so it is absolute
  });

  it('a matching pair chimes, then says the word once', async () => {
    await ready();
    fireEvent.click(tile(1));
    fireEvent.click(tile(7));
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(h.sayWord).not.toHaveBeenCalled();
    await advance(500); // the chime's tail rings for about half a second
    expect(h.sayWord).not.toHaveBeenCalled();
    await advance(100);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    expect(h.sayWord.mock.calls[0][0].id).toBe('c0');
    expect(tile(1).getAttribute('data-face-up')).toBe('true');
    expect(tile(7).getAttribute('data-face-up')).toBe('true');
    expect(tile(7).getAttribute('data-matched')).toBe('true');
    await advance(5000);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
  });

  it('a mismatch stays visible for MISMATCH_MS, then both flip back with a tick', async () => {
    await ready();
    fireEvent.click(tile(1));
    fireEvent.click(tile(2));
    expect(h.flipTick).toHaveBeenCalledTimes(2);
    await advance(MISMATCH_MS - 50);
    expect(tile(1).getAttribute('data-face-up')).toBe('true');
    expect(tile(2).getAttribute('data-face-up')).toBe('true');
    await advance(100);
    expect(tile(1).getAttribute('data-face-up')).toBe('false');
    expect(tile(2).getAttribute('data-face-up')).toBe('false');
    expect(h.flipTick).toHaveBeenCalledTimes(3);
    expect(h.chime).not.toHaveBeenCalled();
  });

  it('a third press during the mismatch pause does nothing', async () => {
    await ready();
    fireEvent.click(tile(1));
    fireEvent.click(tile(2));
    fireEvent.click(tile(3));
    expect(tile(3).getAttribute('data-face-up')).toBe('false');
    expect(h.flipTick).toHaveBeenCalledTimes(2);
  });

  it('a double press on one tile does not count and does not match with itself', async () => {
    await ready();
    fireEvent.click(tile(1));
    fireEvent.click(tile(1));
    expect(h.flipTick).toHaveBeenCalledTimes(1);
    expect(h.chime).not.toHaveBeenCalled();
    expect(tile(1).getAttribute('data-matched')).toBe('false');
    fireEvent.click(tile(7));
    expect(h.chime).toHaveBeenCalledTimes(1);
  });

  it('pressing a matched tile says its word again', async () => {
    await ready();
    fireEvent.click(tile(1));
    fireEvent.click(tile(7));
    await advance(600);
    fireEvent.click(tile(1));
    expect(h.sayWord).toHaveBeenCalledTimes(2);
    expect(h.sayWord.mock.calls[1][0].id).toBe('c0');
    expect(h.flipTick).toHaveBeenCalledTimes(2);
  });

  it('no written word is rendered on any tile, face-up or not', async () => {
    await ready();
    for (let i = 1; i <= 6; i++) {
      fireEvent.click(tile(i));
      fireEvent.click(tile(i + 6));
    }
    await advance(5000);
    expect(tiles().every((t) => t.getAttribute('data-face-up') === 'true')).toBe(true);
    for (let i = 0; i < 6; i++) expect(document.body.innerHTML).not.toContain(`word${i}`);
  });

  it('finishing the board marks the root as won after WIN_DELAY_MS', async () => {
    await ready();
    for (let i = 1; i <= 6; i++) {
      fireEvent.click(tile(i));
      fireEvent.click(tile(i + 6));
    }
    expect(root().getAttribute('data-won')).toBe('false');
    await advance(WIN_DELAY_MS + 10);
    expect(root().getAttribute('data-won')).toBe('true');
    expect(root().getAttribute('data-flips')).toBe('12');
  });

  it('WIN_DELAY_MS after the last pair the completion screen shows the real flip count', async () => {
    await ready();
    fireEvent.click(tile(1));
    fireEvent.click(tile(2)); // one mismatch: 2 extra flips
    await advance(MISMATCH_MS + 10);
    for (let i = 1; i <= 6; i++) {
      fireEvent.click(tile(i));
      fireEvent.click(tile(i + 6));
    }
    await advance(WIN_DELAY_MS - 100);
    expect(document.querySelector('[data-total]')).toBeNull();
    await advance(200);
    expect(document.querySelector('[data-total]')?.textContent).toBe('Total 14 times');
    expect(screen.getByRole('heading').textContent).toBe('You did it, Mi!');
  });

  it('Play again draws a fresh deck with no completion screen and flips reset', async () => {
    await ready();
    for (let i = 1; i <= 6; i++) {
      fireEvent.click(tile(i));
      fireEvent.click(tile(i + 6));
    }
    await advance(WIN_DELAY_MS + 10);
    expect(h.drawDeck).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    await advance(PRELOAD_MS + 10);
    expect(h.drawDeck).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-total]')).toBeNull();
    expect(root().getAttribute('data-won')).toBe('false');
    expect(tiles()).toHaveLength(12);
    expect(tiles().every((t) => t.getAttribute('data-face-up') === 'false')).toBe(true);
    for (let i = 1; i <= 6; i++) {
      fireEvent.click(tile(i));
      fireEvent.click(tile(i + 6));
    }
    await advance(WIN_DELAY_MS + 10);
    expect(document.querySelector('[data-total]')?.textContent).toBe('Total 12 times');
  });

  it('arrow keys move focus across the grid (Down by the column count)', async () => {
    await ready();
    expect(document.activeElement).toBe(tile(1));
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tile(5));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tile(6));
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(tile(2));
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tile(1));
  });

  it('Down moves by 6 on the 24-card grid', async () => {
    await ready('24');
    expect(document.activeElement).toBe(tile(1));
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tile(7));
  });

  it('Space and Enter on a focused tile are left to the button (native click flips it)', async () => {
    await ready();
    for (const key of [' ', 'Enter']) {
      const e = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
      document.activeElement?.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
    }
    fireEvent.click(document.activeElement as HTMLElement);
    expect(tile(1).getAttribute('data-face-up')).toBe('true');
  });

  it('Esc asks "Leave now?"; Yes goes back to the level screen', async () => {
    await ready();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/games/memory');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Leave now?' })).toBeTruthy();
    expect(h.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(h.push).toHaveBeenCalledWith('/games/memory');
  });

  it('unmounting during the mismatch pause leaves no timers and cancels speech', async () => {
    const cancel = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel } });
    const r = await ready();
    await advance(0); // jsdom's own focus()/selection timer from the initial tile focus
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(tile(1));
    fireEvent.click(tile(7));
    fireEvent.click(tile(2));
    fireEvent.click(tile(3));
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(2); // the word after the chime, the mismatch pause
    r.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(cancel).toHaveBeenCalled();
    expect(h.stopWord).toHaveBeenCalled();
    // @ts-expect-error test cleanup of the stub
    delete window.speechSynthesis;
  });

  it('a picture that fails to load shows a placeholder and the tile still works', async () => {
    await ready();
    fireEvent.click(tile(1));
    fireEvent.error(tile(1).querySelector('img')!);
    expect(tile(1).querySelector('img')).toBeNull();
    expect(tile(1).querySelector('[data-placeholder]')).not.toBeNull();
    fireEvent.click(tile(7));
    expect(h.chime).toHaveBeenCalledTimes(1);
  });

  it('with prefers-reduced-motion the root carries hm-reduced', async () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    await ready();
    expect(root().classList.contains('hm-reduced')).toBe(true);
  });

  it('without reduced motion the root has no hm-reduced', async () => {
    await ready();
    expect(root().classList.contains('hm-reduced')).toBe(false);
  });

  describe('the last word is heard before the celebration', () => {
    const solveAll = () => {
      for (let i = 1; i <= 6; i++) {
        fireEvent.click(tile(i));
        fireEvent.click(tile(i + 6));
      }
    };
    const done = () => document.querySelector('[data-memory-done]');

    it('the final word is said first; the completion waits until it ended plus a short pause', async () => {
      h.sayWord.mockImplementation(() => {}); // the voice is still talking
      await ready();
      solveAll();
      await advance(600);
      const last = h.sayWord.mock.calls.at(-1)!;
      expect(last[0].id).toBe('c5');
      expect(done()).toBeNull();
      await advance(1400); // well past WIN_DELAY_MS
      expect(done()).toBeNull();
      expect(root().getAttribute('data-won')).toBe('false');
      (last[1] as () => void)();
      await advance(350);
      expect(done()).toBeNull();
      await advance(100);
      expect(done()).not.toBeNull();
      expect(document.querySelector('[data-total]')?.textContent).toBe('Total 12 times');
    });

    it('an earlier word ending late does not stand in for the last one', async () => {
      h.sayWord.mockImplementation(() => {});
      await ready();
      solveAll();
      await advance(600);
      (h.sayWord.mock.calls[0][1] as () => void)();
      await advance(1500);
      expect(done()).toBeNull();
    });

    it('a word that never ends cannot block the celebration (cap about 4 s after the last match)', async () => {
      h.sayWord.mockImplementation(() => {});
      await ready();
      solveAll();
      await advance(3900);
      expect(done()).toBeNull();
      await advance(200);
      expect(done()).not.toBeNull();
      expect(document.querySelector('[data-total]')?.textContent).toBe('Total 12 times');
    });

    it('a word that ends quickly still leaves WIN_DELAY_MS before the celebration', async () => {
      await ready();
      solveAll();
      await advance(WIN_DELAY_MS - 50);
      expect(done()).toBeNull();
      await advance(100);
      expect(done()).not.toBeNull();
    });
  });
});

