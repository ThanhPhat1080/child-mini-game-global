import { describe, expect, it } from 'vitest';
import { editableStem, libraryOrder, renamedPath, replacePath, safeStem, storedName } from '@/lib/mediaPaths';

describe('safeStem', () => {
  it('keeps the original name readable and ASCII-safe', () => {
    expect(safeStem('Oh ring 1.mp3')).toBe('Oh-ring-1');
    expect(safeStem('Âm thanh đẹp.wav')).toBe('Am-thanh-dep');
  });

  it('falls back to a placeholder when nothing is left', () => {
    expect(safeStem('   .mp3')).toBe('file');
  });
});

describe('storedName', () => {
  it('appends a 13-character time-based id after the original name', () => {
    const name = storedName('Ring.mp3', 'mp3');
    expect(name).toMatch(/^Ring-[0-9a-z]{13}\.mp3$/);
  });

  it('gives different names to the same file uploaded twice', () => {
    expect(storedName('Ring.mp3', 'mp3')).not.toBe(storedName('Ring.mp3', 'mp3'));
  });
});

describe('libraryOrder', () => {
  it('puts the newest upload first, older uploads after, and files from before this naming last', () => {
    const older = 'library/Ring-000000001aaaa.mp3';
    const newer = 'library/Ring-000000002bbbb.mp3';
    const legacy = 'library/1730000000000-ab12cd34.mp3';
    expect(libraryOrder([older, legacy, newer])).toEqual([newer, older, legacy]);
  });

  it('removes duplicates', () => {
    const p = 'library/Ring-000000001aaaa.mp3';
    expect(libraryOrder([p, p])).toEqual([p]);
  });
});

describe('editableStem and renamedPath', () => {
  const p = 'library/oh-ring-9j2k4m1a7b3cx.mp3';

  it('offers only the name, not the upload id or extension', () => {
    expect(editableStem(p)).toBe('oh-ring');
    expect(editableStem('cards/old.png')).toBe('old'); // uploaded before ids existed
  });

  it('keeps the folder, upload id and extension', () => {
    expect(renamedPath(p, 'Chuông reo')).toBe('library/Chuong-reo-9j2k4m1a7b3cx.mp3');
    expect(renamedPath('cards/old.png', 'new')).toBe('cards/new.png');
  });
});

describe('replacePath', () => {
  it('swaps the path anywhere inside nested data and keeps untouched parts as they were', () => {
    const other = { image: 'b.png' };
    const data = { a: [{ image: 'a.png', n: 1 }, other], z: null };
    const next = replacePath(data, 'a.png', 'c.png');
    expect(next).toEqual({ a: [{ image: 'c.png', n: 1 }, other], z: null });
    expect(next.a[1]).toBe(other);
  });

  it('returns the same object when the path is absent', () => {
    const data = { a: ['x'] };
    expect(replacePath(data, 'nope', 'y')).toBe(data);
  });
});
