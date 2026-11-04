'use client';

import s from './admin-ui.module.css';
import { ghostBtn } from './editor-parts';

/** The levels in display order, each with its place in the real (play) order. Newest (the last level) first when `desc`. */
export function displayOrder<T>(list: T[], desc: boolean): { level: T; i: number }[] {
  const rows = list.map((level, i) => ({ level, i }));
  return desc ? rows.reverse() : rows;
}

/** Chevron for a level header: points down when the level is open, right when it is collapsed. */
export const Chevron = ({ open }: { open: boolean }) => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
    style={{ flex: 'none', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}><path d="M9 6l6 6-6 6" /></svg>
);

/** Sort icon + label above a level list: created, newest first (default) or oldest first. A level's number is its creation order. */
export function SortToggle({ desc, onToggle }: { desc: boolean; onToggle: () => void }) {
  const label = desc ? 'Created: newest first' : 'Created: oldest first';
  return (
    <button type="button" className={`${s.btn} ${s.ghost}`} aria-label={`Sort levels. Now ${label.toLowerCase()}. Click to reverse.`} onClick={onToggle}
      style={{ ...ghostBtn, height: 34, padding: '0 12px', fontSize: 13, alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {desc ? <><path d="M7 4v16" /><path d="M3 16l4 4 4-4" /><path d="M14 6h7M14 12h5M14 18h3" /></> : <><path d="M7 20V4" /><path d="M3 8l4-4 4 4" /><path d="M14 6h3M14 12h5M14 18h7" /></>}
      </svg>
      {label}
    </button>
  );
}
