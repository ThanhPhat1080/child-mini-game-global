import { describe, expect, it } from 'vitest';
import { signInPathFor } from '@/lib/auth/signInPath';

describe('signInPathFor (FS6)', () => {
  it('from=play goes to the play sign-in', () => expect(signInPathFor('?from=play')).toBe('/play/sign-in'));
  it.each(['', '?from=PLAY', '?from=admin', '?from=https://evil.test', '?x=play'])('%s goes to the admin sign-in', (s) => {
    expect(signInPathFor(s)).toBe('/admin/sign-in');
  });
});
