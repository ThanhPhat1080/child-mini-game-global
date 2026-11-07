import { describe, expect, it } from 'vitest';
import { drawQuestion, pickListenQuestion, type QuestionSources } from '@/lib/pairs/questions';
import type { MemoryCard } from '@/lib/memory/types';
import type { QuizQuestion } from '@/lib/quiz/playable';

const card = (id: string, word = id): MemoryCard => ({ id, word, image_path: `seed/${id}.svg`, audio_path: null, active: true });
const quizQ = (id: string): QuizQuestion => ({
  id, position: 1, prompt_text: 'Which?', prompt_image_path: null, prompt_audio_path: null,
  read_answers: false, hide_answer_text: false,
  answers: [
    { slot: 1, image_path: 'a.png', text: null, is_correct: true },
    { slot: 2, image_path: 'b.png', text: null, is_correct: false },
  ],
});
const cards = [card('cat'), card('dog'), card('fish'), card('bird')];
const both: QuestionSources = { quiz: [{ setId: 's1', questions: [quizQ('q1'), quizQ('q2')] }], cards };

/** Returns the values in turn, then repeats the last. */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[Math.min(i++, v.length - 1)];
};
function rngOf(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('drawQuestion (H4)', () => {
  it('picks Quiz or Listen with equal chance', () => {
    expect(drawQuestion(both, seq(0.2, 0.1, 0.1, 0.1), null)?.kind).toBe('quiz');
    expect(drawQuestion(both, seq(0.7, 0.1, 0.1, 0.1), null)?.kind).toBe('listen');
  });

  it('uses Listen when there is no quiz set', () => {
    for (let s = 1; s <= 20; s++) expect(drawQuestion({ quiz: [], cards }, rngOf(s), null)?.kind).toBe('listen');
  });

  it('uses Quiz when fewer than 3 different card words exist', () => {
    const few = { quiz: both.quiz, cards: [card('a'), card('b'), card('c', ' A ')] };
    for (let s = 1; s <= 20; s++) expect(drawQuestion(few, rngOf(s), null)?.kind).toBe('quiz');
  });

  it('returns null when both are empty', () => {
    expect(drawQuestion({ quiz: [], cards: [] }, rngOf(1), null)).toBeNull();
    expect(drawQuestion({ quiz: [{ setId: 's', questions: [] }], cards: [card('a')] }, rngOf(1), null)).toBeNull();
  });

  it('never chooses a set with no questions', () => {
    const src = { quiz: [{ setId: 'empty', questions: [] }, { setId: 's1', questions: [quizQ('q1')] }], cards: [] };
    for (let s = 1; s <= 20; s++) {
      const d = drawQuestion(src, rngOf(s), null);
      expect(d?.key).toBe('quiz:q1');
    }
  });

  it('never repeats the last question when another exists', () => {
    for (let s = 1; s <= 40; s++) {
      expect(drawQuestion({ quiz: [{ setId: 's', questions: [quizQ('q1'), quizQ('q2')] }], cards: [] }, rngOf(s), 'quiz:q1')?.key).toBe('quiz:q2');
      const d = drawQuestion({ quiz: [{ setId: 's', questions: [quizQ('q1')] }], cards }, rngOf(s), 'quiz:q1');
      expect(d?.kind).toBe('listen');
      const l = drawQuestion({ quiz: [], cards }, rngOf(s), 'listen:cat');
      expect(l?.key).not.toBe('listen:cat');
    }
  });

  it('repeats only when there is a single question', () => {
    expect(drawQuestion({ quiz: [{ setId: 's', questions: [quizQ('q1')] }], cards: [] }, rngOf(1), 'quiz:q1')?.key).toBe('quiz:q1');
  });

  it('keys are quiz:<questionId> and listen:<cardId>', () => {
    const q = drawQuestion(both, seq(0.2, 0.1, 0.1), null)!;
    expect(q.kind === 'quiz' && q.key === `quiz:${q.question.id}`).toBe(true);
    const l = drawQuestion(both, seq(0.7, 0.1, 0.1), null)!;
    expect(l.kind === 'listen' && l.key === `listen:${l.question.answer.id}`).toBe(true);
  });
});

describe('pickListenQuestion', () => {
  it('gives three different words with the answer at answerIndex', () => {
    for (let s = 1; s <= 20; s++) {
      const q = pickListenQuestion([...cards, card('cat2', 'Cat')], rngOf(s))!;
      expect(new Set(q.options.map((c) => c.word.trim().toLowerCase())).size).toBe(3);
      expect(q.options[q.answerIndex]).toBe(q.answer);
    }
  });

  it('is null with fewer than three words and skips inactive cards', () => {
    expect(pickListenQuestion([card('a'), card('b')], rngOf(1))).toBeNull();
    expect(pickListenQuestion([card('a'), card('b'), { ...card('c'), active: false }], rngOf(1))).toBeNull();
  });
});
