import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ yay: vi.fn(), ohOh: vi.fn(), speakKid: vi.fn(), sayWord: vi.fn(), stopWord: vi.fn() }));
vi.mock('@/lib/sfx', () => ({ yay: h.yay, ohOh: h.ohOh, speakKid: h.speakKid }));
vi.mock('@/lib/memory/cards', () => ({ sayWord: h.sayWord, stopWord: h.stopWord }));

import { QuestionModal, OPEN_GUARD_MS, OPEN_SAY_MS, RIGHT_CLOSE_MS, WRONG_POPUP_MS } from '@/components/pairs/QuestionModal';
import type { DrawnQuestion } from '@/lib/pairs/questions';
import type { MemoryCard } from '@/lib/memory/types';
import type { QuizQuestion } from '@/lib/quiz/playable';

const card = (id: string): MemoryCard => ({ id, word: id, image_path: `seed/${id}.svg`, audio_path: null, active: true });
const listen: DrawnQuestion = {
  kind: 'listen',
  key: 'listen:cat',
  question: { answer: card('cat'), options: [card('dog'), card('cat'), card('fish')], answerIndex: 1 },
};
const quizQ = (n = 3): QuizQuestion => ({
  id: 'q1', position: 1, prompt_text: 'Which one is red?', prompt_image_path: 'seed/apple.svg', prompt_audio_path: null,
  read_answers: false, hide_answer_text: false,
  answers: [
    { slot: 1, image_path: 'seed/ball.svg', text: null, is_correct: false },
    { slot: 2, image_path: 'seed/apple.svg', text: null, is_correct: true },
    { slot: 3, image_path: null, text: 'blue', is_correct: false },
  ].slice(0, n),
});
const quiz = (n = 3): DrawnQuestion => ({ kind: 'quiz', key: 'quiz:q1', question: quizQ(n) });
const sounds = { hooray: 'h.mp3', ohoh: 'o.mp3' };

function setup(drawn: DrawnQuestion) {
  const cb = { onRight: vi.fn(), onClose: vi.fn() };
  const ui = render(<QuestionModal drawn={drawn} sounds={sounds} {...cb} />);
  const answers = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-answer]'));
  return { cb, ui, answers };
}
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(h).forEach((f) => f.mockReset());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('QuestionModal: Listen & Pick (H5-H7)', () => {
  it('shows three pictures and says the word after the opening pause', () => {
    const { answers } = setup(listen);
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    expect(answers()).toHaveLength(3);
    expect(h.sayWord).not.toHaveBeenCalled();
    tick(OPEN_SAY_MS);
    expect(h.sayWord).toHaveBeenCalledWith(listen.kind === 'listen' ? listen.question.answer : null, expect.any(Function));
  });

  it('a wrong pick says oh-oh once, dims that answer and shows the popup for 1.4 s', () => {
    const { answers, cb } = setup(listen);
    tick(OPEN_GUARD_MS);
    fireEvent.click(answers()[0]);
    expect(h.ohOh).toHaveBeenCalledTimes(1);
    expect(h.ohOh).toHaveBeenCalledWith('o.mp3');
    expect(answers()[0].getAttribute('data-wrong')).toBe('true');
    expect(document.querySelector('[data-feedback="wrong"]')).not.toBeNull();
    fireEvent.click(answers()[0]);
    expect(h.ohOh).toHaveBeenCalledTimes(1);
    tick(WRONG_POPUP_MS);
    expect(document.querySelector('[data-feedback="wrong"]')).toBeNull();
    expect(cb.onRight).not.toHaveBeenCalled();
  });

  it('the right pick says hooray and calls onRight once after 1.2 s; later clicks do nothing', () => {
    const { answers, cb } = setup(listen);
    tick(OPEN_GUARD_MS);
    fireEvent.click(answers()[1]);
    expect(h.yay).toHaveBeenCalledWith('h.mp3');
    fireEvent.click(answers()[1]);
    fireEvent.click(answers()[0]);
    expect(h.ohOh).not.toHaveBeenCalled();
    tick(RIGHT_CLOSE_MS - 1);
    expect(cb.onRight).not.toHaveBeenCalled();
    tick(1);
    expect(cb.onRight).toHaveBeenCalledTimes(1);
    tick(5000);
    expect(cb.onRight).toHaveBeenCalledTimes(1);
  });
});

