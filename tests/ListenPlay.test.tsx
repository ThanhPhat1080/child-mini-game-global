import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryCard } from '@/lib/memory/types';

const h = vi.hoisted(() => ({
  fetchActiveCards: vi.fn(),
  sayWord: vi.fn(),
  stopWord: vi.fn(),
  yay: vi.fn(),
  ohOh: vi.fn(),
  recordWrong: vi.fn(),
  clearWrong: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  settings: vi.fn(),
  playFile: vi.fn(),
  applause: vi.fn(),
  speakKid: vi.fn(),
  real: {} as typeof import('@/lib/listen/wrongLog'),
}));

vi.mock('@/lib/memory/cards', () => ({ fetchActiveCards: h.fetchActiveCards, sayWord: h.sayWord, stopWord: h.stopWord }));
vi.mock('@/lib/sfx', () => ({ yay: h.yay, ohOh: h.ohOh, applause: h.applause, speakKid: h.speakKid, playFile: h.playFile, chime: vi.fn(), flipTick: vi.fn() }));
// The real wrong-picks log, wrapped in spies (so the finish reads what the page recorded).
vi.mock('@/lib/listen/wrongLog', async () => {
  h.real = await vi.importActual<typeof import('@/lib/listen/wrongLog')>('@/lib/listen/wrongLog');
  return { ...h.real, recordWrong: h.recordWrong, clearWrong: h.clearWrong };
});
vi.mock('@/lib/settings', () => ({ getMyChildSettings: () => h.settings() }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null | undefined) => (p ? `/media/${p}` : null) }));
vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: h.push, replace: h.replace }),
  usePathname: () => '/games/listen',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import ListenPlay, {
  FINISH_DELAY_MS,
  HOORAY_CAP_MS,
  NEXT_PAUSE_MS,
  SAY_AFTER_SHOW_MS,
  SAY_AFTER_WRONG_MS,
  STEP_CAP_MS,
  WRONG_POPUP_MS,
} from '@/app/games/listen/page';
import { PRELOAD_MS } from '@/lib/memory/preload';

const cards = (n: number): MemoryCard[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, word: `word${i}`, image_path: `c${i}.svg`, audio_path: null, active: true }));

const root = () => document.querySelector<HTMLElement>('[data-listen-play]')!;
const question = () => document.querySelector<HTMLElement>('[data-question-index]');
const qIndex = () => question()?.getAttribute('data-question-index') ?? null;
const answers = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-answer]'));
const rightIdx = () => answers().findIndex((b) => b.getAttribute('data-card-id') === question()!.getAttribute('data-answer-id'));
const wrongIdxs = () => [0, 1, 2].filter((i) => i !== rightIdx());
const answerId = () => question()!.getAttribute('data-answer-id');
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const badge = () => screen.getByRole('button', { name: 'What is Listen & Pick? Show how to play' });
const cancel = vi.fn();

async function ready(pool: MemoryCard[] = cards(31)) {
  h.fetchActiveCards.mockResolvedValue(pool);
  const r = render(<ListenPlay />);
  await advance(PRELOAD_MS + 10);
  return r;
}

/** Waits through the first auto-say so later counts start clean. */
async function readyAndSaid(pool?: MemoryCard[]) {
  const r = await ready(pool);
  await advance(SAY_AFTER_SHOW_MS);
  h.sayWord.mockClear();
  return r;
}

