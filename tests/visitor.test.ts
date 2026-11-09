// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VISITOR_COOKIE,
  VISITOR_HEAD,
  clearVisitor,
  getVisitor,
  isVisitor,
  saveVisitor,
  validateVisitor,
} from '@/lib/visitor';

// GT1 / GU6: the visitor session lives only in this browser (localStorage + a marker cookie).
const KEY = 'cp_visitor';

function cookieValue(name: string): string | null {
  for (const part of document.cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

beforeEach(() => {
  localStorage.clear();
  clearVisitor();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  clearVisitor();
});

describe('visitor session (GU6)', () => {
  it('saves and reads the same visitor, and sets the marker cookie', () => {
    saveVisitor({ name: 'Mai', gender: 'female', ageBand: '2-5' });
    expect(getVisitor()).toEqual({ name: 'Mai', gender: 'female', ageBand: '2-5' });
    expect(isVisitor()).toBe(true);
    expect(cookieValue(VISITOR_COOKIE)).toBe('1');
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify({ name: 'Mai', gender: 'female', ageBand: '2-5' }));
  });

  it('clearVisitor removes the data and the cookie', () => {
    saveVisitor({ name: 'Mai', gender: 'female', ageBand: '5-10' });
    clearVisitor();
    expect(getVisitor()).toBeNull();
    expect(isVisitor()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(cookieValue(VISITOR_COOKIE)).toBeFalsy();
  });

  it('a cookie without data is not a visitor', () => {
    document.cookie = `${VISITOR_COOKIE}=1; Path=/`;
    expect(getVisitor()).toBeNull();
    expect(isVisitor()).toBe(false);
  });

  it('bad JSON is no visitor and does not throw', () => {
    localStorage.setItem(KEY, '{not json');
    document.cookie = `${VISITOR_COOKIE}=1; Path=/`;
    expect(getVisitor()).toBeNull();
    expect(isVisitor()).toBe(false);
  });

  it('invalid stored values are no visitor', () => {
    localStorage.setItem(KEY, JSON.stringify({ name: '   ', gender: 'male', ageBand: '2-5' }));
    document.cookie = `${VISITOR_COOKIE}=1; Path=/`;
    expect(getVisitor()).toBeNull();
    localStorage.setItem(KEY, JSON.stringify({ name: 'Mai', gender: 'other', ageBand: '2-5' }));
    expect(getVisitor()).toBeNull();
  });

  it('storage that throws reads as no visitor and never throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveVisitor({ name: 'Mai', gender: 'female', ageBand: '2-5' })).not.toThrow();
    expect(getVisitor()).toBeNull();
    expect(isVisitor()).toBe(false);
    expect(() => clearVisitor()).not.toThrow();
  });

  it('exposes the head picture per gender', () => {
    expect(VISITOR_HEAD).toEqual({ male: '/images/prince-head.webp', female: '/images/princess-head.webp' });
  });
});

describe('validateVisitor', () => {
  it('trims the name and accepts a 20-character name', () => {
    const r = validateVisitor({ name: '  Mai  ', gender: 'female', ageBand: '2-5' });
    expect(r).toEqual({ ok: true, value: { name: 'Mai', gender: 'female', ageBand: '2-5' } });
    const twenty = 'a'.repeat(20);
    expect(validateVisitor({ name: twenty, gender: 'male', ageBand: '5-10' }).ok).toBe(true);
  });

  it('rejects an empty or spaces-only name', () => {
    expect(validateVisitor({ name: '', gender: 'male', ageBand: '2-5' })).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
    expect(validateVisitor({ name: '   ', gender: 'male', ageBand: '2-5' }).ok).toBe(false);
  });

  it('rejects a 21-character name and counts code points, not UTF-16 units', () => {
    expect(validateVisitor({ name: 'a'.repeat(21), gender: 'male', ageBand: '2-5' }).ok).toBe(false);
    // 20 emoji are 40 UTF-16 units but 20 code points: valid
    const emoji = '😀'.repeat(20);
    expect(validateVisitor({ name: emoji, gender: 'female', ageBand: '2-5' }).ok).toBe(true);
    expect(validateVisitor({ name: '😀'.repeat(21), gender: 'female', ageBand: '2-5' }).ok).toBe(false);
  });

  it('rejects a missing gender', () => {
    expect(validateVisitor({ name: 'Mai', gender: null, ageBand: '2-5' })).toMatchObject({ ok: false, errors: { gender: expect.any(String) } });
  });
});
