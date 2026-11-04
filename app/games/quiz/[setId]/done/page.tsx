'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Stage } from '@/components/Stage';
import { CelebrationScene } from '@/components/CelebrationScene';
import { applause, playFile, speakKid } from '@/lib/sfx';
import { mediaUrl } from '@/lib/media';
import { MusicButton } from '@/components/MusicButton';
import { handleChoiceKey } from '@/lib/keynav';

const btn = { width: 160, height: 160, borderRadius: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' } as const;

/** Set completed (C7). Saves the star for this set (localStorage, per set id). */
export default function Done() {
  const { setId } = useParams<{ setId: string }>();
  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [custom, setCustom] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(`hamy:done:${setId}`, '1'); } catch { /* storage blocked */ }
    createSupabaseBrowserClient().from('settings').select('child_name, complete_path').eq('id', 1).single().then(({ data }) => { setName(data?.child_name ?? ''); setCustom(mediaUrl(data?.complete_path)); setLoaded(true); });
  }, [setId]);

  const spoken = useRef(false);
  useEffect(() => {
    if (spoken.current || !loaded) return;
    spoken.current = true;
    if (custom) { playFile(custom); return; }
    applause(3);
    speakKid(`You did it${name ? `, ${name}` : ''}!`, { pitch: 1.9, rate: 0.9 });
  }, [loaded, name, custom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.location.href = '/games/quiz';
      else handleChoiceKey(e, Array.from(document.querySelectorAll<HTMLElement>('a[data-done-link]')));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Stage>
      <CelebrationScene greeting={`You did it${name ? `, ${name}` : ''}!`}>
        <Link href={`/games/quiz/${setId}`} data-done-link className="hm-tap" aria-label="Play this set again" style={{ ...btn, background: '#fff', boxShadow: '0 12px 0 #EADCC8' }}>
          <svg aria-hidden="true" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#B8737B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
        </Link>
        <Link href="/games/quiz" data-done-link className="hm-tap hm-breathe" autoFocus aria-label="Choose another set" style={{ ...btn, background: '#9CC3A4', boxShadow: '0 12px 0 #7FA889' }}>
          <svg aria-hidden="true" width="80" height="80" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg>
        </Link>
        <Link href="/" data-done-link className="hm-tap" aria-label="Go home" style={{ ...btn, background: '#fff', boxShadow: '0 12px 0 #EADCC8' }}>
          <svg aria-hidden="true" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
        </Link>
      </CelebrationScene>
      <MusicButton />
    </Stage>
  );
}
