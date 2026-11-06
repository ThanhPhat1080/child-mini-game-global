import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryCard } from '@/lib/memory/types';

const h = vi.hoisted(() => ({
  fetchSortCards: vi.fn(),
  sayWord: vi.fn(),
  stopWord: vi.fn(),
  chime: vi.fn(),
  ohOh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  settings: vi.fn(),
}));

vi.mock('@/lib/sort/cards', () => ({ fetchSortCards: h.fetchSortCards }));
vi.mock('@/lib/memory/cards', () => ({ fetchActiveCards: vi.fn(), sayWord: h.sayWord, stopWord: h.stopWord }));
vi.mock('@/lib/sfx', () => ({ chime: h.chime, ohOh: h.ohOh, yay: vi.fn(), applause: vi.fn(), speakKid: vi.fn(), playFile: vi.fn(), flipTick: vi.fn() }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: () => h.settings() }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null | undefined) => (p ? `/media/${p}` : null) }));
vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: h.push, replace: h.replace }),
  usePathname: () => '/games/sort',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import SortPlay, { FINISH_DELAY_MS, SLIDE_BACK_MS, WORD_AFTER_CHIME_MS, WORD_CAP_MS, WRONG_POPUP_MS } from '@/app/games/sort/page';
import { PRELOAD_MS } from '@/lib/memory/preload';

const card = (id: string, word: string, group: string | null): MemoryCard => ({ id, word, image_path: `${id}.svg`, audio_path: null, active: true, group_id: group });
/** `n` cards of group `g`: ids g1..gn, words <g>-word1.. */
const group = (g: string, n: number) => Array.from({ length: n }, (_, i) => card(`${g}${i + 1}`, `${g}-word${i + 1}`, g));
const POOL = [...group('ga', 4), ...group('gb', 4)];
const groupOf = (id: string) => POOL.find((c) => c.id === id)!.group_id!;

const root = () => document.querySelector<HTMLElement>('[data-sort-play]')!;
const objects = () => Array.from(document.querySelectorAll<HTMLElement>('[data-object]'));
const obj = (id: string) => document.querySelector<HTMLElement>(`[data-object][data-card-id="${id}"]`)!;
const ids = () => objects().map((o) => o.getAttribute('data-card-id')!);
const stateOf = (id: string) => obj(id).getAttribute('data-state');
const basketOfGroup = (g: string) => Number(document.querySelector(`[data-group="${g}"] [data-basket]`)!.getAttribute('data-basket')) as 0 | 1;
const basketEl = (i: 0 | 1) => document.querySelector<HTMLElement>(`[data-basket="${i}"]`)!;
const placedIn = (i: 0 | 1) => Array.from(basketEl(i).querySelectorAll('[data-placed]')).map((s) => s.getAttribute('data-placed'));
const popup = () => document.querySelector('[data-feedback="wrong"]');
const badge = () => screen.getByRole('button', { name: 'What is Sort It? Show how to play' });
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const cancel = vi.fn();

/** jsdom has no PointerEvent: a MouseEvent with pointerId and isPrimary (as in useSortDrag.test). */
function pe(type: string, x: number, y: number) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'isPrimary', { value: true });
  return e;
}
function rect(left: number, top: number, width: number, height: number) {
  return () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
}

/** Stage at scale 1: basket 0 at x 120-880, basket 1 at x 1040-1800, both y 210-730. */
function stubRects() {
  root().getBoundingClientRect = rect(0, 0, 1920, 1080);
  basketEl(0).getBoundingClientRect = rect(120, 210, 760, 520);
  basketEl(1).getBoundingClientRect = rect(1040, 210, 760, 520);
}
const TARGET = { 0: { x: 500, y: 470 }, 1: { x: 1420, y: 470 }, out: { x: 960, y: 120 } } as const;

