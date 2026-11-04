import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WRONG_KEY, clearWrong, readWrong, recordWrong, totalWrong } from '@/lib/listen/wrongLog';

const A = { id: 'a', word: 'apple' };
const B = { id: 'b', word: 'ball' };

beforeEach(() => {
  clearWrong();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('wrong-picks log', () => {
  it('counts per card in first-wrong order and stores under the key', () => {
    recordWrong(A);
    recordWrong(B);
    recordWrong(A);
    const entries = readWrong();
    expect(entries).toEqual([
      { id: 'a', word: 'apple', count: 2 },
      { id: 'b', word: 'ball', count: 1 },
    ]);
    expect(totalWrong(entries)).toBe(3);
    expect(WRONG_KEY).toBe('hamy.listen.wrong');
    expect(JSON.parse(localStorage.getItem(WRONG_KEY) as string)).toEqual(entries);
  });

  it('clearWrong empties storage and result', () => {
    recordWrong(A);
    clearWrong();
    expect(readWrong()).toEqual([]);
    expect(localStorage.getItem(WRONG_KEY)).toBeNull();
  });

  it.each([
    ['not json'],
    ['{}'],
    ['[1,2]'],
    [JSON.stringify([{ id: 'a', word: 'x', count: -1 }])],
    [JSON.stringify([{ id: 'a', word: 'x', count: 1.5 }])],
    [JSON.stringify([{ id: 'a', word: 'x', count: 0 }])],
    [JSON.stringify([{ word: 'x', count: 1 }])],
  ])('ignores junk %s and replaces it on the next record', (junk) => {
    localStorage.setItem(WRONG_KEY, junk);
    expect(readWrong()).toEqual([]);
    recordWrong(A);
    expect(readWrong()).toEqual([{ id: 'a', word: 'apple', count: 1 }]);
    expect(JSON.parse(localStorage.getItem(WRONG_KEY) as string)).toEqual([{ id: 'a', word: 'apple', count: 1 }]);
  });

  it('falls back to the in-memory copy when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => recordWrong(A)).not.toThrow();
    expect(() => recordWrong(A)).not.toThrow();
    recordWrong(B);
    expect(readWrong()).toEqual([
      { id: 'a', word: 'apple', count: 2 },
      { id: 'b', word: 'ball', count: 1 },
    ]);
    clearWrong();
    expect(readWrong()).toEqual([]);
  });

  it('keeps counting from memory when only setItem throws', () => {
    recordWrong(A);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    recordWrong(A);
    recordWrong(B);
    expect(readWrong()).toEqual([
      { id: 'a', word: 'apple', count: 2 },
      { id: 'b', word: 'ball', count: 1 },
    ]);
  });

  it('after a write in this visit, junk in storage does not change reads and the next write repairs it', () => {
    recordWrong(A);
    localStorage.setItem(WRONG_KEY, 'not json');
    expect(readWrong()).toEqual([{ id: 'a', word: 'apple', count: 1 }]);
    recordWrong(A);
    expect(JSON.parse(localStorage.getItem(WRONG_KEY) as string)).toEqual([{ id: 'a', word: 'apple', count: 2 }]);
  });

  it('treats duplicate ids in stored data as junk', () => {
    localStorage.setItem(WRONG_KEY, JSON.stringify([
      { id: 'a', word: 'apple', count: 1 },
      { id: 'a', word: 'apple', count: 2 },
    ]));
    expect(readWrong()).toEqual([]);
  });
});
