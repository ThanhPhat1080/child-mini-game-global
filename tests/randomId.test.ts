import { afterEach, describe, expect, it } from 'vitest';
import { randomId } from '@/lib/randomId';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const original = crypto.randomUUID;

afterEach(() => {
  Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true, writable: true });
});

describe('randomId (works on plain http, where crypto.randomUUID is missing)', () => {
  it('gives a v4 UUID when randomUUID exists', () => {
    expect(randomId()).toMatch(V4);
  });

  it('gives a v4 UUID when randomUUID is missing, as on http://<LAN address>', () => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true, writable: true });
    expect(randomId()).toMatch(V4);
  });

  it('gives a different id each call', () => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true, writable: true });
    expect(randomId()).not.toBe(randomId());
  });
});
