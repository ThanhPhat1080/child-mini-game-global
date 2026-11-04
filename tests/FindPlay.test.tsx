import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FindLevel, FindObject } from '@/lib/find/types';

const h = vi.hoisted(() => ({
  id: 'L1',
  fetchFindLevel: vi.fn(),
  chime: vi.fn(),
  sayWord: vi.fn(),
  stopWord: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  preload: vi.fn(),
  settings: vi.fn(),
}));

vi.mock('@/lib/find/levels', () => ({ fetchFindLevel: h.fetchFindLevel }));
vi.mock('@/lib/memory/cards', () => ({ sayWord: h.sayWord, stopWord: h.stopWord }));
vi.mock('@/lib/sfx', () => ({ chime: h.chime, applause: vi.fn(), speakKid: vi.fn(), playFile: vi.fn() }));
vi.mock('@/lib/memory/preload', () => ({ preloadImages: h.preload }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: () => h.settings() }) }) }) }),
}));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ levelId: h.id }),
  useRouter: () => ({ push: h.push, replace: h.replace }),
  usePathname: () => `/games/find/${h.id}`,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import FindPlay from '@/app/games/find/[levelId]/page';

const objects: FindObject[] = [
  { x: 0.25, y: 0.3, r: 0.06, word: 'apple', audio_path: null },
  { x: 0.5, y: 0.6, r: 0.06, word: 'ball', audio_path: 'seed/ball.mp3' },
  { x: 0.75, y: 0.4, r: 0.06, word: 'cat', audio_path: null },
];
const level: FindLevel = { id: 'L1', image_path: 'seed/scene.svg', objects, active: true, sort_order: 1 };

const area = () => document.querySelector<HTMLElement>('[data-find-area]')!;
/** The word of the highlighted row in the word list (data-current), read from its accessible name. */
const word = () => document.querySelector<HTMLElement>('[data-current="true"]')?.getAttribute('aria-label')?.replace(/^Object \d+: /, '') ?? null;
const ripples = () => document.querySelectorAll('[data-find-ripple]').length;
const rings = () => document.querySelectorAll('[data-find-found]').length;
const lit = () => document.querySelectorAll('[data-found="true"]').length;
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const origRect = HTMLElement.prototype.getBoundingClientRect;

/** The picture is 800x600 at the origin; taps are fractions of it. */
const tap = (x: number, y: number) => fireEvent.click(area(), { clientX: x * 800, clientY: y * 600 });

async function ready(lvl: FindLevel | null = level) {
  h.fetchFindLevel.mockResolvedValue(lvl);
  const r = render(<FindPlay />);
  await advance(10);
  return r;
}
/** Right tap on the current object, then wait out the advance pause. */
const found = async (x: number, y: number) => {
  tap(x, y);
  await advance(1000);
};

