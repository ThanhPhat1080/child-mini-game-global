'use client';

import { useEffect, useRef, useState } from 'react';
import { Pic } from '@/components/Pic';

/** What the avatar says when tapped. One place to change it. */
export const AVATAR_SAY = "Let's play with me!";
const SHOW_MS = 4500;
const SIZE = 150;
const PINK = '#F8DCDF';

/** The child's avatar (large). Tapping it pops a light-pink cloud bubble beside it for a few seconds. */
export function AvatarSay({ avatar, initials }: { avatar: string | null; initials: string }) {
  const [show, setShow] = useState(false);
  const [pop, setPop] = useState(0); // restarts the pop-in each tap
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const tap = () => {
    setShow(true);
    setPop((n) => n + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), SHOW_MS);
  };

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
      {show && (
        <div
          key={pop}
          role="status"
          className="hm-pop"
          style={{ position: 'absolute', right: SIZE + 56, top: 14, transformOrigin: '100% 60%', filter: 'drop-shadow(0 8px 0 #EBC4C8)', pointerEvents: 'none' }}
        >
          <div aria-hidden="true" style={{ position: 'absolute', top: -30, left: 36, right: 36, display: 'flex', justifyContent: 'space-around' }}>
            {[58, 74, 62, 78, 60].map((d, i) => <span key={i} style={{ width: d, height: d, borderRadius: '50%', background: PINK, marginTop: i % 2 ? -4 : 6 }} />)}
          </div>
          <div aria-hidden="true" style={{ position: 'absolute', bottom: -28, left: 52, right: 52, display: 'flex', justifyContent: 'space-around' }}>
            {[60, 72, 58, 70].map((d, i) => <span key={i} style={{ width: d, height: d, borderRadius: '50%', background: PINK, marginBottom: i % 2 ? 4 : -4 }} />)}
          </div>
          <div style={{ position: 'relative', padding: '28px 64px', borderRadius: 70, background: PINK, fontSize: 56, fontWeight: 600, color: '#B8737B', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
            {AVATAR_SAY}
          </div>
          {/* trail of little clouds toward the avatar */}
          <span aria-hidden="true" style={{ position: 'absolute', right: -34, top: 78, width: 36, height: 36, borderRadius: '50%', background: PINK }} />
          <span aria-hidden="true" style={{ position: 'absolute', right: -58, top: 108, width: 20, height: 20, borderRadius: '50%', background: PINK }} />
        </div>
      )}
      <button
        type="button"
        className="hm-tap"
        aria-label="Hear from the avatar"
        onClick={tap}
        style={{ width: SIZE, height: SIZE, padding: 0, borderRadius: SIZE / 2, background: '#F5D9C4', border: '8px solid #fff', boxShadow: '0 8px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60, fontWeight: 600, color: '#B8737B', overflow: 'hidden', boxSizing: 'border-box' }}
      >
        {avatar ? <Pic src={avatar} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
      </button>
    </div>
  );
}