describe('QuestionModal: Quiz (H5)', () => {
  it('shows the prompt picture and text and three numbered answers, and says the prompt', () => {
    const { answers } = setup(quiz());
    expect(screen.getByText('Which one is red?')).toBeTruthy();
    expect(document.querySelector('[data-prompt-image] img')).not.toBeNull();
    expect(answers()).toHaveLength(3);
    expect(answers().map((a) => a.querySelector('.hm-num')?.textContent)).toEqual(['1', '2', '3']);
    tick(OPEN_SAY_MS);
    expect(h.sayWord).toHaveBeenCalledWith({ word: 'Which one is red?', audio_path: null }, expect.any(Function));
  });

  it('plays the prompt recording when there is one', () => {
    setup({ kind: 'quiz', key: 'quiz:q1', question: { ...quizQ(), prompt_text: null, prompt_audio_path: 'p.mp3' } });
    tick(OPEN_SAY_MS);
    expect(h.sayWord).toHaveBeenCalledWith({ word: '', audio_path: 'p.mp3' }, expect.any(Function));
  });

  it('key 2 picks the second answer, R replays', () => {
    const { cb } = setup(quiz());
    tick(OPEN_SAY_MS);
    h.sayWord.mockClear();
    fireEvent.keyDown(window, { key: 'r' });
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: '2' });
    expect(h.yay).toHaveBeenCalledTimes(1);
    tick(RIGHT_CLOSE_MS);
    expect(cb.onRight).toHaveBeenCalledTimes(1);
  });

  it('a two-answer question has two answers and key 3 does nothing', () => {
    const { answers } = setup(quiz(2));
    expect(answers()).toHaveLength(2);
    fireEvent.keyDown(window, { key: '3' });
    expect(h.yay).not.toHaveBeenCalled();
    expect(h.ohOh).not.toHaveBeenCalled();
  });
});

describe('QuestionModal: closing (H5)', () => {
  it('X, Esc and a backdrop click close it without onRight; a click inside does not', () => {
    const { cb } = setup(listen);
    tick(OPEN_GUARD_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(document.querySelector('[data-backdrop]') as HTMLElement);
    fireEvent.click(screen.getByRole('dialog'));
    expect(cb.onClose).toHaveBeenCalledTimes(3);
    expect(cb.onRight).not.toHaveBeenCalled();
  });

  it('focuses the first answer', () => {
    const { answers } = setup(listen);
    tick(0);
    expect(document.activeElement).toBe(answers()[0]);
  });

  it('unmount stops speech and pending timers never call onRight', () => {
    const { answers, cb, ui } = setup(listen);
    tick(OPEN_GUARD_MS);
    fireEvent.click(answers()[1]);
    ui.unmount();
    expect(h.stopWord).toHaveBeenCalled();
    tick(5000);
    expect(cb.onRight).not.toHaveBeenCalled();
  });
});

describe('QuestionModal: opening guard (H5, H11)', () => {
  it('a click on an answer within the guard does nothing; after OPEN_GUARD_MS it picks', () => {
    const { answers } = setup(listen);
    tick(100);
    fireEvent.click(answers()[1]);
    expect(h.yay).not.toHaveBeenCalled();
    fireEvent.click(answers()[0]);
    expect(h.ohOh).not.toHaveBeenCalled();
    expect(answers()[0].getAttribute('data-wrong')).toBe('false');
    tick(OPEN_GUARD_MS - 100);
    fireEvent.click(answers()[0]);
    expect(h.ohOh).toHaveBeenCalledTimes(1);
    expect(answers()[0].getAttribute('data-wrong')).toBe('true');
  });

  it('a click on a right answer within the guard is not celebrated', () => {
    const { answers, cb } = setup(listen);
    fireEvent.click(answers()[1]);
    expect(h.yay).not.toHaveBeenCalled();
    tick(RIGHT_CLOSE_MS + OPEN_GUARD_MS);
    expect(cb.onRight).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('a keydown that repeats (a held key) does not pick, even after the guard', () => {
    const { cb } = setup(listen);
    tick(OPEN_GUARD_MS);
    fireEvent.keyDown(window, { key: '1', repeat: true });
    expect(h.ohOh).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: '2', repeat: true });
    expect(h.yay).not.toHaveBeenCalled();
    tick(RIGHT_CLOSE_MS);
    expect(cb.onRight).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: '2' });
    expect(h.yay).toHaveBeenCalledTimes(1);
  });

  it('a key 1/2/3 within the guard does nothing', () => {
    const { cb } = setup(listen);
    fireEvent.keyDown(window, { key: '2' });
    expect(h.yay).not.toHaveBeenCalled();
    tick(OPEN_GUARD_MS);
    fireEvent.keyDown(window, { key: '2' });
    expect(h.yay).toHaveBeenCalledTimes(1);
    tick(RIGHT_CLOSE_MS);
    expect(cb.onRight).toHaveBeenCalledTimes(1);
  });

  it('Esc, X and a backdrop click within the guard do nothing; after it they close', () => {
    const { cb } = setup(listen);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(document.querySelector('[data-backdrop]') as HTMLElement);
    expect(cb.onClose).not.toHaveBeenCalled();
    tick(OPEN_GUARD_MS);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(cb.onClose).toHaveBeenCalledTimes(1);
  });

  it('a press that starts on an answer and ends on the veil does not close', () => {
    const { answers, cb } = setup(listen);
    tick(OPEN_GUARD_MS);
    fireEvent.mouseDown(answers()[0]);
    fireEvent.click(document.querySelector('[data-backdrop]') as HTMLElement);
    expect(cb.onClose).not.toHaveBeenCalled();
    expect(h.ohOh).not.toHaveBeenCalled();
  });

  it('a press that starts on the veil and ends on it closes', () => {
    const { cb } = setup(listen);
    tick(OPEN_GUARD_MS);
    const veil = document.querySelector('[data-backdrop]') as HTMLElement;
    fireEvent.mouseDown(veil);
    fireEvent.click(veil);
    expect(cb.onClose).toHaveBeenCalledTimes(1);
  });
});
