import type { Game } from '@/lib/games/registry';

/** The Memory Match green: card title text and the game-list icon ring/card strokes. */
export const MEMORY_GREEN = '#5E8F69';

/** The Spot the Differences blue: card title text and the game-list icon ring. */
export const SPOT_BLUE = '#5F86A8';

/** The Listen & Pick purple: card title text and the game-list icon ring. */
export const LISTEN_PURPLE = '#7B6BAE';

/** The Sort It gold: card title text and the game-list icon ring. */
export const SORT_GOLD = '#A8842F';

/** The Find It peach: card title text and the game-list icon ring. */
export const FIND_PEACH = '#B5703A';

const num = (bg: string, h: number, n: number, color = '#fff') => (
  <span style={{ width: 120, height: h, borderRadius: 24, background: bg, padding: 12, boxSizing: 'border-box', fontSize: 36, fontWeight: 600, color, lineHeight: 1.1 }}>{n}</span>
);

const miniCard = (bg: string, children?: React.ReactNode) => (
  <span style={{ width: 120, height: 150, borderRadius: 24, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</span>
);

/** The drawing and title shown on a game's card in the game list. */
export function GameArt({ id }: { id: Game['id'] }) {
  if (id === 'quiz') {
    return (
      <>
        <span style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
          {num('#EBB7BC', 150, 1)}
          {num('#A9C6DE', 190, 2)}
          {num('#EED79A', 150, 3, '#8A6A2A')}
        </span>
        <span aria-hidden="true" style={{ width: 110, height: 110 }} />
        <span style={{ fontSize: 64, fontWeight: 600, color: '#B8737B', lineHeight: 1 }}>Quiz</span>
      </>
    );
  }
  if (id === 'memory') {
    return (
      <>
        <span aria-hidden="true" style={{ display: 'flex', gap: 20, alignItems: 'center', height: 190 }}>
          {miniCard('#A9C6DE')}
          {miniCard('#F8DCDF',
            <svg width="80" height="80" viewBox="0 0 80 80">
              <g fill="#fff">
                {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="40" cy="23" rx="9" ry="13" transform={`rotate(${a} 40 40)`} />)}
              </g>
              <circle cx="40" cy="40" r="7" fill="#EED79A" />
            </svg>,
          )}
          {miniCard('#EED79A')}
        </span>
        <span aria-hidden="true" style={{ width: 110, height: 110 }} />
        <span style={{ fontSize: 64, fontWeight: 600, color: MEMORY_GREEN, lineHeight: 1, textAlign: 'center' }}>Memory Match</span>
      </>
    );
  }
  if (id === 'listen') {
    return (
      <>
        <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, height: 190, justifyContent: 'center' }}>
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke={LISTEN_PURPLE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9.5h3l4.5-3.5v12L7 14.5H4z" fill="#F0ECF8" />
            <path d="M15 9.5a3.5 3.5 0 0 1 0 5" />
            <path d="M17.5 7a7 7 0 0 1 0 10" />
          </svg>
          <span style={{ display: 'flex', gap: 14 }}>
            {['#EBB7BC', '#A9C6DE', '#EED79A'].map((c) => <span key={c} style={{ width: 52, height: 52, borderRadius: 14, background: c }} />)}
          </span>
        </span>
        <span aria-hidden="true" style={{ width: 110, height: 110 }} />
        <span style={{ fontSize: 64, fontWeight: 600, color: LISTEN_PURPLE, lineHeight: 1, textAlign: 'center' }}>Listen &amp; Pick</span>
      </>
    );
  }
  if (id === 'sort') {
    return (
      <>
        <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, height: 190, justifyContent: 'center' }}>
          <span style={{ display: 'flex', gap: 30 }}>
            <svg width="84" height="84" viewBox="0 0 24 24" fill="#EED79A" stroke={SORT_GOLD} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" />
            </svg>
            <svg width="84" height="84" viewBox="0 0 24 24" fill="#F5C9CD" stroke={SORT_GOLD} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20.5C6 16.3 3 13 3 9.3 3 6.6 5 4.8 7.3 4.8c1.9 0 3.7 1.1 4.7 3 1-1.9 2.8-3 4.7-3C19 4.8 21 6.6 21 9.3c0 3.7-3 7-9 11.2z" />
            </svg>
          </span>
          <span style={{ display: 'flex', gap: 24 }}>
            {[0, 1].map((k) => (
              <svg key={k} width="78" height="52" viewBox="0 0 78 52" fill="none" stroke={SORT_GOLD} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 12h66l-6 32a6 6 0 0 1-6 5H18a6 6 0 0 1-6-5z" fill="#FBF3D9" />
                <path d="M10 24h58M13 36h52" />
              </svg>
            ))}
          </span>
        </span>
        <span aria-hidden="true" style={{ width: 110, height: 110 }} />
        <span style={{ fontSize: 64, fontWeight: 600, color: SORT_GOLD, lineHeight: 1, textAlign: 'center' }}>Sort It</span>
      </>
    );
  }
  if (id === 'find') {
    return (
      <>
        <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 190 }}>
          <svg width="200" height="160" viewBox="0 0 120 96">
            <rect x="4" y="4" width="112" height="88" rx="14" fill="#F6E6D8" stroke={FIND_PEACH} strokeWidth="4" />
            <path d="M10 80V62q16-12 32-4t30-2 38-6v30z" fill="#BFDCC4" />
            <circle cx="30" cy="24" r="8" fill="#EED79A" />
            <circle cx="88" cy="36" r="6" fill="#E5555F" />
            <circle cx="64" cy="58" r="5" fill="#A9C6DE" />
            <circle cx="50" cy="34" r="16" fill="none" stroke={FIND_PEACH} strokeWidth="3.5" />
          </svg>
        </span>
        <span aria-hidden="true" style={{ width: 110, height: 110 }} />
        <span style={{ fontSize: 64, fontWeight: 600, color: FIND_PEACH, lineHeight: 1, textAlign: 'center' }}>Find It</span>
      </>
    );
  }
  return (
    <>
      <span aria-hidden="true" style={{ display: 'flex', gap: 18, alignItems: 'center', height: 190 }}>
        {['#9CC3A4', '#EED79A'].map((c, i) => (
          <span key={c} style={{ width: 160, height: 160, borderRadius: 28, background: '#DCE8F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="34" cy="40" r="18" fill="#E59AA1" />
              {i === 0 ? <path d="M64 70 L 84 70 L 74 48 Z" fill={c} /> : <rect x="62" y="50" width="22" height="20" rx="4" fill={c} />}
              <rect x="20" y="66" width="22" height="22" rx="4" fill="#8FB3D1" />
            </svg>
          </span>
        ))}
      </span>
      <span aria-hidden="true" style={{ width: 110, height: 110 }} />
      <span style={{ height: 64, fontSize: 52, fontWeight: 600, color: SPOT_BLUE, lineHeight: 1.05, textAlign: 'center' }}>Spot the<br />Differences</span>
    </>
  );
}

const petals = [0, 72, 144, 216, 288];
/** Memory icon geometry in the 24-unit viewBox (circle r=10 at 12,12); every card corner must stay inside MEMORY_ICON_MAX_R. */
export const MEMORY_ICON = {
  cards: [{ dx: -2, dy: 0.4, rot: -8 }, { dx: 2, dy: -0.4, rot: 8 }],
  w: 8, h: 10.5, maxR: 8.5,
} as const;

const flowerCard = ({ dx, dy, rot }: (typeof MEMORY_ICON.cards)[number]) => (
  <g key={dx} transform={`translate(${12 + dx} ${12 + dy}) rotate(${rot})`}>
    <rect x={-MEMORY_ICON.w / 2} y={-MEMORY_ICON.h / 2} width={MEMORY_ICON.w} height={MEMORY_ICON.h} rx="2" fill="#C9DFCE" stroke={MEMORY_GREEN} strokeWidth="0.7" />
    {petals.map((a) => <ellipse key={a} cx="0" cy="-1.6" rx="1.15" ry="1.8" fill="#fff" transform={`rotate(${a})`} />)}
    <circle r="1" fill="#EED79A" />
  </g>
);

/** Decorative round icon on a game's card (no meaning of its own, not a button). */
export function GameIcon({ id }: { id: Game['id'] }) {
  if (id === 'memory') {
    return (
      <svg aria-hidden="true" width="110" height="110" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#EAF3EC" stroke={MEMORY_GREEN} strokeWidth="2" />
        {MEMORY_ICON.cards.map(flowerCard)}
      </svg>
    );
  }
  if (id === 'spot') {
    return (
      <svg aria-hidden="true" width="110" height="110" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#EEF3F7" stroke={SPOT_BLUE} strokeWidth="2" />
        <g stroke={SPOT_BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="4.2" />
          <path d="M14.2 14.2L17.5 17.5" />
        </g>
      </svg>
    );
  }
  if (id === 'listen') {
    return (
      <svg aria-hidden="true" width="110" height="110" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" fill="#F0ECF8" stroke={LISTEN_PURPLE} strokeWidth="2" />
        <path d="M6.8 10.4h2.1l3-2.4v8l-3-2.4H6.8z" fill={LISTEN_PURPLE} stroke={LISTEN_PURPLE} strokeWidth="0.8" />
        <path d="M14.2 10.2a2.4 2.4 0 0 1 0 3.6" stroke={LISTEN_PURPLE} strokeWidth="1.2" />
        <path d="M16 8.6a4.8 4.8 0 0 1 0 6.8" stroke={LISTEN_PURPLE} strokeWidth="1.2" />
      </svg>
    );
  }
  if (id === 'sort') {
    return (
      <svg aria-hidden="true" width="110" height="110" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" fill="#FBF3D9" stroke={SORT_GOLD} strokeWidth="2" />
        {[6.6, 12.6].map((x) => (
          <g key={x}>
            <path d={`M${x} 10.2h4.8l-.7 5.1a1 1 0 0 1-1 .9h-1.4a1 1 0 0 1-1-.9z`} fill="#EED79A" stroke={SORT_GOLD} strokeWidth="0.9" />
            <path d={`M${x + 0.6} 12.6h3.6`} stroke={SORT_GOLD} strokeWidth="0.6" />
          </g>
        ))}
      </svg>
    );
  }
  if (id === 'find') {
    return (
      <svg aria-hidden="true" width="110" height="110" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" fill="#FCEFE2" stroke={FIND_PEACH} strokeWidth="2" />
        <rect x="5.6" y="6.6" width="9.6" height="8" rx="1.4" fill="#F5E0C9" stroke={FIND_PEACH} strokeWidth="0.9" />
        <circle cx="9.4" cy="9.6" r="0.9" fill="#E5555F" />
        <circle cx="13.2" cy="12.2" r="0.6" fill={FIND_PEACH} />
        <circle cx="13.6" cy="10.6" r="2.4" fill="#FCEFE2" stroke={FIND_PEACH} strokeWidth="1.1" />
        <path d="M15.4 12.4l2.6 2.6" stroke={FIND_PEACH} strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#B8737B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill="#F8DCDF" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
  );
}
