'use client';

import Link from 'next/link';
import type { Level } from '@/lib/memory/deck';

const GRID: Record<Level, { cols: number; rows: number }> = {
  12: { cols: 4, rows: 3 },
  16: { cols: 4, rows: 4 },
  20: { cols: 5, rows: 4 },
  24: { cols: 6, rows: 4 },
  30: { cols: 6, rows: 5 },
};

/** Mini card-back grid: 4x3, 4x4, 5x4, 6x4 or 6x5 small rounded squares in the flower-back pink. */
function MiniGrid({ level }: { level: Level }) {
  const { cols, rows } = GRID[level];
  return (
    <span aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, width: cols * 32 + (cols - 1) * 8, margin: 'auto' }}>
      {Array.from({ length: cols * rows }, (_, i) => (
        <span key={i} style={{ aspectRatio: '1', borderRadius: 9, background: '#F8DCDF', border: '3px solid #EBB7BC', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: '#fff' }} />
        </span>
      ))}
    </span>
  );
}

const box: React.CSSProperties = {
  display: 'flex', width: 300, height: 300, borderRadius: 48, background: '#fff', border: '8px solid #EBB7BC',
  boxShadow: '0 8px 0 #EADCC8', boxSizing: 'border-box', padding: 24, fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = { fontSize: 40, fontWeight: 600, color: '#8A6A5E', lineHeight: 1 };

/** One level on the level-select screen. Enabled: a link (Enter works natively). Disabled: a dimmed button. The label is decorative. */
export function LevelButton({ level, disabled, href }: { level: Level; disabled: boolean; href: string }) {
  const label = <span aria-hidden="true" style={labelStyle}>{level} cards</span>;
  const wrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 };
  if (disabled) {
    return (
      <div data-level={level} style={{ ...wrap, opacity: 0.4 }}>
        <button type="button" disabled aria-disabled="true" aria-label={`${level} cards`} style={{ ...box, cursor: 'not-allowed' }}>
          <MiniGrid level={level} />
        </button>
        {label}
      </div>
    );
  }
  return (
    <div data-level={level} style={wrap}>
      <Link href={href} data-level-link draggable={false} className="hm-card" aria-label={`${level} cards`} style={box}>
        <MiniGrid level={level} />
      </Link>
      {label}
    </div>
  );
}
