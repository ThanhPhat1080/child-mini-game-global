import { describe, expect, it } from 'vitest';
import { nextUnfinished } from '@/lib/quizProgress';

const ids = ['a', 'b', 'c', 'd'];
const done = (...x: string[]) => new Set(x);

describe('nextUnfinished', () => {
  it('goes to the next question in order', () => {
    expect(nextUnfinished(ids, 0, done('a'))).toBe(1);
    expect(nextUnfinished(ids, 1, done('a', 'b'))).toBe(2);
  });

  it('is complete only when every question is done', () => {
    expect(nextUnfinished(ids, 3, done('a', 'b', 'c', 'd'))).toBeNull();
  });

  it('finishing the last question does NOT complete the set while others are not done', () => {
    expect(nextUnfinished(ids, 3, done('d'))).toBe(0);
  });

  it('after jumping ahead, goes back to the first unfinished one', () => {
    expect(nextUnfinished(ids, 3, done('d'))).toBe(0);
    expect(nextUnfinished(ids, 3, done('d', 'a'))).toBe(1);
  });

  it('skips questions that are already done', () => {
    expect(nextUnfinished(ids, 0, done('a', 'b', 'c'))).toBe(3);
    expect(nextUnfinished(ids, 1, done('b', 'c', 'd'))).toBe(0);
  });

  it('a one-question set completes when that question is done', () => {
    expect(nextUnfinished(['x'], 0, done('x'))).toBeNull();
  });

  it('an empty set has nothing to go to', () => {
    expect(nextUnfinished([], 0, done())).toBeNull();
  });
});

import { clearProgress, firstUnfinished, loadProgress, saveProgress } from '@/lib/quizProgress';

function fakeStore(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe('progress kept on the device', () => {
  it('saves and loads the finished question ids per set', () => {
    const s = fakeStore();
    saveProgress(s, 'set1', new Set(['b', 'd']));
    saveProgress(s, 'set2', new Set(['a']));
    expect([...loadProgress(s, 'set1', ids)].sort()).toEqual(['b', 'd']);
    expect([...loadProgress(s, 'set2', ids)]).toEqual(['a']);
  });

  it('drops ids that are no longer in the set (question deleted or replaced)', () => {
    const s = fakeStore();
    saveProgress(s, 'set1', new Set(['a', 'gone']));
    expect([...loadProgress(s, 'set1', ids)]).toEqual(['a']);
  });

  it('starts empty when nothing is stored or the data is broken', () => {
    expect(loadProgress(fakeStore(), 'set1', ids).size).toBe(0);
    expect(loadProgress(fakeStore({ 'hamy:progress:set1': '{not json' }), 'set1', ids).size).toBe(0);
    expect(loadProgress(fakeStore({ 'hamy:progress:set1': '{"a":1}' }), 'set1', ids).size).toBe(0);
    expect(loadProgress(fakeStore({ 'hamy:progress:set1': '[1,null,"a"]' }), 'set1', ids)).toEqual(new Set(['a']));
  });

  it('saving nothing removes the entry; clearProgress forgets the set', () => {
    const s = fakeStore();
    saveProgress(s, 'set1', new Set(['a']));
    saveProgress(s, 'set1', new Set());
    expect(s.m.size).toBe(0);
    saveProgress(s, 'set1', new Set(['a']));
    clearProgress(s, 'set1');
    expect(s.m.size).toBe(0);
  });

  it('never throws when the storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
    expect(loadProgress(blocked, 'set1', ids).size).toBe(0);
    expect(() => saveProgress(blocked, 'set1', new Set(['a']))).not.toThrow();
    expect(() => clearProgress(blocked, 'set1')).not.toThrow();
  });

  it('resumes at the first unfinished question', () => {
    expect(firstUnfinished(ids, done('a', 'b'))).toBe(2);
    expect(firstUnfinished(ids, done('b'))).toBe(0);
    expect(firstUnfinished(ids, done())).toBe(0);
    expect(firstUnfinished(ids, done('a', 'b', 'c', 'd'))).toBe(0);
  });
});