beforeEach(() => {
  vi.useFakeTimers();
  for (const f of [h.fetchActiveCards, h.sayWord, h.stopWord, h.yay, h.ohOh, h.recordWrong, h.clearWrong, h.push, h.replace, h.settings, h.playFile, h.applause, h.speakKid, cancel]) f.mockReset();
  h.recordWrong.mockImplementation((c: { id: string; word: string }) => h.real.recordWrong(c));
  h.clearWrong.mockImplementation(() => h.real.clearWrong());
  h.real.clearWrong();
  h.settings.mockResolvedValue({ hooray_path: null, ohoh_path: null, child_name: 'Hà My', complete_path: null });
  h.sayWord.mockImplementation((_card: MemoryCard, onEnd?: () => void) => onEnd?.()); // a word that finishes at once
  h.yay.mockReturnValue({ ms: 2400, stop: vi.fn() });
  h.ohOh.mockReturnValue({ ms: 1900, stop: vi.fn() });
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, writable: true, value: { cancel } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Listen & Pick play screen (L1-L5, L8, L10)', () => {
  it('exports the timing constants', () => {
    expect([SAY_AFTER_SHOW_MS, SAY_AFTER_WRONG_MS, HOORAY_CAP_MS, NEXT_PAUSE_MS, FINISH_DELAY_MS, STEP_CAP_MS]).toEqual([600, 700, 1800, 400, 1000, 4000]);
  });

  it('shows question 1 only after the preload, then says the answer word once after SAY_AFTER_SHOW_MS', async () => {
    h.fetchActiveCards.mockResolvedValue(cards(31));
    render(<ListenPlay />);
    await advance(PRELOAD_MS - 100);
    expect(answers()).toHaveLength(0);
    await advance(110);
    expect(qIndex()).toBe('0');
    expect(answers()).toHaveLength(3);
    expect(root().getAttribute('data-done')).toBe('false');
    expect(h.sayWord).not.toHaveBeenCalled();
    await advance(SAY_AFTER_SHOW_MS - 10);
    expect(h.sayWord).not.toHaveBeenCalled();
    await advance(10);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    expect(h.sayWord.mock.calls[0][0].id).toBe(answerId());
    await advance(5000);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
  });

  it('reads the custom hooray / oh-oh paths from settings', async () => {
    await ready();
    expect(h.settings).toHaveBeenCalled();
  });

  it('the speaker button and key R say the word again', async () => {
    await readyAndSaid();
    fireEvent.click(screen.getByRole('button', { name: 'Hear the word again' }));
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    expect(h.sayWord.mock.calls[0][0].id).toBe(answerId());
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.keyDown(window, { key: 'R' });
    expect(h.sayWord).toHaveBeenCalledTimes(3);
    expect(h.sayWord.mock.calls.every((c) => c[0].id === answerId())).toBe(true);
  });

  it('the first answer is focused when a question appears', async () => {
    await ready();
    expect(document.activeElement).toBe(answers()[0]);
    fireEvent.click(answers()[rightIdx()]);
    await advance(HOORAY_CAP_MS + NEXT_PAUSE_MS + 10);
    expect(qIndex()).toBe('1');
    expect(document.activeElement).toBe(answers()[0]);
  });

  it('a wrong pick: oh-oh once, dims that button, records the answer, says the word again; the question stays', async () => {
    await readyAndSaid();
    const answer = answerId();
    const [w1, w2] = wrongIdxs();
    fireEvent.click(answers()[w1]);
    expect(h.ohOh).toHaveBeenCalledTimes(1);
    expect(answers()[w1].getAttribute('data-wrong')).toBe('true');
    expect(h.recordWrong).toHaveBeenCalledTimes(1);
    expect(h.recordWrong.mock.calls[0][0].id).toBe(answer);
    await advance(SAY_AFTER_WRONG_MS - 10);
    expect(h.sayWord).not.toHaveBeenCalled();
    await advance(10);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    expect(h.sayWord.mock.calls[0][0].id).toBe(answer);
    expect(qIndex()).toBe('0');

    // the same wrong button again does nothing
    fireEvent.click(answers()[w1]);
    fireEvent.keyDown(window, { key: String(w1 + 1) });
    await advance(SAY_AFTER_WRONG_MS + 10);
    expect(h.ohOh).toHaveBeenCalledTimes(1);
    expect(h.recordWrong).toHaveBeenCalledTimes(1);
    expect(h.sayWord).toHaveBeenCalledTimes(1);

    // the other wrong one (by key) is also recorded
    fireEvent.keyDown(window, { key: String(w2 + 1) });
    expect(h.ohOh).toHaveBeenCalledTimes(2);
    expect(h.recordWrong).toHaveBeenCalledTimes(2);
    expect(h.recordWrong.mock.calls[1][0].id).toBe(answer);
    expect(answers()[w2].getAttribute('data-wrong')).toBe('true');
    expect(qIndex()).toBe('0');
    expect(h.yay).not.toHaveBeenCalled();
  });

  it('a pick stops the previous sound and the word first: oh-oh never plays over a word, hooray never over an oh-oh', async () => {
    await readyAndSaid();
    const stopOhOh = vi.fn();
    const stopYay = vi.fn();
    h.ohOh.mockReturnValue({ ms: 1900, stop: stopOhOh });
    h.yay.mockReturnValue({ ms: 2400, stop: stopYay });
    h.stopWord.mockClear();
    fireEvent.click(answers()[wrongIdxs()[0]]);
    expect(h.stopWord).toHaveBeenCalled();
    expect(h.stopWord.mock.invocationCallOrder[0]).toBeLessThan(h.ohOh.mock.invocationCallOrder[0]);
    expect(stopOhOh).not.toHaveBeenCalled();
    fireEvent.click(answers()[wrongIdxs()[1]]); // the second oh-oh stops the first
    expect(stopOhOh).toHaveBeenCalledTimes(1);
    fireEvent.click(answers()[rightIdx()]); // the hooray stops the last oh-oh
    expect(stopOhOh).toHaveBeenCalledTimes(2);
    expect(stopYay).not.toHaveBeenCalled();
  });

  it('a right pick: yay once, the word once after the hooray, the next question after the word ends + NEXT_PAUSE_MS', async () => {
    await readyAndSaid();
    const answer = answerId();
    let finish: (() => void) | undefined;
    h.sayWord.mockImplementation((_c: MemoryCard, onEnd?: () => void) => { finish = onEnd; });
    h.yay.mockReturnValue({ ms: 1000, stop: vi.fn() });
    fireEvent.click(answers()[rightIdx()]);
    expect(h.yay).toHaveBeenCalledTimes(1);
    expect(h.ohOh).not.toHaveBeenCalled();
    expect(h.recordWrong).not.toHaveBeenCalled();
    await advance(990);
    expect(h.sayWord).not.toHaveBeenCalled();
    await advance(10);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    expect(h.sayWord.mock.calls[0][0].id).toBe(answer);
    await advance(1500); // the word is still playing
    expect(qIndex()).toBe('0');
    act(() => finish?.());
    await advance(NEXT_PAUSE_MS - 10);
    expect(qIndex()).toBe('0');
    await advance(10);
    expect(qIndex()).toBe('1');
    expect(answers().every((b) => b.getAttribute('data-wrong') === 'false')).toBe(true);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
  });

  it('the hooray wait is capped at HOORAY_CAP_MS (also when yay returns nothing)', async () => {
    await readyAndSaid();
    h.yay.mockReturnValue(undefined);
    fireEvent.click(answers()[rightIdx()]);
    await advance(HOORAY_CAP_MS - 10);
    expect(h.sayWord).not.toHaveBeenCalled();
    await advance(10);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
  });

  it('a voice that never ends: the next question comes at STEP_CAP_MS after the pick', async () => {
    await readyAndSaid();
    h.sayWord.mockImplementation(() => undefined);
    fireEvent.click(answers()[rightIdx()]);
    await advance(STEP_CAP_MS - 10);
    expect(qIndex()).toBe('0');
    await advance(10);
    expect(qIndex()).toBe('1');
    await advance(STEP_CAP_MS);
    expect(qIndex()).toBe('1'); // the cap advanced once only
  });

  it('picks during the hooray pause are ignored: one advance, one yay, one word', async () => {
    await readyAndSaid();
    const r = rightIdx();
    fireEvent.click(answers()[r]);
    fireEvent.click(answers()[r]);
    fireEvent.click(answers()[(r + 1) % 3]);
    for (const k of ['1', '2', '3']) fireEvent.keyDown(window, { key: k });
    fireEvent.keyDown(window, { key: 'r' }); // no replay over the hooray
    fireEvent.click(screen.getByRole('button', { name: 'Hear the word again' }));
    expect(h.yay).toHaveBeenCalledTimes(1);
    expect(h.ohOh).not.toHaveBeenCalled();
    expect(h.recordWrong).not.toHaveBeenCalled();
    await advance(HOORAY_CAP_MS + NEXT_PAUSE_MS + 10);
    expect(qIndex()).toBe('1');
    expect(h.sayWord).toHaveBeenCalledTimes(1); // the right word; question 2's word comes later
    await advance(STEP_CAP_MS);
    expect(qIndex()).toBe('1');
    expect(h.yay).toHaveBeenCalledTimes(1);
  });

  it('keys 1/2/3 pick and Left/Right move the focus among the answers', async () => {
    await readyAndSaid();
    expect(document.activeElement).toBe(answers()[0]);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(answers()[1]);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(answers()[2]);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(answers()[1]);
    fireEvent.keyDown(window, { key: String(rightIdx() + 1) });
    expect(h.yay).toHaveBeenCalledTimes(1);
  });

  it('Esc goes back to the game list', async () => {
    await ready();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games');
  });

  it('while the help popup is open the page keys do nothing; its Esc closes only the popup', async () => {
    await readyAndSaid();
    fireEvent.click(badge());
    expect(screen.getByRole('dialog', { name: 'How to play Listen & Pick' })).toBeTruthy();
    const focused = document.activeElement;
    for (const k of ['ArrowRight', 'ArrowLeft', '1', '2', '3', 'r', 'R']) fireEvent.keyDown(document.activeElement ?? window, { key: k });
    expect(document.activeElement).toBe(focused);
    expect(h.yay).not.toHaveBeenCalled();
    expect(h.ohOh).not.toHaveBeenCalled();
    expect(h.sayWord).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement ?? window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.push).not.toHaveBeenCalled();
    expect(qIndex()).toBe('0');
    await advance(10);
    expect(document.activeElement).toBe(badge());
    // closed again: the keys work
    fireEvent.keyDown(window, { key: String(rightIdx() + 1) });
    expect(h.yay).toHaveBeenCalledTimes(1);
  });

  describe('help popup open while the round moves on', () => {
    const dialog = () => screen.getByRole('dialog', { name: 'How to play Listen & Pick' });
    const inDialog = () => dialog().contains(document.activeElement);
    const pressInDialog = () => {
      for (const k of ['Enter', ' ', '1', '2', '3', 'r']) fireEvent.keyDown(document.activeElement ?? window, { key: k });
    };
    const closeHelp = () => fireEvent.keyDown(document.activeElement ?? window, { key: 'Escape' });

    it('opened during the hooray pause: the round waits, nothing is said, focus stays in the popup; it goes on after closing', async () => {
      await readyAndSaid();
      fireEvent.click(answers()[rightIdx()]);
      expect(h.yay).toHaveBeenCalledTimes(1);
      fireEvent.click(badge());
      expect(inDialog()).toBe(true);
      await advance(STEP_CAP_MS + 5000);
      expect(qIndex()).toBe('0');
      expect(h.sayWord).not.toHaveBeenCalled();
      expect(inDialog()).toBe(true);
      pressInDialog();
      expect(h.yay).toHaveBeenCalledTimes(1);
      expect(h.ohOh).not.toHaveBeenCalled();
      expect(h.recordWrong).not.toHaveBeenCalled();
      expect(h.sayWord).not.toHaveBeenCalled();

      closeHelp();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(h.push).not.toHaveBeenCalled();
      expect(h.sayWord).toHaveBeenCalledTimes(1); // the right word, once, after the popup
      await advance(NEXT_PAUSE_MS + 10);
      expect(qIndex()).toBe('1');
      expect(document.activeElement).toBe(answers()[0]);
      await advance(SAY_AFTER_SHOW_MS);
      expect(h.sayWord).toHaveBeenCalledTimes(2);
      expect(h.yay).toHaveBeenCalledTimes(1);
    });

    it('a voice that never ends after closing: the next question still comes within STEP_CAP_MS of closing', async () => {
      await readyAndSaid();
      h.sayWord.mockImplementation(() => undefined);
      fireEvent.click(answers()[rightIdx()]);
      fireEvent.click(badge());
      await advance(STEP_CAP_MS + 1000);
      closeHelp();
      expect(h.sayWord).toHaveBeenCalledTimes(1);
      await advance(STEP_CAP_MS - 10);
      expect(qIndex()).toBe('0');
      await advance(10);
      expect(qIndex()).toBe('1');
    });

    it('opened while loading: question 1 appears behind it without taking focus or speaking; closing focuses answer 1 and says the word', async () => {
      h.fetchActiveCards.mockResolvedValue(cards(31));
      render(<ListenPlay />);
      fireEvent.click(badge());
      expect(inDialog()).toBe(true);
      await advance(PRELOAD_MS + 10);
      expect(qIndex()).toBe('0');
      await advance(SAY_AFTER_SHOW_MS + 5000); // the auto word's time passes under the popup
      expect(inDialog()).toBe(true);
      expect(h.sayWord).not.toHaveBeenCalled();
      pressInDialog();
      expect(h.yay).not.toHaveBeenCalled();
      expect(h.ohOh).not.toHaveBeenCalled();
      expect(h.sayWord).not.toHaveBeenCalled();

      closeHelp();
      expect(screen.queryByRole('dialog')).toBeNull();
      await advance(10);
      expect(document.activeElement).toBe(answers()[0]);
      expect(h.sayWord).toHaveBeenCalledTimes(1);
      expect(h.sayWord.mock.calls[0][0].id).toBe(answerId());
    });
  });

  it.each([
    ['fewer than 3 usable cards', () => h.fetchActiveCards.mockResolvedValue([...cards(2), { ...cards(3)[2], active: false }])],
    ['a load failure', () => h.fetchActiveCards.mockRejectedValue(new Error('boom'))],
    ['two cards with the same word only', () => h.fetchActiveCards.mockResolvedValue([...cards(2), { ...cards(3)[2], word: ' Word0 ' }])],
  ])('%s: friendly status screen, no answers', async (_name, arrange) => {
    arrange();
    render(<ListenPlay />);
    await advance(PRELOAD_MS + 10);
    expect(screen.getByRole('status', { name: 'New cards are coming soon' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(answers()).toHaveLength(0);
    expect(question()).toBeNull();
    await advance(5000);
    expect(h.sayWord).not.toHaveBeenCalled();
  });

  it('5 usable cards give 5 questions, then data-done after FINISH_DELAY_MS', async () => {
    await ready(cards(5));
    const seen = new Set<string>();
    for (let n = 0; n < 5; n++) {
      expect(qIndex()).toBe(String(n));
      seen.add(answerId()!);
      fireEvent.click(answers()[rightIdx()]);
      if (n < 4) await advance(HOORAY_CAP_MS + NEXT_PAUSE_MS + 10);
    }
    expect(seen.size).toBe(5);
    await advance(HOORAY_CAP_MS + FINISH_DELAY_MS - 10);
    expect(root().getAttribute('data-done')).toBe('false');
    await advance(10);
    expect(root().getAttribute('data-done')).toBe('true');
    expect(answers()).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Back to games' })).toBeTruthy();
    expect(h.yay).toHaveBeenCalledTimes(5);
  });

  it('31 cards give a round of 10 questions', async () => {
    await ready(cards(31));
    for (let n = 0; n < 10; n++) {
      expect(qIndex()).toBe(String(n));
      fireEvent.keyDown(window, { key: String(rightIdx() + 1) });
      await advance(HOORAY_CAP_MS + FINISH_DELAY_MS + 10);
    }
    expect(root().getAttribute('data-done')).toBe('true');
  });

  it('starting a round calls clearWrong first', async () => {
    await ready();
    expect(h.clearWrong).toHaveBeenCalled();
    expect(h.clearWrong.mock.invocationCallOrder[0]).toBeLessThan(h.fetchActiveCards.mock.invocationCallOrder[0]);
  });

  it('unmounting mid-hooray cancels timers and speech and clears the log; nothing is said afterwards', async () => {
    const r = await readyAndSaid();
    const stop = vi.fn();
    h.yay.mockReturnValue({ ms: 2400, stop });
    fireEvent.click(answers()[rightIdx()]);
    await advance(500);
    h.clearWrong.mockClear();
    r.unmount();
    expect(h.stopWord).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
    expect(h.clearWrong).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalled();
    await advance(10000);
    expect(h.sayWord).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('unmounting mid-question (before the first word, and after a wrong pick) says nothing afterwards', async () => {
    const r = await ready();
    r.unmount();
    await advance(10000);
    expect(h.sayWord).not.toHaveBeenCalled();
    cleanup();

    const r2 = await readyAndSaid();
    fireEvent.click(answers()[wrongIdxs()[0]]);
    r2.unmount();
    expect(h.stopWord).toHaveBeenCalled();
    await advance(10000);
    expect(h.sayWord).not.toHaveBeenCalled();
  });

  it('the Back link leads to the game list', async () => {
    await ready();
    expect(screen.getByRole('link', { name: 'Back to games' }).getAttribute('href')).toBe('/games');
  });

  it('reduced motion: the root gets hm-reduced', async () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }) });
    await ready();
    expect(root().classList.contains('hm-reduced')).toBe(true);
  });

  it('without reduced motion there is no hm-reduced', async () => {
    await ready();
    expect(root().classList.contains('hm-reduced')).toBe(false);
  });

  it('no card word appears in the page text', async () => {
    await ready(cards(5));
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/word\d/);
  });
  describe('finish screen (L6, L7)', () => {
    const wrongLine = () => document.querySelector('[data-wrong-line]')?.textContent;
    const wrongItems = () => Array.from(document.querySelectorAll<HTMLElement>('[data-wrong-item]'));

    /** Plays a round of `count` questions; `wrongOn` maps a question number to how many wrong picks to make first. */
    async function playThrough(count: number, wrongOn: Record<number, number> = {}) {
      const ids: string[] = [];
      for (let n = 0; n < count; n++) {
        expect(qIndex()).toBe(String(n));
        ids.push(answerId()!);
        for (const w of wrongIdxs().slice(0, wrongOn[n] ?? 0)) fireEvent.click(answers()[w]);
        fireEvent.click(answers()[rightIdx()]);
        await advance(HOORAY_CAP_MS + (n < count - 1 ? NEXT_PAUSE_MS : FINISH_DELAY_MS) + 10);
      }
      return ids;
    }

    it('shows the finish after the last right pick, from the log and the round cards', async () => {
      await ready(cards(5));
      const ids = await playThrough(5, { 0: 2, 3: 1 });
      expect(root().getAttribute('data-done')).toBe('true');
      expect(document.querySelector('[data-listen-done]')).toBeTruthy();
      expect(screen.getByRole('heading').textContent).toBe('You did it, Hà My!');
      expect(wrongLine()).toBe('Wrong 3 times');
      expect(wrongItems().map((e) => e.getAttribute('aria-label'))).toEqual([`Hear word${ids[0].slice(1)}`, `Hear word${ids[3].slice(1)}`]);
      expect(wrongItems()[0].textContent).toContain('x2');
      expect(wrongItems()[1].textContent).not.toContain('x2');
      expect(new URL(wrongItems()[0].querySelector('img')!.src).pathname).toBe(`/media/${ids[0]}.svg`);
      expect(screen.getAllByRole('link', { name: 'Back to games' })).toHaveLength(1);
      expect(h.settings).toHaveBeenCalled();
      h.sayWord.mockClear();
      fireEvent.click(wrongItems()[1]);
      expect(h.sayWord.mock.calls[0][0].id).toBe(ids[3]);
    });

    it('a perfect round shows "Wrong 0 times" and no list; the custom praise file plays', async () => {
      h.settings.mockResolvedValue({ hooray_path: null, ohoh_path: null, child_name: '', complete_path: 'yay.mp3' });
      await ready(cards(5));
      await playThrough(5);
      expect(wrongLine()).toBe('Wrong 0 times');
      expect(document.querySelector('[data-wrong-list]')).toBeNull();
      expect(screen.getByRole('heading').textContent).toBe('You did it!');
      expect(h.playFile).toHaveBeenCalledWith('/media/yay.mp3');
      expect(h.applause).not.toHaveBeenCalled();
    });

    it('a settings failure still shows the finish, without a name', async () => {
      h.settings.mockRejectedValue(new Error('down'));
      await ready(cards(5));
      await playThrough(5);
      expect(screen.getByRole('heading').textContent).toBe('You did it!');
      expect(h.applause).toHaveBeenCalledTimes(1);
    });

    it('storage that throws still gives the correct count and list (memory fallback), without double counting', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
      await ready(cards(5));
      await playThrough(5, { 1: 2, 2: 1 });
      expect(wrongLine()).toBe('Wrong 3 times');
      expect(wrongItems()).toHaveLength(2);
      expect(wrongItems()[0].textContent).toContain('x2');
    });

    it('Play again clears the log, draws a new round at question 1, and the next finish starts from 0', async () => {
      await ready(cards(5));
      await playThrough(5, { 0: 1 });
      expect(wrongLine()).toBe('Wrong 1 times');
      h.clearWrong.mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
      expect(h.clearWrong).toHaveBeenCalled();
      expect(window.localStorage.getItem('hamy.listen.wrong')).toBeNull();
      await advance(PRELOAD_MS + 10);
      expect(root().getAttribute('data-done')).toBe('false');
      expect(qIndex()).toBe('0');
      expect(answers()).toHaveLength(3);
      expect(document.activeElement).toBe(answers()[0]);
      await playThrough(5);
      expect(root().getAttribute('data-done')).toBe('true');
      expect(wrongLine()).toBe('Wrong 0 times');
      expect(document.querySelector('[data-wrong-list]')).toBeNull();
    });

    it('Esc on the finish goes to /games; leaving clears the log', async () => {
      const r = await ready(cards(5));
      await playThrough(5, { 0: 1 });
      expect(document.querySelector('[data-listen-done]')).toBeTruthy();
      expect(window.localStorage.getItem('hamy.listen.wrong')).not.toBeNull();
      h.push.mockClear();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(h.push).toHaveBeenCalledTimes(1);
      expect(h.push).toHaveBeenCalledWith('/games');
      r.unmount();
      expect(window.localStorage.getItem('hamy.listen.wrong')).toBeNull();
    });

    it('arrows move between the two finish buttons', async () => {
      await ready(cards(5));
      await playThrough(5);
      const play = screen.getByRole('button', { name: 'Play again' });
      expect(document.activeElement).toBe(play);
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Back to games' }));
    });
  });
});

