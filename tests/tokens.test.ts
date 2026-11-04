import { describe, expect, it } from 'vitest';
import { SLOT_COLORS } from '@/lib/tokens';

describe('slot colors', () => {
  it('fixes rose, sky, butter by position (ADR-019)', () => {
    expect(SLOT_COLORS.map((s) => s.name)).toEqual(['rose', 'sky', 'butter']);
  });
});
