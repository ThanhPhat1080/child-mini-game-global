import { describe, expect, it } from 'vitest';
import { isBucketPath, pathsToDelete, setMediaPaths } from '@/lib/mediaPaths';

const set = (over: Partial<Parameters<typeof setMediaPaths>[0]> = {}) => ({
  cover: 'covers/1.png',
  qs: [{ qimg: 'questions/1.png', voice: 'voices/1.mp3', imgs: ['answers/1.png', 'answers/2.png', null] }],
  ...over,
});

describe('isBucketPath', () => {
  it('only treats bucket files as deletable', () => {
    expect(isBucketPath('answers/1.png')).toBe(true);
    expect(isBucketPath('seed/apple.svg')).toBe(false);
    expect(isBucketPath('https://example.com/a.svg')).toBe(false);
    expect(isBucketPath('HTTP://example.com/a.svg')).toBe(false);
    expect(isBucketPath('')).toBe(false);
    expect(isBucketPath(null)).toBe(false);
  });
});

describe('setMediaPaths', () => {
  it('lists cover, question image, voice and answer images', () => {
    expect(setMediaPaths(set()).sort()).toEqual(['answers/1.png', 'answers/2.png', 'covers/1.png', 'questions/1.png', 'voices/1.mp3']);
  });
  it('skips blanks, seed art and external links', () => {
    const d = set({ cover: 'seed/cover.svg', qs: [{ qimg: 'https://x.test/q.svg', voice: null, imgs: [null, 'seed/a.svg', 'answers/9.png'] }] });
    expect(setMediaPaths(d)).toEqual(['answers/9.png']);
  });
});

describe('pathsToDelete', () => {
  it('deletes a replaced file', () => {
    const before = setMediaPaths(set());
    const after = setMediaPaths(set({ cover: 'covers/2.png' }));
    expect(pathsToDelete(before, after)).toEqual(['covers/1.png']);
  });
  it('deletes a removed file', () => {
    const before = setMediaPaths(set());
    const after = setMediaPaths(set({ qs: [{ qimg: null, voice: 'voices/1.mp3', imgs: ['answers/1.png', 'answers/2.png', null] }] }));
    expect(pathsToDelete(before, after)).toEqual(['questions/1.png']);
  });
  it('deletes every file of a deleted question', () => {
    const before = setMediaPaths(set());
    const after = setMediaPaths(set({ qs: [] }));
    expect(pathsToDelete(before, after).sort()).toEqual(['answers/1.png', 'answers/2.png', 'questions/1.png', 'voices/1.mp3']);
  });
  it('keeps files that are still used', () => {
    const s = set();
    expect(pathsToDelete(setMediaPaths(s), setMediaPaths(s))).toEqual([]);
  });
  it('deletes abandoned uploads but not the ones that were kept', () => {
    const after = setMediaPaths(set({ cover: 'covers/3.png' }));
    expect(pathsToDelete([], after, ['covers/2.png', 'covers/3.png'])).toEqual(['covers/2.png']);
  });
  it('on revert, removes uploads the saved state does not use', () => {
    const saved = setMediaPaths(set());
    expect(pathsToDelete([], saved, ['covers/2.png', 'answers/1.png'])).toEqual(['covers/2.png']);
  });
  it('never returns seed art or external links', () => {
    expect(pathsToDelete(['seed/a.svg', 'https://x.test/a.svg', null], [], ['seed/b.svg'])).toEqual([]);
  });
  it('keeps a file shared by several answers while any of them still uses it', () => {
    const before = ['answers/x.svg', 'answers/x.svg', 'answers/x.svg'];
    expect(pathsToDelete(before, ['answers/x.svg', 'answers/x.svg', 'answers/y.svg'])).toEqual([]);
    expect(pathsToDelete(before, ['answers/y.svg'])).toEqual(['answers/x.svg']);
  });
  it('does not repeat a path', () => {
    expect(pathsToDelete(['a/1.png'], [], ['a/1.png'])).toEqual(['a/1.png']);
  });
});

describe('pending picks', () => {
  it('are never treated as bucket files', () => {
    expect(isBucketPath('pending:abc')).toBe(false);
    expect(setMediaPaths(set({ cover: 'pending:abc' }))).not.toContain('pending:abc');
    expect(pathsToDelete(['pending:abc'], [])).toEqual([]);
  });
});
