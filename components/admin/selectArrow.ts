import type { CSSProperties } from 'react';

/** A small chevron in the admin brown, drawn inline so no image is loaded. Spread it last: it replaces the native arrow. */
const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237A6458' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";

/**
 * The arrow of a dropdown, moved in from the border: the native one touched the right edge (admin selects).
 * Spread it after the other styles, since a `background` shorthand would otherwise remove the chevron.
 */
export const selectArrowStyle: CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: CHEVRON,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 16px center',
  backgroundSize: '16px 16px',
  paddingRight: 44,
  cursor: 'pointer',
};
