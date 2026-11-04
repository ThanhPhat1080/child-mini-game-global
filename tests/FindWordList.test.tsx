import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FindObject } from '@/lib/find/types';
import { FindWordList } from '@/components/find/FindWordList';

const objects: FindObject[] = [
  { x: 0.25, y: 0.3, r: 0.06, word: 'apple', audio_path: null },
  { x: 0.5, y: 0.6, r: 0.06, word: 'ball', audio_path: null },
  { x: 0.75, y: 0.4, r: 0.06, word: 'cat', audio_path: null },
];

const row = (n: number) => screen.getByRole('button', { name: `Object ${n}: ${objects[n - 1].word}` });
const rowWrap = (n: number) => row(n).parentElement as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('FindWordList (F2, F3: the words, in object order)', () => {
  it('renders one row per object in number order, each a button named Object N: word', () => {
    render(<FindWordList objects={objects} current={0} found={[]} onSay={() => {}} />);
    const rows = screen.getAllByRole('button', { name: /^Object \d+: / });
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual(['Object 1: apple', 'Object 2: ball', 'Object 3: cat']);
    expect(rows.every((r) => r.tagName === 'BUTTON' && r.getAttribute('type') === 'button')).toBe(true);
  });

  it('the current row is marked data-current, the others are dimmed', () => {
    render(<FindWordList objects={objects} current={1} found={[]} onSay={() => {}} />);
    expect(row(2).getAttribute('data-current')).toBe('true');
    expect(row(1).getAttribute('data-current')).toBe('false');
    expect(row(1).getAttribute('data-dim')).toBe('true');
    expect(row(3).getAttribute('data-dim')).toBe('true');
    expect(row(2).getAttribute('data-dim')).toBe('false');
    expect(getComputedStyle(rowWrap(1)).opacity).toBe('0.45');
    expect(getComputedStyle(rowWrap(2)).opacity).toBe('1');
    expect(getComputedStyle(row(2).querySelector('span')!).fontWeight).toBe('800');
  });

  it('no row is current when current is -1 (done)', () => {
    render(<FindWordList objects={objects} current={-1} found={[0, 1, 2]} onSay={() => {}} />);
    expect(document.querySelectorAll('[data-current="true"]')).toHaveLength(0);
  });

  it('a found row shows a peach star beside the word and is marked data-found', () => {
    render(<FindWordList objects={objects} current={2} found={[0]} onSay={() => {}} />);
    expect(row(1).getAttribute('data-found')).toBe('true');
    const star = row(1).querySelector('svg[aria-hidden="true"]'); // inside the row button, after the word
    expect(star).not.toBeNull();
    expect(star!.querySelector('path')!.getAttribute('fill')).toBe('#B5703A');
    expect(getComputedStyle(rowWrap(1)).opacity).toBe('0.7');
    expect(row(2).getAttribute('data-found')).toBe('false');
    expect(row(2).querySelector('svg')).toBeNull();
  });

  it('each row has a speaker button, named Say word N, with a hidden svg, placed before the word', () => {
    render(<FindWordList objects={objects} current={0} found={[]} onSay={() => {}} />);
    const speaker = screen.getByRole('button', { name: 'Say word 2' });
    expect(speaker.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(speaker.compareDocumentPosition(row(2)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the speaker button calls onSay with that row index', () => {
    const onSay = vi.fn();
    render(<FindWordList objects={objects} current={0} found={[]} onSay={onSay} />);
    fireEvent.click(screen.getByRole('button', { name: 'Say word 3' }));
    expect(onSay).toHaveBeenCalledTimes(1);
    expect(onSay).toHaveBeenCalledWith(2);
  });

  it('clicking the row calls onSay with its index, for the current, dimmed and found rows alike', () => {
    const onSay = vi.fn();
    render(<FindWordList objects={objects} current={1} found={[0]} onSay={onSay} />);
    fireEvent.click(row(2)); // current
    fireEvent.click(row(3)); // dimmed
    fireEvent.click(row(1)); // found
    expect(onSay.mock.calls).toEqual([[1], [2], [0]]);
  });

  it('clicking a row plays the pop animation class, which goes away after 350 ms', () => {
    render(<FindWordList objects={objects} current={0} found={[]} onSay={() => {}} />);
    fireEvent.click(row(2));
    expect(rowWrap(2).classList.contains('hm-find-pop')).toBe(true);
    act(() => { vi.advanceTimersByTime(349); });
    expect(rowWrap(2).classList.contains('hm-find-pop')).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(rowWrap(2).classList.contains('hm-find-pop')).toBe(false);
  });

  it('a long word renders in full, with no truncation', () => {
    const long = 'hippopotamus-extraordinarily-unbelievable';
    render(<FindWordList objects={[{ ...objects[0], word: long }]} current={0} found={[]} onSay={() => {}} />);
    expect(screen.getByRole('button', { name: `Object 1: ${long}` }).textContent).toContain(long);
  });

  it('draws no text of its own: only the words from the objects', () => {
    render(<FindWordList objects={objects} current={0} found={[]} onSay={() => {}} />);
    expect(document.body.textContent).toBe('apple' + 'ball' + 'cat');
  });
});
