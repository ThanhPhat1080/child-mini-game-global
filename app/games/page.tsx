'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { mediaUrl } from '@/lib/media';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { AvatarSay } from '@/components/AvatarSay';
import { isPressKey } from '@/lib/keynav';
import { GAMES } from '@/lib/games/registry';
import { GameArt, GameIcon } from '@/components/games/GameArt';

const PITCH = 712;
const N = GAMES.length;
const TITLE = { quiz: 'Quiz', memory: 'Memory Match', listen: 'Listen & Pick', sort: 'Sort It', spot: 'Spot the Differences', find: 'Find It' } as const;
const BORDER = { quiz: '#EBB7BC', memory: '#A9CDB1', listen: '#C9BFE4', sort: '#EAD9A0', spot: '#A9C6DE', find: '#F2C9A8' } as const;

/** Game list carousel (C2) — mirrors the GameList board: drag/arrows/keys, 120px swipe threshold. */
export default function Games() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [initials, setInitials] = useState('HM');
  const [avatar, setAvatar] = useState<string | null>(null);
  const startX = useRef(0);
  const scale = useRef(1);
  const moved = useRef(false);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createSupabaseBrowserClient().from('settings').select('child_name, avatar_path').eq('id', 1).single().then(({ data }) => {
      if (!data) return;
      const w = (data.child_name ?? '').trim().split(/\s+/).filter(Boolean);
      if (w.length) setInitials(w.map((x: string) => x[0]).join('').slice(0, 2).toUpperCase());
      setAvatar(mediaUrl(data.avatar_path));
    });
    viewRef.current?.focus();
  }, []);

  const go = (d: number) => { setIdx((v) => Math.max(0, Math.min(N - 1, v + d))); setDx(0); setDragging(false); };
  const base = 640 - idx * PITCH;
  const trans = dragging ? 'none' : 'transform .7s cubic-bezier(.3,.7,.2,1), opacity .7s ease';
  const card = (i: number) => ({
    flex: 'none', width: 640, height: 640, borderRadius: 64, background: '#fff', boxShadow: '0 18px 0 #E3CFC0', boxSizing: 'border-box' as const,
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 30,
    transform: `scale(${i === idx ? 1 : 0.86})`, opacity: i === idx ? 1 : 0.7, transition: trans, color: '#5A4038',
  });

  return (
    <Stage>
      <Hills />
      <div
        ref={viewRef}
        className="hm-view"
        tabIndex={0}
        aria-label="Games. Use left and right arrows or drag to browse."
        style={{ position: 'absolute', inset: 0 }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
          else if (isPressKey(e) && GAMES[idx].ready && e.target === e.currentTarget) { e.preventDefault(); router.push(GAMES[idx].href); }
        }}
        onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); scale.current = r.width / 1920 || 1; startX.current = e.clientX; moved.current = false; setDragging(true); setDx(0); }}
        onPointerMove={(e) => { if (!dragging) return; const d = (e.clientX - startX.current) / scale.current; setDx(d); if (Math.abs(d) > 10) moved.current = true; }}
        onPointerUp={() => { if (!dragging) return; let n = idx; if (dx < -120) n = Math.min(N - 1, n + 1); else if (dx > 120) n = Math.max(0, n - 1); setIdx(n); setDx(0); setDragging(false); }}
        onPointerCancel={() => { setDragging(false); setDx(0); }}
        onPointerLeave={() => { if (dragging) { setDragging(false); setDx(0); } }}
      >
        <div style={{ position: 'absolute', top: 210, left: 0, display: 'flex', gap: 72, transform: `translateX(${base + dx}px)`, transition: dragging ? 'none' : 'transform .7s cubic-bezier(.3,.7,.2,1)' }}>
          {GAMES.map((g, i) => {
            const frame = { ...card(i), transform: 'none', opacity: 1, transition: 'none', border: `14px solid ${BORDER[g.id]}` };
            return (
              <div key={g.id} style={{ position: 'relative', flex: 'none', width: 640, height: 640, transform: `scale(${i === idx ? 1 : 0.86})`, opacity: i === idx ? 1 : 0.7, transition: trans }}>
                {g.ready ? (
                  <Link href={g.href} draggable={false} aria-label={`Play ${TITLE[g.id]}`} onClick={(e) => { if (moved.current) e.preventDefault(); }} style={frame}>
                    <GameArt id={g.id} />
                  </Link>
                ) : (
                  <div role="img" aria-label={`${TITLE[g.id]}, coming soon`} style={frame}>
                    <GameArt id={g.id} />
                  </div>
                )}
                {(g.id === 'quiz' || g.id === 'memory' || g.id === 'listen' || g.id === 'sort' || g.id === 'spot' || g.id === 'find') && (
                  <span
                    data-game-icon={g.id}
                    aria-hidden="true"
                    style={{ position: 'absolute', left: 255, top: 318, width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
                  >
                    <GameIcon id={g.id} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button type="button" className="hm-arrow hm-tap" aria-label="Previous game" disabled={idx === 0} onClick={() => go(-1)} style={{ position: 'absolute', left: 56, top: 470, width: 120, height: 120, borderRadius: 60, border: 'none', background: '#fff', boxShadow: '0 8px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg aria-hidden="true" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <button type="button" className="hm-arrow hm-tap" aria-label="Next game" disabled={idx === N - 1} onClick={() => go(1)} style={{ position: 'absolute', right: 56, top: 470, width: 120, height: 120, borderRadius: 60, border: 'none', background: '#fff', boxShadow: '0 8px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg aria-hidden="true" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
      </button>

      <div role="group" aria-label="Pick a game" style={{ position: 'absolute', left: 0, right: 0, top: 847, display: 'flex', justifyContent: 'center' }}>
        {GAMES.map((_, i) => (
          <button key={i} type="button" className="hm-tap" aria-label={`Go to game ${i + 1}`} aria-current={i === idx} onClick={() => { setIdx(i); setDx(0); setDragging(false); }} style={{ width: 120, height: 120, padding: 0, border: 'none', background: 'none', borderRadius: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ display: 'block', height: 22, borderRadius: 11, transition: 'width .5s ease', width: i === idx ? 56 : 22, background: i === idx ? '#E59AA1' : '#E3D5C4' }} />
          </button>
        ))}
      </div>

      <div style={{ position: 'absolute', top: 40, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ marginTop: 8 }}><BackButton href="/" label="Back home" home /></span>
        <AvatarSay avatar={avatar} initials={initials} />
      </div>
      <MusicButton />
    </Stage>
  );
}
