import { describe, expect, it } from 'vitest';
import { NAME_ERROR, PHONE_HINT, normalizePhone, validateName, validatePhone } from '@/lib/profile';

describe('validateName (PR6)', () => {
  it('rejects blank and over-long names', () => {
    expect(validateName('   ')).toBe(NAME_ERROR);
    expect(validateName('a'.repeat(41))).toBe(NAME_ERROR);
  });

  it('accepts a name of 1 to 40 characters', () => {
    expect(validateName(' Lan ')).toBeNull();
    expect(validateName('a'.repeat(40))).toBeNull();
  });
});

describe('phone (PR1, PR7)', () => {
  it('an empty phone is null', () => {
    expect(normalizePhone('   ')).toBeNull();
    expect(validatePhone(null)).toBeNull();
  });

  it('accepts digits with common separators, 8 to 20 characters, at least 8 digits', () => {
    expect(validatePhone('+84 912 345 678')).toBeNull();
    expect(validatePhone('0912.345.678')).toBeNull();
  });

  it('rejects letters, fewer than 8 digits, and too long values', () => {
    expect(validatePhone('0912abc678')).toBe(PHONE_HINT);
    expect(validatePhone('1234567')).toBe(PHONE_HINT);
    expect(validatePhone('1'.repeat(21))).toBe(PHONE_HINT);
  });
});
