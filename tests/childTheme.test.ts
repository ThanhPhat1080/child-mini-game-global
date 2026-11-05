import { describe, expect, it } from 'vitest';
import { GENDER_THEME } from '@/lib/childTheme';

describe('GENDER_THEME (KT1)', () => {
  it('has the male and female entries', () => {
    expect(GENDER_THEME.male).toEqual({ bg: '#DCE8F1', text: '#3F6285', accent: '#8FB3D1', icon: '♂', label: 'Boy' });
    expect(GENDER_THEME.female).toEqual({ bg: '#F8DCDF', text: '#9A4550', accent: '#E59AA1', icon: '♀', label: 'Girl' });
  });
});