describe('Listen & Pick visual feedback (L4, L5)', () => {
  const wrongFx = () => document.querySelector<HTMLElement>('[data-feedback="wrong"]');
  const rightFx = () => document.querySelector<HTMLElement>('[data-feedback="right"]');

  it('exports WRONG_POPUP_MS = 1400', () => {
    expect(WRONG_POPUP_MS).toBe(1400);
  });

  it('a wrong pick wobbles the button and shows the Oh-oh popup, non-blocking, gone after WRONG_POPUP_MS', async () => {
    await readyAndSaid();
    expect(wrongFx()).toBeNull();
    const [w1] = wrongIdxs();
    fireEvent.click(answers()[w1]);
    expect(answers()[w1].classList.contains('hm-wobble')).toBe(true);
    expect(answers()[rightIdx()].classList.contains('hm-wobble')).toBe(false);
    const fx = wrongFx()!;
    expect(fx).toBeTruthy();
    expect(fx.textContent).toContain('Oh-oh');
    expect(fx.style.pointerEvents).toBe('none');
    expect(fx.querySelector('[role="status"]')).toBeTruthy();
    await advance(WRONG_POPUP_MS - 10);
    expect(wrongFx()).toBeTruthy();
    await advance(20);
    expect(wrongFx()).toBeNull();
    expect(rightFx()).toBeNull();
  });

  it('a second wrong pick restarts the popup', async () => {
    await readyAndSaid();
    const [w1, w2] = wrongIdxs();
    fireEvent.click(answers()[w1]);
    await advance(1000);
    fireEvent.click(answers()[w2]);
    await advance(WRONG_POPUP_MS - 100); // 1300 ms after the second pick, 2300 after the first
    expect(wrongFx()).toBeTruthy();
    await advance(200);
    expect(wrongFx()).toBeNull();
  });

  it('a right pick grows the button with a ring and shows the Hooray overlay until the next question', async () => {
    await readyAndSaid();
    const right = rightIdx();
    fireEvent.click(answers()[right]);
    expect(answers()[right].classList.contains('hm-picked')).toBe(true);
    expect(answers()[right].querySelector('.hm-pickring')).toBeTruthy();
    expect(wrongFx()).toBeNull();
    const fx = rightFx()!;
    expect(fx).toBeTruthy();
    expect(fx.textContent).toContain('Hooray!');
    expect(fx.textContent).not.toMatch(/Continue in/);
    await advance(HOORAY_CAP_MS + 100);
    expect(rightFx()).toBeTruthy(); // still there while the word is said
    await advance(NEXT_PAUSE_MS + 10);
    expect(qIndex()).toBe('1');
    expect(rightFx()).toBeNull();
    expect(wrongFx()).toBeNull();
    expect(answers().some((b) => b.classList.contains('hm-picked') || b.classList.contains('hm-wobble'))).toBe(false);
  });

  it('a wrong popup still showing when the right pick comes is replaced by the Hooray overlay, and nothing carries over', async () => {
    await readyAndSaid();
    fireEvent.click(answers()[wrongIdxs()[0]]);
    fireEvent.click(answers()[rightIdx()]);
    expect(wrongFx()).toBeNull();
    expect(rightFx()).toBeTruthy();
    await advance(WRONG_POPUP_MS + 50);
    expect(rightFx()).toBeTruthy();
    expect(wrongFx()).toBeNull();
  });

  it('no overlay on the finish screen, and none after Play again', async () => {
    await ready(cards(5));
    for (let n = 0; n < 5; n++) {
      fireEvent.click(answers()[rightIdx()]);
      expect(rightFx()).toBeTruthy();
      await advance(HOORAY_CAP_MS + FINISH_DELAY_MS + NEXT_PAUSE_MS + 200);
    }
    await advance(200);
    expect(root().getAttribute('data-done')).toBe('true');
    expect(rightFx()).toBeNull();
    expect(wrongFx()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    await advance(PRELOAD_MS + 10);
    expect(qIndex()).toBe('0');
    expect(rightFx()).toBeNull();
    expect(wrongFx()).toBeNull();
  });

  it('the overlays stay below the help popup', async () => {
    await readyAndSaid();
    fireEvent.click(answers()[wrongIdxs()[0]]);
    expect(Number(wrongFx()!.style.zIndex)).toBeLessThan(50);
    fireEvent.click(answers()[rightIdx()]);
    expect(Number(rightFx()!.style.zIndex)).toBeLessThan(50);
  });

  it('reduced motion: the root still renders the feedback', async () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }) });
    await readyAndSaid();
    expect(root().classList.contains('hm-reduced')).toBe(true);
    fireEvent.click(answers()[wrongIdxs()[0]]);
    expect(wrongFx()).toBeTruthy();
    fireEvent.click(answers()[rightIdx()]);
    expect(rightFx()).toBeTruthy();
  });

  it('unmounting drops the overlay timers without errors', async () => {
    const r = await readyAndSaid();
    fireEvent.click(answers()[wrongIdxs()[0]]);
    r.unmount();
    await advance(WRONG_POPUP_MS + 100);
    expect(wrongFx()).toBeNull();
  });
});
