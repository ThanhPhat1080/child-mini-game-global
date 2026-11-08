import { describe, expect, it } from 'vitest';
import { GENDER_THEME } from '@/lib/childTheme';

describe('GENDER_THEME (KT1)', () => {
  it('has the male and female entries', () => {
    expect(GENDER_THEME.male).toEqual({ bg: '#fffcf2', text: '#3F6285', accent: '#8FB3D1', modalBg: '#fffcf2', hero: '/images/prince.webp', heroAlt: 'Chibi prince with a crown and cape', icon: '♂', label: 'Boy' });
    expect(GENDER_THEME.female).toEqual({ bg: '#fffcf2', text: '#9A4550', accent: '#E59AA1', modalBg: '#fffcf2', hero: '/images/princess.webp', heroAlt: 'Chibi princess with a magic wand', icon: '♀', label: 'Girl' });
  });

  it('modal text meets WCAG AA on modalBg (FA2)', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    expect(contrast(GENDER_THEME.male.text, GENDER_THEME.male.modalBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(GENDER_THEME.female.text, GENDER_THEME.female.modalBg)).toBeGreaterThanOrEqual(4.5);
  });
});
