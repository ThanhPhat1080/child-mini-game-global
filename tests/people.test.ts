import { describe, expect, it } from 'vitest';
import { initials, matches, mb, sortBy, usageLevel } from '@/lib/people';

// N10-N12: shared helpers for the Super Admin people pages.

describe('initials (N10)', () => {
  it('takes the first letter of the first and last word, uppercased', () => {
    expect(initials('nguyen van an')).toBe('NA');
    expect(initials('  lan  ')).toBe('L');
    expect(initials('Mai Thị Hoa')).toBe('MH');
  });
  it('falls back to ? for an empty name', () => {
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });
});

describe('sortBy (N10, N15, N17)', () => {
  const rows = [
    { id: 'a', created: '2026-11-01T00:00:00Z', name: 'Bao' },
    { id: 'b', created: '2026-11-03T00:00:00Z', name: 'an' },
    { id: 'c', created: '2026-11-02T00:00:00Z', name: 'Cu' },
  ];
  const pick = (r: (typeof rows)[number]) => ({ created: r.created, name: r.name });

  it('newest first by created date', () => {
    expect(sortBy(rows, 'newest', pick).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
  it('A to Z ignores case', () => {
    expect(sortBy(rows, 'az', pick).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });
  it('does not change the input array', () => {
    const copy = [...rows];
    sortBy(rows, 'az', pick);
    expect(rows).toEqual(copy);
  });
});

describe('matches (N10, N15)', () => {
  it('an empty query matches everything', () => {
    expect(matches('  ', 'Lan')).toBe(true);
  });
  it('is case-insensitive and ignores accents, including đ', () => {
    expect(matches('nguyen', 'NGUYỄN Văn An')).toBe(true);
    expect(matches('dao', 'Đào Thị')).toBe(true);
    expect(matches('LAN', 'Mai', 'Lan')).toBe(true);
  });
  it('matches when any field contains the query', () => {
    expect(matches('zz', 'Lan', null, undefined)).toBe(false);
    expect(matches('mia', null, 'Mia')).toBe(true);
  });
});

describe('usageLevel (N10)', () => {
  const MB = 1024 * 1024;
  it('is ok below 70%', () => {
    expect(usageLevel(0, 50 * MB)).toBe('ok');
    expect(usageLevel(34.9 * MB, 50 * MB)).toBe('ok');
  });
  it('is warn from 70% to 85%, both included', () => {
    expect(usageLevel(35 * MB, 50 * MB)).toBe('warn');
    expect(usageLevel(42.5 * MB, 50 * MB)).toBe('warn');
  });
  it('is high above 85%', () => {
    expect(usageLevel(42.6 * MB, 50 * MB)).toBe('high');
    expect(usageLevel(60 * MB, 50 * MB)).toBe('high');
  });
  it('a zero quota is high once anything is used', () => {
    expect(usageLevel(0, 0)).toBe('ok');
    expect(usageLevel(1, 0)).toBe('high');
  });
});

describe('mb (N10)', () => {
  it('rounds to whole megabytes', () => {
    expect(mb(0)).toBe(0);
    expect(mb(1.26 * 1024 * 1024)).toBe(1);
    expect(mb(12.6 * 1024 * 1024)).toBe(13);
  });
});
