'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { SpotHelp } from '@/components/SpotHelp';
import { SpotLevelTile } from '@/components/spot/SpotLevelTile';
import { fetchActiveLevels } from '@/lib/spot/levels';
import type { SpotLevel } from '@/lib/spot/types';
import { gridStep } from '@/lib/keynav';

const COLS = 4;
const links = () => Array.from(document.querySelectorAll<HTMLElement>('a[data-level-link]'));

/** Spot the Differences level select (S1): a grid of picture-A thumbnails, active levels only. */
export default function SpotLevels() {
  const [levels, setLevels] = useState<SpotLevel[] | null>(null);
  const [help, setHelp] = useState(false);
  const helpBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    fetchActiveLevels().then((l) => live && setLevels(l), () => live && setLevels([]));
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
          aria-label="What is Spot the Differences? Show how to play"
          onClick={() => setHelp(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 16, height: 120, padding: '0 40px 0 28px', borderRadius: 60, background: '#fff', border: '8px solid #A9C6DE', boxShadow: '0 8px 0 #EADCC8', boxSizing: 'border-box', fontFamily: 'inherit' }}
        >
          <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#5F88AB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
          <span style={{ fontSize: 44, fontWeight: 600, color: '#5F88AB', lineHeight: 1 }}>Spot the Differences</span>
        </button>
      </div>
      {levels !== null && levels.length === 0 && (
        <div role="status" aria-label="New levels are coming soon" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg aria-hidden="true" width="480" height="480" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="4" fill="#E3EEF7" stroke="#A9C6DE" strokeWidth="0.6" />
            <circle cx="9" cy="10" r="2.4" fill="#fff" />
            <circle cx="15" cy="14" r="2.4" fill="#fff" />
            <circle cx="12" cy="12" r="1.2" fill="#EED79A" />
          </svg>
        </div>
      )}
      {any && (
        <div role="group" aria-label="Choose a level" style={{ position: 'absolute', top: 220, bottom: 120, left: 0, right: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '24px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 48, width: COLS * 360 + (COLS - 1) * 48 + 16 }}>
            {levels.map((l, i) => <SpotLevelTile key={l.id} level={l} index={i} />)}
          </div>
        </div>
      )}
      <MusicButton />
      {help && <SpotHelp playHref={null} onClose={() => { setHelp(false); setTimeout(() => helpBtn.current?.focus(), 0); }} />}
    </Stage>
  );
}
