export type Gender = 'male' | 'female';
export type AgeBand = '2-5' | '5-10';

/** Every child card, form and dialog sits on the same pale yellow; gender only changes the text and the border (KT1). */
export const CHILD_SURFACE = '#fffcf2';

/** Text is darker than the pastel border for contrast. */
export const GENDER_THEME: Record<Gender, { bg: string; text: string; accent: string; modalBg: string; hero: string; heroAlt: string; icon: '♂' | '♀'; label: 'Boy' | 'Girl' }> = {
  male: { bg: CHILD_SURFACE, text: '#3F6285', accent: '#8FB3D1', modalBg: CHILD_SURFACE, hero: '/images/prince.webp', heroAlt: 'Chibi prince with a crown and cape', icon: '♂', label: 'Boy' },
  female: { bg: CHILD_SURFACE, text: '#9A4550', accent: '#E59AA1', modalBg: CHILD_SURFACE, hero: '/images/princess.webp', heroAlt: 'Chibi princess with a magic wand', icon: '♀', label: 'Girl' },
};

/** Welcome-screen colors for a boy (FP9): the girl's pink comes from the stylesheet, these replace it. */
export const BOY_WELCOME_VARS = {
  '--w-enter': '#A9C6DE',
  '--w-enter-shadow': '#8FB3D1',
  '--w-enter-halo': 'rgba(169, 198, 222, 0.25)',
  '--w-name': '#3F6285',
  '--w-bars': '#8FB3D1',
} as const;
