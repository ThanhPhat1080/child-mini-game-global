import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryCard } from '@/lib/memory/types';
import type { DrawnQuestion, QuestionSources } from '@/lib/pairs/questions';
import type { PuzzlePicture } from '@/lib/pairs/types';
import type { QuizQuestion } from '@/lib/quiz/playable';
import type { BoardProps } from '@/components/pairs/PairsBoard';

const h = vi.hoisted(() => ({
  fetchPuzzlePictures: vi.fn(),
  fetchQuestionSources: vi.fn(),
  drawQuestion: vi.fn(),
  realDraw: null as unknown as (...args: unknown[]) => unknown,
  board: null as BoardProps | null,
  sayWord: vi.fn(),
  stopWord: vi.fn(),
  yay: vi.fn(),
  ohOh: vi.fn(),
  chime: vi.fn(),
  applause: vi.fn(),
  speakKid: vi.fn(),
  playFile: vi.fn(),
  settings: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/lib/pairs/load', () => ({ fetchPuzzlePictures: h.fetchPuzzlePictures, fetchQuestionSources: h.fetchQuestionSources }));
// The real question draw, wrapped in a spy (so a test can read the keys it drew).
vi.mock('@/lib/pairs/questions', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/pairs/questions')>();
  h.realDraw = real.drawQuestion as unknown as (...args: unknown[]) => unknown;
  return { ...real, drawQuestion: h.drawQuestion };
});
// The real board, wrapped so a test can call its onJoin (joining is a drag, which jsdom cannot make).
vi.mock('@/components/pairs/PairsBoard', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/pairs/PairsBoard')>();
  const { createElement } = await import('react');
  return {
    ...real,
    PairsBoard: (props: BoardProps) => {
      h.board = props;
      return createElement(real.PairsBoard, props);
    },
  };
});
vi.mock('@/lib/memory/cards', () => ({ sayWord: h.sayWord, stopWord: h.stopWord }));
vi.mock('@/lib/sfx', () => ({ yay: h.yay, ohOh: h.ohOh, chime: h.chime, applause: h.applause, speakKid: h.speakKid, playFile: h.playFile }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: () => h.settings() }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null | undefined) => (p ? `/media/${p}` : null) }));
vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: h.push, replace: vi.fn() }),
  usePathname: () => '/games/pairs',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import PairsPlay from '@/app/games/pairs/page';
import { OPEN_GUARD_MS, RIGHT_CLOSE_MS, OPEN_SAY_MS } from '@/components/pairs/QuestionModal';
import { FINISH_MS, FLIP_MS, FLY_AT_MS, LAND_MS, SLIDE_MS } from '@/lib/pairs/timing';
import { PRELOAD_MS } from '@/lib/memory/preload';

const pic = (id: string): PuzzlePicture => ({ id, word: id, image_path: `seed/${id}.svg`, audio_path: null });
const PICS = ['fish', 'triangle', 'house', 'apple'].map(pic);
const card = (id: string): MemoryCard => ({ id, word: id, image_path: `seed/${id}.svg`, audio_path: null, active: true });
const quizQ: QuizQuestion = {
  id: 'q1', position: 1, prompt_text: 'Which one is red?', prompt_image_path: 'seed/apple.svg', prompt_audio_path: null,
  read_answers: false, hide_answer_text: false,
  answers: [
    { slot: 1, image_path: 'seed/house.svg', text: null, is_correct: false },
    { slot: 2, image_path: 'seed/apple.svg', text: null, is_correct: true },
    { slot: 3, image_path: null, text: 'blue', is_correct: false },
  ],
};
const SOURCES: QuestionSources = { quiz: [{ setId: 's1', questions: [quizQ] }], cards: PICS.map((p) => card(p.id)) };
/** A Listen & Pick question with the right answer in the middle (key 2). */
const triangleQ: DrawnQuestion = {
  kind: 'listen',
  key: 'listen:triangle',
  question: { answer: card('triangle'), options: [card('fish'), card('triangle'), card('house')], answerIndex: 1 },
};

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const pieces = () => Array.from(document.querySelectorAll<HTMLElement>('[data-piece]'));
const pieceOf = (id: string) => document.querySelector<HTMLElement>(`[data-piece="${id}"]`)!;
const hit = (id: string) => pieceOf(id).querySelector<HTMLElement>('[data-hit]')!;
const shelf = () => Array.from(document.querySelectorAll<HTMLElement>('[data-shelf-place]'));
const filled = () => shelf().filter((s) => s.getAttribute('data-filled') === 'true');
const dialog = () => screen.queryByRole('dialog');
const upCount = () => pieces().filter((p) => p.getAttribute('data-up') === 'true').length;

