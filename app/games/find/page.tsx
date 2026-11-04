'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { FindHelp } from '@/components/FindHelp';
import { FindLevelTile } from '@/components/find/FindLevelTile';
import { fetchActiveFindLevels } from '@/lib/find/levels';
import type { FindLevel } from '@/lib/find/types';
import { gridStep } from '@/lib/keynav';

const COLS = 4;
const links = () => Array.from(document.querySelectorAll<HTMLElement>('a[data-level-link]'));

/** Find It level select (F1): a grid of big-picture thumbnails, active playable levels only. */
export default function FindLevels() {
  const [levels, setLevels] = useState<FindLevel[] | null>(null);
  const [help, setHelp] = useState(false);
  const helpBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    fetchActiveFindLevels().then((l) => live && setLevels(l), () => live && setLevels([]));
    return () => { live = false; };
  }, []);

  const any = !!levels && levels.length > 0;

  useEffect(() => {
    if (any) links()[0]?.focus();
  }, [any]);
  useEffect(() => {
    if (help) return;
    const onKey = (e: KeyboardEvent) => {
      if (gridStep(links(), COLS, e)) return;
      const active = document.activeElement as HTMLElement | null;
      if (e.key === ' ' && active && active.tagName === 'A' && links().includes(active)) {
        e.preventDefault();
        active.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [help]);

  return (
    <Stage>
      <Hills />
      <div style={{ position: 'absolute', top: 48, zIndex: 2, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <BackButton href="/games" label="Back to games" />
        <button
          ref={helpBtn}
          type="button"
          className="hm-tap"
          aria-label="What is Find It? Show how to play"
          onClick={() => setHelp(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 16, height: 120, padding: '0 40px 0 28px', borderRadius: 60, background: '#fff', border: '8px solid #F2C9A8', boxShadow: '0 8px 0 #EADCC8', boxSizing: 'border-box', fontFamily: 'inherit' }}
        >
          <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#B5703A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
          <span style={{ fontSize: 44, fontWeight: 600, color: '#B5703A', lineHeight: 1 }}>Find It</span>
        </button>
      </div>
      {levels !== null && levels.length === 0 && (
        <div role="status" aria-label="New levels are coming soon" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg aria-hidden="true" width="480" height="480" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="4" fill="#FCEFE2" stroke="#F2C9A8" strokeWidth="0.6" />
            <circle cx="8" cy="8" r="2.4" fill="#EED79A" />
            <path d="M3 17l5-5 4 4 3-3 6 6v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#fff" />
          </svg>
        </div>
      )}
      {any && (
        <div role="group" aria-label="Choose a level" style={{ position: 'absolute', top: 220, bottom: 120, left: 0, right: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '24px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 48, width: COLS * 360 + (COLS - 1) * 48 + 16 }}>
            {levels.map((l, i) => <FindLevelTile key={l.id} level={l} index={i} />)}
          </div>
        </div>
      )}
      <MusicButton />
      {help && <FindHelp playHref={null} onClose={() => { setHelp(false); setTimeout(() => helpBtn.current?.focus(), 0); }} />}
    </Stage>
  );
}
