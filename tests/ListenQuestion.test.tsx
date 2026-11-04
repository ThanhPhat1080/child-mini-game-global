import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListenQuestion } from '@/components/listen/ListenQuestion';
import type { Question } from '@/lib/listen/rounds';
import type { MemoryCard } from '@/lib/memory/types';

afterEach(cleanup);

const card = (id: string, word: string): MemoryCard => ({ id, word, image_path: `seed/${word}.svg`, audio_path: null, active: true });
const A = card('a', 'apple');
const B = card('b', 'ball');
const C = card('c', 'cat');
const question: Question = { answer: B, options: [A, B, C], answerIndex: 1 };

function setup(over: Partial<Parameters<typeof ListenQuestion>[0]> = {}) {
  const props = { question, wrong: new Set<number>(), locked: false, speaking: false, onPick: vi.fn(), onReplay: vi.fn(), ...over };
  render(<ListenQuestion {...props} />);
  return props;
}
const answers = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-answer]'));

describe('ListenQuestion', () => {
  it('renders three numbered answers in the Quiz colors with card ids', () => {
    setup();
    const a = answers();
    expect(a).toHaveLength(3);
    expect(a.map((b) => b.getAttribute('aria-label'))).toEqual(['Answer 1', 'Answer 2', 'Answer 3']);
    expect(a.map((b) => b.getAttribute('data-card-id'))).toEqual(['a', 'b', 'c']);
    expect(a.map((b) => b.getAttribute('data-wrong'))).toEqual(['false', 'false', 'false']);
    expect(a.map((b) => b.textContent)).toEqual(['1', '2', '3']);
    expect(a.map((b) => b.style.borderColor)).toEqual(['rgb(229, 154, 161)', 'rgb(143, 179, 209)', 'rgb(229, 201, 121)']);
    expect(a.map((b) => b.style.background)).toEqual(['rgb(248, 220, 223)', 'rgb(220, 232, 241)', 'rgb(247, 236, 203)']);
  });

  it('never shows a card word anywhere in the DOM text', () => {
    setup();
    const text = document.body.textContent ?? '';
    for (const w of ['apple', 'ball', 'cat']) expect(text.toLowerCase()).not.toContain(w);
  });

  it('a click calls onPick with its index', () => {
    const p = setup();
    fireEvent.click(answers()[2]);
    expect(p.onPick).toHaveBeenCalledWith(2);
  });

  it('a wrong answer is dimmed, aria-disabled, focusable and ignores clicks', () => {
    const p = setup({ wrong: new Set([0]) });
    const b = answers()[0];
    expect(b.getAttribute('data-wrong')).toBe('true');
    expect(b.getAttribute('aria-disabled')).toBe('true');
    expect(b.disabled).toBe(false);
    expect(Number(b.style.opacity)).toBeLessThan(1);
    b.focus();
    expect(document.activeElement).toBe(b);
    fireEvent.click(b);
    expect(p.onPick).not.toHaveBeenCalled();
    expect(answers()[1].getAttribute('aria-disabled')).not.toBe('true');
  });

  it('locked ignores every click', () => {
    const p = setup({ locked: true });
    answers().forEach((b) => fireEvent.click(b));
    expect(p.onPick).not.toHaveBeenCalled();
  });

  it('the speaker is labelled, marked data-replay and calls onReplay', () => {
    const p = setup();
    const s = screen.getByRole('button', { name: 'Hear the word again' });
    expect(s.hasAttribute('data-replay')).toBe(true);
    fireEvent.click(s);
    expect(p.onReplay).toHaveBeenCalledTimes(1);
  });

  it('speaking adds the pulse class to the speaker', () => {
    setup({ speaking: true });
    expect(screen.getByRole('button', { name: 'Hear the word again' }).className).toContain('hm-ls-speaking');
  });

  it('a broken picture shows a plain placeholder and the button still works', () => {
    const p = setup();
    const img = answers()[0].querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    fireEvent.error(img);
    expect(answers()[0].querySelector('img')).toBeNull();
    expect(answers()[0].querySelector('[data-placeholder]')).not.toBeNull();
    fireEvent.click(answers()[0]);
    expect(p.onPick).toHaveBeenCalledWith(0);
  });
});
