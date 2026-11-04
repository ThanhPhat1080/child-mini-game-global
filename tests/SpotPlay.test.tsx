import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpotLevel } from '@/lib/spot/types';

const h = vi.hoisted(() => ({
  id: 'L1',
  fetchLevel: vi.fn(),
  chime: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  preload: vi.fn(),
  settings: vi.fn(),
}));

vi.mock('@/lib/spot/levels', () => ({ fetchLevel: h.fetchLevel }));
vi.mock('@/lib/sfx', () => ({ chime: h.chime, applause: vi.fn(), speakKid: vi.fn(), playFile: vi.fn() }));
vi.mock('@/lib/memory/preload', () => ({ preloadImages: h.preload }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: () => h.settings() }) }) }) }),
}));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ levelId: h.id }),
  useRouter: () => ({ push: h.push, replace: h.replace }),
  usePathname: () => `/games/spot/${h.id}`,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import SpotPlay from '@/app/games/spot/[levelId]/page';

const level: SpotLevel = {
  id: 'L1', image_a_path: 'a.svg', image_b_path: 'b.svg', active: true, sort_order: 1,
  differences: [{ x: 0.25, y: 0.3, r: 0.06 }, { x: 0.5, y: 0.6, r: 0.06 }, { x: 0.75, y: 0.4, r: 0.06 }],
};
const pic = (s: 'a' | 'b') => document.querySelector<HTMLElement>(`[data-spot-pic="${s}"]`)!;
const rings = (s: 'a' | 'b') => pic(s).querySelectorAll('[data-spot-found]');
const ripples = () => document.querySelectorAll('[data-spot-ripple]');
const lit = () => document.querySelectorAll('[data-spot-dot][data-lit]').length;
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const origRect = HTMLElement.prototype.getBoundingClientRect;

/** Every picture is 800x600 at the origin; tap at fractions. */
const tap = (s: 'a' | 'b', x: number, y: number) => fireEvent.click(pic(s), { clientX: x * 800, clientY: y * 600 });

async function ready() {
  h.fetchLevel.mockResolvedValue(level);
  const r = render(<SpotPlay />);
  await advance(10);
  return r;
}

beforeEach(() => {
  vi.useFakeTimers();
  for (const f of [h.fetchLevel, h.chime, h.push, h.replace, h.preload, h.settings]) f.mockReset();
  h.id = 'L1';
  h.preload.mockImplementation((_urls: unknown, done: () => void) => { done(); return () => {}; });
  h.settings.mockResolvedValue({ data: { child_name: 'Mi', complete_path: null } });
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined });
  HTMLElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON() {} }) as DOMRect;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  HTMLElement.prototype.getBoundingClientRect = origRect;
});

describe('Spot play screen (S2-S10)', () => {
  it('taps are off until the pictures are preloaded', async () => {
    let finish: () => void = () => {};
    h.preload.mockImplementation((_u: unknown, done: () => void) => { finish = done; return () => {}; });
    await ready();
    expect(document.querySelector('[data-spot-pic]')).toBeNull();
    finish();
    await advance(0);
    expect(pic('a')).not.toBeNull();
  });

  it('a tap on a difference chimes once, lights one dot and rings both pictures', async () => {
    await ready();
    expect(lit()).toBe(0);
    tap('a', 0.25, 0.3);
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(lit()).toBe(1);
    expect(rings('a')).toHaveLength(1);
    expect(rings('b')).toHaveLength(1);
  });

  it('a tap on the B picture counts as well', async () => {
    await ready();
    tap('b', 0.5, 0.6);
    expect(lit()).toBe(1);
  });

  it('a double tap on the same difference counts once', async () => {
    await ready();
    tap('a', 0.25, 0.3);
    tap('a', 0.25, 0.3);
    tap('b', 0.26, 0.31);
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(lit()).toBe(1);
    expect(rings('a')).toHaveLength(1);
    expect(ripples()).toHaveLength(0);
  });

  it('a tap on empty space makes one ripple, no chime, no dot change', async () => {
    await ready();
    tap('a', 0.9, 0.9);
    expect(ripples()).toHaveLength(1);
    expect(h.chime).not.toHaveBeenCalled();
    expect(lit()).toBe(0);
    tap('a', 0.25, 0.3); // no penalty afterwards
    expect(lit()).toBe(1);
    await advance(2000);
    expect(ripples()).toHaveLength(0);
  });

  it('with reduced motion the ring has no grow class', async () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    await ready();
    tap('a', 0.25, 0.3);
    expect(rings('a')[0].className).not.toContain('hm-spot-grow');
  });

  it('without reduced motion the ring grows', async () => {
    await ready();
    tap('a', 0.25, 0.3);
    expect(rings('a')[0].className).toContain('hm-spot-grow');
  });

  it('finding every difference shows the celebration after about 1 s; play again resets', async () => {
    await ready();
    tap('a', 0.25, 0.3);
    tap('b', 0.5, 0.6);
    tap('a', 0.75, 0.4);
    expect(lit()).toBe(3);
    await advance(900);
    expect(document.querySelector('[data-spot-done]')).toBeNull();
    await advance(200);
    expect(screen.getByRole('heading').textContent).toBe('You did it, Mi!');
    expect(document.querySelector('[data-total]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Choose level' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    await advance(10);
    expect(lit()).toBe(0);
    expect(rings('a')).toHaveLength(0);
    tap('a', 0.25, 0.3);
    expect(lit()).toBe(1);
  });

  it('if settings never settle, the celebration still shows about 2 s after the win (S6)', async () => {
    h.settings.mockReturnValue(new Promise(() => {}));
    await ready();
    tap('a', 0.25, 0.3);
    tap('b', 0.5, 0.6);
    tap('a', 0.75, 0.4);
    await advance(1100);
    expect(document.querySelector('[data-spot-done]')).toBeNull();
    await advance(1800);
    expect(document.querySelector('[data-spot-done]')).toBeNull();
    await advance(300);
    expect(document.querySelector('[data-spot-done]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Play again' })).toBeTruthy();
  });

  it('the fallback does not override or double-fire when settings arrive in time', async () => {
    await ready();
    tap('a', 0.25, 0.3);
    tap('b', 0.5, 0.6);
    tap('a', 0.75, 0.4);
    await advance(1100);
    expect(screen.getByRole('heading').textContent).toBe('You did it, Mi!');
    await advance(5000);
    expect(screen.getByRole('heading').textContent).toBe('You did it, Mi!');
    expect(h.settings).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Esc goes back to the level grid', async () => {
    await ready();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games/spot');
  });

  it('a null level shows the friendly status; Back and Esc still work', async () => {
    h.fetchLevel.mockResolvedValue(null);
    render(<SpotPlay />);
    await advance(10);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('This picture is not available');
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/games/spot');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games/spot');
  });

  it('a rejected fetchLevel shows the same friendly status', async () => {
    h.fetchLevel.mockRejectedValue(new Error('no client'));
    render(<SpotPlay />);
    await advance(10);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('This picture is not available');
  });

  it('a picture that fails to load does not break the page', async () => {
    await ready();
    fireEvent.error(pic('a').querySelector('img')!);
    expect(pic('a').querySelector('[data-placeholder]')).not.toBeNull();
    tap('a', 0.25, 0.3);
    expect(lit()).toBe(1);
  });

  it('leaving the page cancels timers', async () => {
    const r = await ready();
    await advance(0);
    tap('a', 0.9, 0.9);
    tap('a', 0.25, 0.3);
    tap('b', 0.5, 0.6);
    tap('a', 0.75, 0.4);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    r.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
