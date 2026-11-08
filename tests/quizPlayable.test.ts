import { describe, expect, it } from 'vitest';
import { isPlayableQuestion, sortAnswers, type QuizQuestion } from '@/lib/quiz/playable';

const q = (over: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: 'q', position: 1, prompt_text: 'Which is red?', prompt_image_path: null, prompt_audio_path: null,
  read_answers: false, hide_answer_text: false,
  answers: [
    { slot: 2, image_path: 'b.png', text: null, is_correct: false },
    { slot: 1, image_path: null, text: 'red', is_correct: true },
  ],
  ...over,
});

describe('isPlayableQuestion (the Quiz game rule)', () => {
  it('accepts prompt text or a prompt sound', () => {
    expect(isPlayableQuestion(q())).toBe(true);
    expect(isPlayableQuestion(q({ prompt_text: '  ', prompt_audio_path: 'v.mp3' }))).toBe(true);
    expect(isPlayableQuestion(q({ prompt_text: '  ' }))).toBe(false);
  });

  it('needs at least two answers, each with a picture or text', () => {
    expect(isPlayableQuestion(q({ answers: [q().answers[1]] }))).toBe(false);
    expect(isPlayableQuestion(q({ answers: [...q().answers, { slot: 3, image_path: null, text: ' ', is_correct: false }] }))).toBe(false);
  });

  it('needs exactly one right answer', () => {
    const none = q().answers.map((a) => ({ ...a, is_correct: false }));
    const two = q().answers.map((a) => ({ ...a, is_correct: true }));
    expect(isPlayableQuestion(q({ answers: none }))).toBe(false);
    expect(isPlayableQuestion(q({ answers: two }))).toBe(false);
  });

  it('sortAnswers orders by slot', () => {
    expect(sortAnswers(q()).answers.map((a) => a.slot)).toEqual([1, 2]);
  });
});