beforeEach(() => {
  vi.useFakeTimers();
  for (const f of [h.fetchFindLevel, h.chime, h.sayWord, h.stopWord, h.push, h.replace, h.preload, h.settings]) f.mockReset();
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

describe('Find It play screen (F2-F9)', () => {
  it('the first word is highlighted at once and said after 600 ms', async () => {
    await ready();
    expect(word()).toBe('apple');
    expect(h.sayWord).not.toHaveBeenCalled();
    await advance(599);
    expect(h.sayWord).not.toHaveBeenCalled();
    await advance(1);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    expect(h.sayWord).toHaveBeenLastCalledWith(expect.objectContaining({ word: 'apple' }));
  });

  it('a right tap chimes once, rings the object and lights a dot; taps during the pause do nothing', async () => {
    await ready();
    await advance(600);
    tap(0.25, 0.3);
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(rings()).toBe(1);
    expect(lit()).toBe(1);
    expect(word()).toBe('apple');
    tap(0.5, 0.6); // during the pause: ignored entirely
    tap(0.9, 0.9);
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(ripples()).toBe(0);
    await advance(999);
    expect(word()).toBe('apple');
    await advance(1);
    expect(word()).toBe('ball');
    expect(h.sayWord).toHaveBeenLastCalledWith(expect.objectContaining({ word: 'ball', audio_path: 'seed/ball.mp3' }));
    expect(rings()).toBe(1);
  });

  it('a wrong tap makes a ripple, no chime, no count, and the same word stays', async () => {
    await ready();
    await advance(600);
    tap(0.9, 0.9);
    expect(ripples()).toBe(1);
    expect(h.chime).not.toHaveBeenCalled();
    expect(lit()).toBe(0);
    expect(word()).toBe('apple');
    await advance(2000);
    expect(ripples()).toBe(0);
  });

  it('a tap inside object 2 while object 1 is current is a wrong tap', async () => {
    await ready();
    await advance(600);
    tap(0.5, 0.6);
    expect(ripples()).toBe(1);
    expect(h.chime).not.toHaveBeenCalled();
    expect(lit()).toBe(0);
  });

  it('overlapping circles: a tap inside the current object counts even if it is also inside another', async () => {
    await ready({ ...level, objects: [objects[0], { ...objects[1], x: 0.27, y: 0.3 }, objects[2]] });
    await advance(600);
    tap(0.26, 0.3); // inside both apple and the overlapping ball
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(lit()).toBe(1);
    expect(ripples()).toBe(0);
  });

  it('R (either case) says the current word again', async () => {
    await ready();
    await advance(600);
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.keyDown(window, { key: 'R' });
    expect(h.sayWord).toHaveBeenCalledTimes(3);
    expect(h.sayWord).toHaveBeenLastCalledWith(expect.objectContaining({ word: 'apple' }));
  });

  it('R still repeats the current word after a click on another row', async () => {
    await ready();
    await advance(600);
    fireEvent.click(screen.getByRole('button', { name: 'Object 2: ball' }));
    fireEvent.keyDown(window, { key: 'r' });
    expect(h.sayWord).toHaveBeenLastCalledWith(expect.objectContaining({ word: 'apple' }));
  });

  it('clicking a list row says that word and does not change the game or the highlight', async () => {
    await ready();
    await advance(600);
    fireEvent.click(screen.getByRole('button', { name: 'Object 3: cat' }));
    expect(h.sayWord).toHaveBeenCalledTimes(2);
    expect(h.sayWord).toHaveBeenLastCalledWith(expect.objectContaining({ word: 'cat' }));
    expect(word()).toBe('apple');
    expect(lit()).toBe(0);
    expect(ripples()).toBe(0);
    expect(h.chime).not.toHaveBeenCalled();
  });

  it('clicking the speaker of the current row says its word again', async () => {
    await ready();
    await advance(600);
    fireEvent.click(screen.getByRole('button', { name: 'Say word 1' }));
    expect(h.sayWord).toHaveBeenCalledTimes(2);
    expect(h.sayWord).toHaveBeenLastCalledWith(expect.objectContaining({ word: 'apple' }));
  });

  it('a click on a found row says its word but never counts as a tap on the picture', async () => {
    await ready();
    await advance(600);
    await found(0.25, 0.3);
    fireEvent.click(screen.getByRole('button', { name: 'Object 1: apple' }));
    expect(h.sayWord).toHaveBeenLastCalledWith(expect.objectContaining({ word: 'apple' }));
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(lit()).toBe(1);
    expect(ripples()).toBe(0);
  });

  it('finding every object shows the celebration about 1 s after the last find; play again restarts at object 1', async () => {
    await ready();
    await advance(600);
    await found(0.25, 0.3);
    await found(0.5, 0.6);
    tap(0.75, 0.4);
    expect(lit()).toBe(3);
    await advance(900);
    expect(document.querySelector('[data-find-done]')).toBeNull();
    await advance(200);
    expect(screen.getByRole('heading').textContent).toBe('You did it, Mi!');
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    await advance(10);
    expect(lit()).toBe(0);
    expect(rings()).toBe(0);
    await advance(600);
    expect(word()).toBe('apple');
  });

  it('Esc goes back to the level grid', async () => {
    await ready();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games/find');
  });

  it('an unknown level shows the friendly status; Back and Esc still work', async () => {
    h.fetchFindLevel.mockResolvedValue(null);
    render(<FindPlay />);
    await advance(10);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('This picture is not available');
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/games/find');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games/find');
  });

  it('an unplayable level (one object) shows the same friendly status and never a board', async () => {
    h.fetchFindLevel.mockResolvedValue({ ...level, objects: [objects[0]] });
    render(<FindPlay />);
    await advance(10);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('This picture is not available');
    expect(document.querySelector('[data-find-pic]')).toBeNull();
  });

  it('a rejected fetch shows the same friendly status', async () => {
    h.fetchFindLevel.mockRejectedValue(new Error('no client'));
    render(<FindPlay />);
    await advance(10);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('This picture is not available');
  });

  it('with reduced motion the page carries the hm-reduced class', async () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    await ready();
    expect(document.querySelector('[data-find-play]')!.className).toContain('hm-reduced');
  });

  it('leaving the page stops the word and cancels timers', async () => {
    const r = await ready();
    await advance(600);
    tap(0.9, 0.9);
    tap(0.25, 0.3);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    r.unmount();
    expect(h.stopWord).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('FindPlay layout (F2, F3: the word list sits beside the picture)', () => {
  it('the word list is a 480 px column on the left, with one row per object', async () => {
    await ready();
    const list = document.querySelector<HTMLElement>('[data-find-col]')!;
    expect(list.style.width).toBe('480px');
    expect(list.style.left).toBe('40px');
    expect(list.querySelectorAll('[data-find-row]')).toHaveLength(3);
  });

  it('there is no progress dot row and no prompt bar', async () => {
    await ready();
    expect(document.querySelector('[data-spot-dot]')).toBeNull();
    expect(document.querySelector('[data-find-prompt]')).toBeNull();
    expect(document.querySelector('[data-find-word]')).toBeNull();
  });
});
