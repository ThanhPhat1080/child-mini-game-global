export type Gender = 'male' | 'female';
export type AgeBand = '2-5' | '5-10';

/** Card and modal colors by gender (KT1). Text is darker than the pastel background for contrast. */
export const GENDER_THEME: Record<Gender, { bg: string; text: string; accent: string; modalBg: string; hero: string; heroAlt: string; icon: '♂' | '♀'; label: 'Boy' | 'Girl' }> = {
  male: { bg: '#DCE8F1', text: '#3F6285', accent: '#8FB3D1', modalBg: '#EEF4F9', hero: '/images/prince.webp', heroAlt: 'Chibi prince with a crown and cape', icon: '♂', label: 'Boy' },
  female: { bg: '#F8DCDF', text: '#9A4550', accent: '#E59AA1', modalBg: '#FCEFF0', hero: '/images/princess.webp', heroAlt: 'Chibi princess with a magic wand', icon: '♀', label: 'Girl' },
};

/** Welcome-screen colors for a boy (FP9): the girl's pink comes from the stylesheet, these replace it. */
export const BOY_WELCOME_VARS = {
  '--w-enter': '#A9C6DE',
  '--w-enter-shadow': '#8FB3D1',
  '--w-enter-halo': 'rgba(169, 198, 222, 0.25)',
  '--w-name': '#3F6285',
  '--w-bars': '#8FB3D1',
} as const;