const down = (id: string) => act(() => { obj(id).dispatchEvent(pe('pointerdown', 900, 900)); });
const move = (x: number, y: number) => act(() => { window.dispatchEvent(pe('pointermove', x, y)); });
const up = (x: number, y: number) => act(() => { window.dispatchEvent(pe('pointerup', x, y)); });
/** Press, lift and release over basket 0 / 1 or empty space, through the real drag hook. */
function drop(id: string, to: 0 | 1 | 'out') {
  const p = TARGET[to];
  down(id);
  move(950, 850);
  move(p.x, p.y);
  up(p.x, p.y);
}
const rightBasket = (id: string) => basketOfGroup(groupOf(id));
const wrongBasket = (id: string) => (1 - rightBasket(id)) as 0 | 1;

async function ready(pool: MemoryCard[] = POOL) {
  h.fetchSortCards.mockResolvedValue(pool);
  const r = render(<SortPlay />);
  await advance(PRELOAD_MS + 10);
  if (objects().length) stubRects();
  return r;
}

beforeEach(() => {
  vi.useFakeTimers();
  for (const f of [h.fetchSortCards, h.sayWord, h.stopWord, h.chime, h.ohOh, h.push, h.replace, h.settings, cancel]) f.mockReset();
  h.settings.mockResolvedValue({ ohoh_path: null, child_name: 'childPlayer', complete_path: null });
  h.sayWord.mockImplementation((_c: MemoryCard, onEnd?: () => void) => onEnd?.()); // a word that ends at once
  h.ohOh.mockReturnValue({ ms: 1900, stop: vi.fn() });
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, writable: true, value: { cancel } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Sort It play screen (R1-R6, R8-R10)', () => {
  it('exports the timing constants', () => {
    expect([SLIDE_BACK_MS, WRONG_POPUP_MS, WORD_AFTER_CHIME_MS, FINISH_DELAY_MS, WORD_CAP_MS]).toEqual([350, 1400, 550, 1000, 4000]);
  });

  it('starts a round after the preload: 6 objects, 2 baskets each showing an example of its own group', async () => {
    h.fetchSortCards.mockResolvedValue(POOL);
    render(<SortPlay />);
    await advance(PRELOAD_MS - 100);
    expect(objects()).toHaveLength(0);
    await advance(110);
    expect(objects()).toHaveLength(6);
    expect(new Set(ids()).size).toBe(6);
    expect(objects().every((o) => o.getAttribute('data-state') === 'idle')).toBe(true);
    expect(root().getAttribute('data-done')).toBe('false');
    for (const i of [0, 1] as const) {
      const g = basketEl(i).parentElement!.getAttribute('data-group')!;
      const src = new URL(basketEl(i).querySelector<HTMLImageElement>('[data-basket-example] img')!.src).pathname;
      const exampleId = src.replace('/media/', '').replace('.svg', '');
      expect(groupOf(exampleId)).toBe(g);
      expect(ids()).not.toContain(exampleId);
      expect(ids().filter((id) => groupOf(id) === g)).toHaveLength(3);
      expect(placedIn(i)).toEqual([]);
    }
    expect(h.sayWord).not.toHaveBeenCalled();
  });

  it('tapping an example says its word', async () => {
    await ready();
    fireEvent.click(basketEl(1).querySelector('[data-basket-example]')!);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    const said = h.sayWord.mock.calls[0][0] as MemoryCard;
    expect(said.group_id).toBe(basketEl(1).parentElement!.getAttribute('data-group'));
    expect(ids()).not.toContain(said.id);
  });

  it('picking an object up says its word; a tap says it again and leaves it in place', async () => {
    await ready();
    const id = ids()[0];
    down(id);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    expect(h.sayWord.mock.calls[0][0].id).toBe(id);
    up(902, 901);
    expect(h.sayWord).toHaveBeenCalledTimes(2);
    expect(h.sayWord.mock.calls[1][0].id).toBe(id);
    expect(stateOf(id)).toBe('idle');
    expect(h.chime).not.toHaveBeenCalled();
    expect(h.ohOh).not.toHaveBeenCalled();
  });

  it('a lifted object is in state lifted and follows the pointer', async () => {
    await ready();
    const id = ids()[0];
    down(id);
    move(1000, 950);
    expect(stateOf(id)).toBe('lifted');
    expect(obj(id).style.transform).toContain('translate(100px, 50px)');
  });

  it('a right drop: chime once, fills the next slot, hides the object, says the word after WORD_AFTER_CHIME_MS', async () => {
    await ready();
    const [a, b] = ids().filter((id) => rightBasket(id) === rightBasket(ids()[0]));
    const bi = rightBasket(a);
    drop(a, bi);
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(h.ohOh).not.toHaveBeenCalled();
    expect(stateOf(a)).toBe('hidden');
    expect(placedIn(bi)).toEqual([a]);
    h.sayWord.mockClear();
    await advance(WORD_AFTER_CHIME_MS - 10);
    expect(h.sayWord).not.toHaveBeenCalled();
    await advance(10);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    expect(h.sayWord.mock.calls[0][0].id).toBe(a);
    drop(b, bi);
    expect(placedIn(bi)).toEqual([a, b]);
    expect(h.chime).toHaveBeenCalledTimes(2);
    expect(root().getAttribute('data-wrong-count')).toBe('0');
  });

  it('a wrong drop: ohOh once, popup for WRONG_POPUP_MS, slides back for SLIDE_BACK_MS, wrong count +1', async () => {
    await ready();
    const id = ids()[0];
    drop(id, wrongBasket(id));
    expect(h.ohOh).toHaveBeenCalledTimes(1);
    expect(h.chime).not.toHaveBeenCalled();
    expect(popup()).not.toBeNull();
    expect(stateOf(id)).toBe('sliding');
    expect(root().getAttribute('data-wrong-count')).toBe('1');
    expect(placedIn(0)).toEqual([]);
    expect(placedIn(1)).toEqual([]);
    await advance(SLIDE_BACK_MS - 10);
    expect(stateOf(id)).toBe('sliding');
    await advance(10);
    expect(stateOf(id)).toBe('idle');
    await advance(WRONG_POPUP_MS - SLIDE_BACK_MS - 10);
    expect(popup()).not.toBeNull();
    await advance(10);
    expect(popup()).toBeNull();
  });

  it('a new wrong drop restarts the popup and counts again', async () => {
    await ready();
    const id = ids()[0];
    drop(id, wrongBasket(id));
    await advance(1000);
    drop(id, wrongBasket(id));
    expect(h.ohOh).toHaveBeenCalledTimes(2);
    expect(root().getAttribute('data-wrong-count')).toBe('2');
    await advance(WRONG_POPUP_MS - 10);
    expect(popup()).not.toBeNull();
    await advance(10);
    expect(popup()).toBeNull();
  });

  it('a wrong drop then the right one fills the basket', async () => {
    await ready();
    const id = ids()[0];
    drop(id, wrongBasket(id));
    await advance(SLIDE_BACK_MS);
    drop(id, rightBasket(id));
    expect(placedIn(rightBasket(id))).toEqual([id]);
    expect(stateOf(id)).toBe('hidden');
  });

  it('a drop outside both baskets slides back silently and does not count', async () => {
    await ready();
    const id = ids()[0];
    drop(id, 'out');
    expect(h.chime).not.toHaveBeenCalled();
    expect(h.ohOh).not.toHaveBeenCalled();
    expect(popup()).toBeNull();
    expect(stateOf(id)).toBe('sliding');
    expect(root().getAttribute('data-wrong-count')).toBe('0');
    await advance(SLIDE_BACK_MS);
    expect(stateOf(id)).toBe('idle');
  });

  it('a press during a slide-back is ignored', async () => {
    await ready();
    const [a, b] = ids();
    drop(a, 'out');
    h.sayWord.mockClear();
    drop(b, rightBasket(b));
    expect(h.sayWord).not.toHaveBeenCalled();
    expect(h.chime).not.toHaveBeenCalled();
    expect(stateOf(b)).toBe('idle');
    await advance(SLIDE_BACK_MS);
    drop(b, rightBasket(b));
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(stateOf(b)).toBe('hidden');
  });

  it('a press during a right-drop settle is ignored', async () => {
    await ready();
    const [a, b] = ids();
    drop(a, rightBasket(a));
    h.sayWord.mockClear();
    await advance(100);
    drop(b, rightBasket(b));
    expect(h.sayWord).not.toHaveBeenCalled();
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(stateOf(b)).toBe('idle');
    await advance(WORD_AFTER_CHIME_MS);
    drop(b, rightBasket(b));
    expect(h.chime).toHaveBeenCalledTimes(2);
  });

  async function sortAll() {
    const all = ids();
    for (const id of all) {
      drop(id, rightBasket(id));
      if (id !== all[all.length - 1]) await advance(WORD_AFTER_CHIME_MS);
    }
  }

  const finishLine = () => document.querySelector('[data-wrong-line]')?.textContent;
  const againBtn = () => screen.getByRole('button', { name: 'Play again' });

  it('after the 6th right drop and its word, plus FINISH_DELAY_MS, the finish scene appears with "Wrong 0 times"', async () => {
    await ready();
    await sortAll();
    expect(placedIn(0)).toHaveLength(3);
    expect(placedIn(1)).toHaveLength(3);
    await advance(WORD_AFTER_CHIME_MS + FINISH_DELAY_MS - 10);
    expect(root().getAttribute('data-done')).toBe('false');
    expect(document.querySelector('[data-sort-done]')).toBeNull();
    await advance(10);
    expect(root().getAttribute('data-done')).toBe('true');
    expect(objects()).toHaveLength(0);
    expect(document.querySelector('[data-basket]')).toBeNull();
    expect(document.querySelector('[data-sort-done]')).not.toBeNull();
    await advance(0);
    expect(screen.getByRole('heading').textContent).toBe('You did it, childPlayer!');
    expect(finishLine()).toBe('Wrong 0 times');
    expect(screen.getAllByRole('link', { name: 'Back to games' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'What is Sort It? Show how to play' })).toBeNull();
    expect(h.settings).toHaveBeenCalled();
  });

  it('the finish shows the round wrong count', async () => {
    await ready();
    const first = ids()[0];
    drop(first, wrongBasket(first));
    await advance(SLIDE_BACK_MS);
    drop(first, wrongBasket(first));
    await advance(SLIDE_BACK_MS);
    await sortAll();
    await advance(WORD_AFTER_CHIME_MS + FINISH_DELAY_MS);
    expect(finishLine()).toBe('Wrong 2 times');
    expect(document.querySelector('[data-wrong-total]')?.textContent).toBe('2');
    expect(root().getAttribute('data-wrong-count')).toBe('2');
  });

  it('while the finish is pending an example tap says nothing and does not delay it', async () => {
    await ready();
    await sortAll();
    h.sayWord.mockClear();
    fireEvent.click(basketEl(0).querySelector('[data-basket-example]')!); // during the settle after the 6th drop
    await advance(WORD_AFTER_CHIME_MS);
    expect(h.sayWord).toHaveBeenCalledTimes(1); // only the last right word
    fireEvent.click(basketEl(1).querySelector('[data-basket-example]')!); // during the finish pause
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    await advance(FINISH_DELAY_MS);
    expect(root().getAttribute('data-done')).toBe('true');
  });

  it('while the finish is pending with a word that never ends, an example tap does not postpone the cap', async () => {
    await ready();
    h.sayWord.mockImplementation(() => undefined);
    await sortAll();
    await advance(WORD_AFTER_CHIME_MS + 100);
    h.sayWord.mockClear();
    fireEvent.click(basketEl(0).querySelector('[data-basket-example]')!);
    expect(h.sayWord).not.toHaveBeenCalled();
    await advance(WORD_CAP_MS + FINISH_DELAY_MS - 100);
    expect(root().getAttribute('data-done')).toBe('true');
  });

  it('Esc on the finish goes to the game list', async () => {
    await ready();
    await sortAll();
    await advance(WORD_AFTER_CHIME_MS + FINISH_DELAY_MS);
    await advance(0);
    h.push.mockClear();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledTimes(1);
    expect(h.push).toHaveBeenCalledWith('/games');
  });

  it('Play again starts a new round: 0 wrong, 6 objects, empty baskets, and a second round finishes with its own count', async () => {
    h.settings.mockResolvedValue({ ohoh_path: null, child_name: '', complete_path: null });
    await ready();
    const first = ids()[0];
    drop(first, wrongBasket(first));
    await advance(SLIDE_BACK_MS);
    await sortAll();
    await advance(WORD_AFTER_CHIME_MS + FINISH_DELAY_MS);
    await advance(0);
    expect(finishLine()).toBe('Wrong 1 times');
    h.sayWord.mockClear();
    h.stopWord.mockClear();
    fireEvent.click(againBtn());
    expect(h.stopWord).toHaveBeenCalled();
    await advance(PRELOAD_MS + 10);
    expect(document.querySelector('[data-sort-done]')).toBeNull();
    expect(root().getAttribute('data-done')).toBe('false');
    expect(root().getAttribute('data-wrong-count')).toBe('0');
    expect(objects()).toHaveLength(6);
    expect(objects().every((o) => o.getAttribute('data-state') === 'idle')).toBe(true);
    expect(placedIn(0)).toEqual([]);
    expect(placedIn(1)).toEqual([]);
    expect(popup()).toBeNull();
    expect(screen.getByRole('button', { name: 'What is Sort It? Show how to play' })).toBeTruthy();
    expect(h.sayWord).not.toHaveBeenCalled();
    stubRects();
    // a full second round: no stale counters (rightCount, wrong, finishing) from the first
    await sortAll();
    await advance(WORD_AFTER_CHIME_MS + FINISH_DELAY_MS - 10);
    expect(root().getAttribute('data-done')).toBe('false');
    await advance(10);
    await advance(0);
    expect(root().getAttribute('data-done')).toBe('true');
    expect(finishLine()).toBe('Wrong 0 times');
  });

  it('Play again right after a finish leaves no old timer to fire in the new round', async () => {
    await ready();
    await sortAll();
    await advance(WORD_AFTER_CHIME_MS + FINISH_DELAY_MS);
    await advance(0);
    fireEvent.click(againBtn());
    await advance(PRELOAD_MS + 10);
    stubRects();
    await advance(10000);
    expect(root().getAttribute('data-done')).toBe('false');
    expect(objects()).toHaveLength(6);
  });

  it('leaving on the finish, or while it is pending, clears every timer', async () => {
    const r = await ready();
    await sortAll();
    await advance(WORD_AFTER_CHIME_MS + 100);
    r.unmount();
    expect(vi.getTimerCount()).toBe(0);
    h.sayWord.mockClear();
    const r2 = await ready();
    await sortAll();
    await advance(WORD_AFTER_CHIME_MS + FINISH_DELAY_MS);
    await advance(0);
    r2.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('the finish waits at most WORD_CAP_MS for a word that never ends', async () => {
    await ready();
    h.sayWord.mockImplementation(() => undefined);
    await sortAll();
    await advance(WORD_AFTER_CHIME_MS + WORD_CAP_MS + FINISH_DELAY_MS - 10);
    expect(root().getAttribute('data-done')).toBe('false');
    await advance(10);
    expect(root().getAttribute('data-done')).toBe('true');
  });

  it.each([
    ['no round can be built (one usable group)', () => h.fetchSortCards.mockResolvedValue([...group('ga', 6), card('x1', 'x', null)])],
    ['fewer than 2 usable groups (3 cards in one)', () => h.fetchSortCards.mockResolvedValue([...group('ga', 4), ...group('gb', 3)])],
    ['the fetch fails', () => h.fetchSortCards.mockRejectedValue(new Error('offline'))],
    ['same-word cards count once ("Apple" and "apple")', () => h.fetchSortCards.mockResolvedValue([...group('ga', 4), card('b1', 'Apple', 'gb'), card('b2', 'apple', 'gb'), card('b3', 'pear', 'gb'), card('b4', 'plum', 'gb')])],
  ])('friendly empty screen when %s', async (_name, setup) => {
    setup();
    render(<SortPlay />);
    await advance(PRELOAD_MS + 10);
    expect(screen.getByRole('status', { name: 'New cards are coming soon' })).toBeTruthy();
    expect(objects()).toHaveLength(0);
    expect(document.querySelector('[data-basket]')).toBeNull();
  });

  it('Esc asks "Leave now?"; Yes goes back to the game list', async () => {
    await ready();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Leave now?' })).toBeTruthy();
    expect(h.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(h.push).toHaveBeenCalledWith('/games');
  });

  it('the badge opens the help; while it is open presses are ignored; Esc closes only the popup', async () => {
    await ready();
    fireEvent.click(badge());
    expect(screen.getByRole('dialog', { name: 'How to play Sort It' })).toBeTruthy();
    const id = ids()[0];
    drop(id, rightBasket(id));
    expect(h.sayWord).not.toHaveBeenCalled();
    expect(h.chime).not.toHaveBeenCalled();
    expect(stateOf(id)).toBe('idle');
    fireEvent.keyDown(document.activeElement ?? window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.push).not.toHaveBeenCalled();
    drop(id, rightBasket(id));
    expect(h.chime).toHaveBeenCalledTimes(1);
  });

  it('help opened before the last word: nothing is said and the round does not finish until it closes', async () => {
    await ready();
    await sortAll();
    h.sayWord.mockClear();
    fireEvent.click(badge());
    await advance(WORD_AFTER_CHIME_MS + WORD_CAP_MS + FINISH_DELAY_MS + 2000);
    expect(h.sayWord).not.toHaveBeenCalled();
    expect(root().getAttribute('data-done')).toBe('false');
    fireEvent.keyDown(document.activeElement ?? window, { key: 'Escape' });
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    await advance(FINISH_DELAY_MS);
    expect(root().getAttribute('data-done')).toBe('true');
  });

  it('unmounting mid-drag cancels timers, speech and the drag', async () => {
    const r = await ready();
    const [a, b] = ids();
    drop(a, rightBasket(a));
    await advance(WORD_AFTER_CHIME_MS);
    down(b);
    move(1100, 700);
    const removed = vi.spyOn(window, 'removeEventListener');
    r.unmount();
    expect(removed.mock.calls.some((c) => c[0] === 'pointermove')).toBe(true);
    expect(h.stopWord).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
    h.sayWord.mockClear();
    move(1200, 700);
    up(1200, 700);
    await advance(10000);
    expect(h.sayWord).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('unmounting mid-slide and mid-popup leaves no timers', async () => {
    const r = await ready();
    const id = ids()[0];
    drop(id, wrongBasket(id));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    r.unmount();
    expect(h.stopWord).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reduced motion: hm-reduced on the root, a wrong drop jumps straight back, sounds stay', async () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {} }) });
    await ready();
    expect(root().classList.contains('hm-reduced')).toBe(true);
    const id = ids()[0];
    drop(id, wrongBasket(id));
    expect(h.ohOh).toHaveBeenCalledTimes(1);
    expect(popup()).not.toBeNull();
    expect(stateOf(id)).toBe('idle');
  });

  it('a right drop stops a still-playing oh-oh before the chime', async () => {
    const stop = vi.fn();
    h.ohOh.mockReturnValue({ ms: 1900, stop });
    await ready();
    const [a, b] = ids();
    drop(a, wrongBasket(a));
    expect(stop).not.toHaveBeenCalled();
    await advance(SLIDE_BACK_MS);
    drop(b, rightBasket(b));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(h.chime.mock.invocationCallOrder[0]);
  });

  it('reads the custom oh-oh path from settings', async () => {
    h.settings.mockResolvedValue({ ohoh_path: 'sfx/oh.mp3' });
    await ready();
    expect(h.settings).toHaveBeenCalled();
    const id = ids()[0];
    drop(id, wrongBasket(id));
    expect(h.ohOh).toHaveBeenCalledWith('/media/sfx/oh.mp3');
  });
});
