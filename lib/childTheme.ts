export type Gender = 'male' | 'female';
export type AgeBand = '2-5' | '5-10';

/** Card and modal colors by gender (KT1). Text is darker than the pastel background for contrast. */
export const GENDER_THEME: Record<Gender, { bg: string; text: string; accent: string; modalBg: string; icon: '♂' | '♀'; label: 'Boy' | 'Girl' }> = {
  male: { bg: '#DCE8F1', text: '#3F6285', accent: '#8FB3D1', modalBg: '#EEF4F9', icon: '♂', label: 'Boy' },
  female: { bg: '#F8DCDF', text: '#9A4550', accent: '#E59AA1', modalBg: '#FCEFF0', icon: '♀', label: 'Girl' },
};