async function ready(sources: QuestionSources = SOURCES) {
  h.fetchQuestionSources.mockResolvedValue(sources);
  const r = render(<PairsPlay />);
  await advance(PRELOAD_MS + 10);
  return r;
}

/** Seeded Math.random, so the deal is the same on every run. */
function seedRandom() {
  let seed = 7;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  seedRandom();
  for (const f of [h.fetchPuzzlePictures, h.fetchQuestionSources, h.drawQuestion, h.sayWord, h.stopWord, h.yay, h.ohOh, h.chime, h.applause, h.speakKid, h.playFile, h.settings, h.push]) f.mockReset();
  h.drawQuestion.mockImplementation((...args: unknown[]) => h.realDraw(...args));
  h.fetchPuzzlePictures.mockResolvedValue(PICS);
  h.settings.mockResolvedValue({ hooray_path: null, ohoh_path: null, child_name: 'childPlayer', complete_path: null });
  h.sayWord.mockImplementation((_c: unknown, onEnd?: () => void) => onEnd?.());
  h.yay.mockReturnValue(undefined);
  h.ohOh.mockReturnValue(undefined);
  h.board = null;
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Puzzle Pairs play screen (H1-H3, H9, H10, H12)', () => {
  it('shows the friendly loading screen until the data arrives, then 8 face-down halves and 4 empty shelf places', async () => {
    let release!: (v: PuzzlePicture[]) => void;
    h.fetchPuzzlePictures.mockReturnValue(new Promise((r) => { release = r; }));
    h.fetchQuestionSources.mockResolvedValue(SOURCES);
    render(<PairsPlay />);
    await advance(5000);
    expect(pieces()).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Back to games' })).toBeTruthy();
    release(PICS);
    await advance(PRELOAD_MS + 10);
    expect(pieces()).toHaveLength(8);
    expect(upCount()).toBe(0);
    expect(shelf()).toHaveLength(4);
    expect(filled()).toHaveLength(0);
  });

  it('the first half has the focus when the level appears', async () => {
    await ready();
    const first = h.board!.order[0];
    expect(document.activeElement?.closest('[data-piece]')?.getAttribute('data-piece')).toBe(first);
  });

  it('a click on a half opens the question; a right answer turns that half face up after 1200 ms', async () => {
    h.drawQuestion.mockReturnValueOnce(triangleQ);
    await ready();
    fireEvent.click(hit('triangle:L'));
    expect(dialog()).toBeTruthy();
    expect(pieceOf('triangle:L').getAttribute('data-up')).toBe('false');
    await advance(OPEN_SAY_MS);
    fireEvent.click(document.querySelector('[data-card-id="triangle"]')!);
    await advance(RIGHT_CLOSE_MS - 10);
    expect(dialog()).toBeTruthy();
    await advance(10);
    expect(dialog()).toBeNull();
    expect(pieceOf('triangle:L').getAttribute('data-up')).toBe('true');
    await advance(FLIP_MS);
    expect(upCount()).toBe(1);
  });

  it('closing with X keeps the half face down; opening it again draws a different question', async () => {
    await ready();
    const id = h.board!.order[0];
    fireEvent.click(hit(id));
    const first = h.drawQuestion.mock.results[0].value as DrawnQuestion;
    await advance(OPEN_GUARD_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog()).toBeNull();
    expect(pieceOf(id).getAttribute('data-up')).toBe('false');
    fireEvent.click(hit(id));
    const second = h.drawQuestion.mock.results[1].value as DrawnQuestion;
    expect(second.key).not.toBe(first.key);
    expect(h.drawQuestion.mock.calls[1][2]).toBe(first.key);
    expect(pieceOf(id).getAttribute('data-up')).toBe('false');
  });

  it('when both question sources are empty, a click turns the half over at once', async () => {
    await ready({ quiz: [], cards: [] });
    const id = h.board!.order[0];
    fireEvent.click(hit(id));
    expect(dialog()).toBeNull();
    expect(pieceOf(id).getAttribute('data-up')).toBe('true');
    await advance(FLIP_MS);
    expect(upCount()).toBe(1);
  });

  it('Esc with the question open closes only the question; no navigation', async () => {
    await ready();
    fireEvent.click(hit(h.board!.order[0]));
    expect(dialog()).toBeTruthy();
    await advance(OPEN_GUARD_MS);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialog()).toBeNull();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('Esc during the celebrated right answer does nothing', async () => {
    h.drawQuestion.mockReturnValueOnce(triangleQ);
    await ready();
    fireEvent.click(hit('triangle:L'));
    await advance(OPEN_GUARD_MS);
    fireEvent.click(document.querySelector('[data-card-id="triangle"]')!);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialog()).toBeTruthy();
    await advance(RIGHT_CLOSE_MS);
    expect(dialog()).toBeNull();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('Esc with no question open asks "Leave now?"; nothing is left until Yes', async () => {
    await ready();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Leave now?' })).toBeTruthy();
    expect(h.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(h.push).toHaveBeenCalledWith('/games');
  });

  it('Esc with no question open and No in the leave question stays on the board', async () => {
    await ready();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.push).not.toHaveBeenCalled();
    expect(pieces()).toHaveLength(8);
  });

  it('Esc closes only the open question (no leave question); the Back button then asks "Leave now?"', async () => {
    h.drawQuestion.mockReturnValueOnce(triangleQ);
    await ready();
    fireEvent.click(hit('triangle:L'));
    await advance(OPEN_GUARD_MS);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Leave now?' })).toBeNull();
    expect(dialog()).toBeNull();
    expect(h.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Back to games' }));
    expect(screen.getByRole('dialog', { name: 'Leave now?' })).toBeTruthy();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('the help badge opens How to play; Esc closes only the help', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'What is Puzzle Pairs? Show how to play' }));
    expect(screen.getByRole('dialog', { name: 'How to play Puzzle Pairs' })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('a join: chime and the word at the target, then one picture on the shelf and 6 halves on the board', async () => {
    await ready();
    act(() => h.board!.onJoin('fish:L', 'fish:R'));
    await advance(SLIDE_MS - 10);
    expect(h.chime).not.toHaveBeenCalled();
    await advance(10);
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    expect(h.sayWord).toHaveBeenCalledWith(PICS[0]);
    await advance(LAND_MS - SLIDE_MS);
    expect(filled()).toHaveLength(1);
    expect(pieces()).toHaveLength(6);
    expect(h.board!.order).not.toContain('fish:L');
    expect(h.board!.order).not.toContain('fish:R');
  });

  it('the fly to the shelf starts at FLY_AT_MS; the pair leaves the board at LAND_MS', async () => {
    await ready();
    act(() => h.board!.onJoin('house:L', 'house:R'));
    await advance(FLY_AT_MS - 10);
    expect(h.board!.joining?.phase).toBe('slide');
    await advance(10);
    expect(h.board!.joining?.phase).toBe('fly');
    expect(h.board!.joining?.shelfIndex).toBe(0);
  });

  it('after a join the keyboard focus stays on a half of the board (H11): ArrowRight moves to the next one', async () => {
    await ready();
    const before = [...h.board!.order];
    const slot = Math.min(before.indexOf('fish:L'), before.indexOf('fish:R'));
    act(() => hit('fish:L').focus());
    act(() => h.board!.onJoin('fish:L', 'fish:R'));
    await advance(LAND_MS + 10);
    expect(pieces()).toHaveLength(6);

    const order = h.board!.order;
    const focused = document.activeElement as HTMLElement;
    expect(focused.hasAttribute('data-hit')).toBe(true);
    // the half now at the joined slot (the first half when the pair was last)
    expect(focused.closest('[data-piece]')?.getAttribute('data-piece')).toBe(order[slot] ?? order[0]);

    fireEvent.keyDown(focused, { key: 'ArrowRight' });
    const next = document.activeElement as HTMLElement;
    expect(next.hasAttribute('data-hit')).toBe(true);
    expect(next.closest('[data-piece]')?.getAttribute('data-piece')).toBe(order[order.indexOf(order[slot] ?? order[0]) + 1]);
  });

  it('a second half is not opened while a join runs', async () => {
    await ready();
    act(() => h.board!.onJoin('fish:L', 'fish:R'));
    fireEvent.click(hit('house:L'));
    expect(dialog()).toBeNull();
    expect(pieceOf('house:L').getAttribute('data-up')).toBe('false');
  });

  it('four joins: after the last picture lands, 900 ms later the finish shows the 4 pictures; New level deals 8 new face-down halves', async () => {
    await ready();
    for (const p of ['fish', 'triangle', 'house', 'apple']) {
      act(() => h.board!.onJoin(`${p}:L`, `${p}:R`));
      await advance(LAND_MS + 10);
    }
    expect(filled()).toHaveLength(4);
    expect(screen.queryByRole('heading')).toBeNull();
    await advance(FINISH_MS - 10);
    expect(screen.queryByRole('heading')).toBeNull();
    await advance(10);
    expect(screen.getByRole('heading').textContent).toBe('You did it, childPlayer!');
    const shown = Array.from(document.querySelectorAll('[data-done-picture]')).map((el) => el.getAttribute('data-done-picture'));
    expect(shown).toEqual(['fish', 'triangle', 'house', 'apple']);

    fireEvent.click(screen.getByRole('button', { name: 'New level' }));
    await advance(PRELOAD_MS + 10);
    expect(pieces()).toHaveLength(8);
    expect(upCount()).toBe(0);
    expect(filled()).toHaveLength(0);
    expect(shelf()).toHaveLength(4);
  });

  it('with 3 pictures the friendly empty screen shows with a back button, and no halves', async () => {
    h.fetchPuzzlePictures.mockResolvedValue(PICS.slice(0, 3));
    await ready();
    expect(screen.getByRole('status', { name: 'New pictures are coming soon' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to games' })).toBeTruthy();
    expect(pieces()).toHaveLength(0);
  });

  it('a loader error shows LoadError; Try again loads again', async () => {
    h.fetchPuzzlePictures.mockRejectedValueOnce(new Error('offline'));
    h.fetchQuestionSources.mockResolvedValue(SOURCES);
    render(<PairsPlay />);
    await advance(PRELOAD_MS + 10);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(pieces()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await advance(PRELOAD_MS + 10);
    expect(h.fetchPuzzlePictures).toHaveBeenCalledTimes(2);
    expect(pieces()).toHaveLength(8);
  });

  it('unmount during a join: the word is stopped and no later word or chime', async () => {
    const r = await ready();
    act(() => h.board!.onJoin('house:L', 'house:R'));
    h.stopWord.mockClear();
    h.sayWord.mockClear();
    r.unmount();
    expect(h.stopWord).toHaveBeenCalled();
    await advance(LAND_MS + FINISH_MS + 1000);
    expect(h.sayWord).not.toHaveBeenCalled();
    expect(h.chime).not.toHaveBeenCalled();
  });
});
