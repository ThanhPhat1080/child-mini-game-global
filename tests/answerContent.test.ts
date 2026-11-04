import { describe, expect, it } from 'vitest';
import { hasAnswerContent, isQuestionComplete } from '@/lib/sets';

const base = { text: 'Where?', voice: null, correct: 0, count: 2 };

describe('answer needs a picture or a text (C4)', () => {
  it('accepts a picture, a text, or both', () => {
    expect(hasAnswerContent('a.png', '')).toBe(true);
    expect(hasAnswerContent(null, 'Apple')).toBe(true);
    expect(hasAnswerContent('a.png', 'Apple')).toBe(true);
  });
  it('rejects an answer with both empty (blank text counts as empty)', () => {
    expect(hasAnswerContent(null, '')).toBe(false);
    expect(hasAnswerContent(null, '   ')).toBe(false);
    expect(hasAnswerContent(undefined, null)).toBe(false);
  });
  it('question is complete with a text-only answer', () => {
    expect(isQuestionComplete({ ...base, imgs: ['a.png', null, null], texts: ['', 'Pear', ''] })).toBe(true);
  });
  it('question is incomplete when one used answer has neither', () => {
    expect(isQuestionComplete({ ...base, imgs: ['a.png', null, null], texts: ['', ' ', ''] })).toBe(false);
  });
  it('ignores the unused third slot', () => {
    expect(isQuestionComplete({ ...base, imgs: ['a.png', 'b.png', null], texts: ['', '', ''] })).toBe(true);
  });
});
