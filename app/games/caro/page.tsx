'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { Pic } from '@/components/Pic';
import { CaroHelp } from '@/components/CaroHelp';
import { CaroHooray, CaroOhOh, CaroRetry, HOORAY_MS, OHOH_MS } from '@/components/caro/CaroResult';
import { CaroMark, markColor } from '@/components/caro/CaroMark';
import { CARO_TEAL } from '@/components/games/GameArt';
import { gridStep } from '@/lib/keynav';
import { COLS, ROWS, emptyBoard, place, roundState, turnOf, type Board, type Player } from '@/lib/caro/rules';
import { GENDER_THEME, type Gender } from '@/lib/childTheme';
import { mediaUrl } from '@/lib/media';
import { getMyChildSettings } from '@/lib/settings';
import { chime, ohOh, yay } from '@/lib/sfx';

/** One cell and the gap between cells, in stage pixels: a 30x20 board in the middle of the 1920x1080 stage. */
const CELL = 38;
const GAP = 2;
const PAD = 10;
const BOARD_W = COLS * CELL + (COLS - 1) * GAP + PAD * 2;
const BOARD_H = ROWS * CELL + (ROWS - 1) * GAP + PAD * 2;
/** The side columns hold the two players; the board takes the middle. */
const SIDE_W = (1920 - BOARD_W) / 2;

const MOTION = `
  @keyframes caroBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-18px); } }
  @keyframes caroWobble { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-12deg); } 75% { transform: rotate(12deg); } }
  .caro-bob { animation: caroBob 1.1s ease-in-out infinite; }
  .caro-wobble { animation: caroWobble 1s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .caro-bob, .caro-wobble { animation: none; } }
  .caro-win { animation: caroWin 1.2s ease-in-out infinite; }
  @keyframes caroWin { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
  @media (prefers-reduced-motion: reduce) { .caro-win { animation: none; } }
  .caro-cell:focus-visible { outline: 4px solid #E59AA1; outline-offset: 1px; }
`;

/**
 * One cell. Memoised: a move re-renders only the cell it changed. Keyboard focus moves by DOM order inside
 * the board (gridStep), so the cell needs no ref.
 */
const Cell = memo(function Cell({ index, mark, winning, clickable, onPress }: {
  index: number; mark: Player | null; winning: boolean; clickable: boolean; onPress: (i: number) => void;
}) {
  return (
    <button
      type="button"
      className={`caro-cell${winning ? ' caro-win' : ''}`}
      aria-label={mark ? `Square ${index + 1}, ${mark}` : `Square ${index + 1}, empty`}
      onClick={() => onPress(index)}
      style={{
        width: CELL, height: CELL, borderRadius: 6, border: 'none', padding: 0, cursor: clickable ? 'pointer' : 'default',
        background: winning ? '#F6E2A6' : '#F7F1E8', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {mark && <CaroMark player={mark} size={26} />}
    </button>
  );
});

/**
 * One player: a big picture, and under it the player's mark. When it is this player's turn the picture bounces
 * and the mark wiggles (both stop under reduced motion).
 */
function Side({ label, mark, src, active }: { label: string; mark: Player; src: string; active: boolean }) {
  return (
    <div aria-label={label} aria-current={active ? 'true' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
      <div className={active ? 'caro-bob' : undefined} style={{ width: 240, height: 240, borderRadius: 120, overflow: 'hidden', border: '8px solid #fff', boxSizing: 'border-box', boxShadow: '0 8px 0 #EADCC8', background: '#F5D9C4' }}>
        <Pic src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div className={active ? 'caro-wobble' : undefined} style={{ width: 120, height: 120, borderRadius: 60, background: '#fff', boxShadow: active ? `0 0 0 8px ${markColor(mark)}55, 0 6px 0 #EADCC8` : '0 6px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CaroMark player={mark} size={84} />
      </div>
    </div>
  );
}

type Child = { gender: Gender; avatar: string | null; hooray: string | null; ohoh: string | null };

/** Caro X O for two players on one computer (X1-X10). The child is X (boy) or O (girl); X always starts. */
export default function CaroPlay() {
  const router = useRouter();
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [help, setHelp] = useState(false);
  /** The child's win: the Hooray screen is up. */
  const [celebrate, setCelebrate] = useState(false);
  /** The opponent's win: the Oh-oh toast, then the "Let's try again?" popup. */
  const [loss, setLoss] = useState<'toast' | 'modal' | null>(null);
  const [child, setChild] = useState<Child>({ gender: 'female', avatar: null, hooray: null, ohoh: null });
  const helpBtn = useRef<HTMLButtonElement>(null);
  const hoorayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lossTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read by press() so that press keeps the same identity and the memoised cells do not re-render.
  const boardNow = useRef(board);
  boardNow.current = board;

  useEffect(() => {
    getMyChildSettings().then((d) => {
      if (!d) return;
      setChild({
        gender: d.gender === 'male' ? 'male' : 'female',
        avatar: mediaUrl(d.avatar_path),
        hooray: mediaUrl(d.hooray_path),
        ohoh: mediaUrl(d.ohoh_path),
      });
    }, () => undefined);
    return () => {
      if (hoorayTimer.current) clearTimeout(hoorayTimer.current);
      if (lossTimer.current) clearTimeout(lossTimer.current);
    };
  }, []);

  const state = useMemo(() => roundState(board), [board]);
  const turn: Player = turnOf(board);
  const over = state.status !== 'playing';
  const won = useMemo(() => new Set(state.line ?? []), [state]);

  // Boy plays X (blue), girl plays O (red); the opponent has the other mark and the other gender's picture.
  const childMark: Player = child.gender === 'male' ? 'X' : 'O';
  const opponentMark: Player = childMark === 'X' ? 'O' : 'X';
  const opponentGender: Gender = child.gender === 'male' ? 'female' : 'male';
  const childSrc = child.avatar ?? GENDER_THEME[child.gender].hero;
  const opponentSrc = GENDER_THEME[opponentGender].hero;
  const childMarkRef = useRef<Player>(childMark);
  childMarkRef.current = childMark;
  const childRef = useRef(child);
  childRef.current = child;

  const clearResultTimers = useCallback(() => {
    if (hoorayTimer.current) clearTimeout(hoorayTimer.current);
    if (lossTimer.current) clearTimeout(lossTimer.current);
    hoorayTimer.current = null;
    lossTimer.current = null;
  }, []);

  const press = useCallback((i: number) => {
    const next = place(boardNow.current, i);
    if (!next) return;
    boardNow.current = next;
    setBoard(next);
    const after = roundState(next);
    if (after.status !== 'won') {
      chime();
      return;
    }
    if (after.winner === childMarkRef.current) {
      // The child won: the Hooray screen (the quiz's sound, or the built-in one), then the board with the win line.
      yay(childRef.current.hooray);
      setCelebrate(true);
      hoorayTimer.current = setTimeout(() => setCelebrate(false), HOORAY_MS);
    } else {
      // The opponent won: the Oh-oh sound and toast, then the "Let's try again?" popup.
      ohOh(childRef.current.ohoh);
      setLoss('toast');
      lossTimer.current = setTimeout(() => setLoss('modal'), OHOH_MS);
    }
  }, []);

  /** Play again, and Yes in the "Let's try again?" popup: a new empty board, no popups. */
  const restart = useCallback(() => {
    clearResultTimers();
    setCelebrate(false);
    setLoss(null);
    boardNow.current = emptyBoard();
    setBoard(boardNow.current);
  }, [clearResultTimers]);

  const closeHelp = useCallback(() => {
    setHelp(false);
    setTimeout(() => helpBtn.current?.focus(), 0);
  }, []);

  return (
    <Stage>
      <style>{MOTION}</style>
      <Hills />

      <div style={{ position: 'absolute', top: 40, left: 56 }}>
        <BackButton href="/games" label="Back to games" />
      </div>

      <div style={{ position: 'absolute', top: 40, right: 40, zIndex: 2 }}>
        <button
          ref={helpBtn}
          type="button"
          className="hm-tap"
          aria-label="What is Caro? Show how to play"
          onClick={() => setHelp(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 16, height: 120, padding: '0 40px 0 28px', borderRadius: 60, background: '#fff', border: '8px solid #9FD3C7', boxShadow: '0 8px 0 #EADCC8', boxSizing: 'border-box', fontFamily: 'inherit' }}
        >
          <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={CARO_TEAL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
          <span style={{ fontSize: 44, fontWeight: 600, color: CARO_TEAL, lineHeight: 1 }}>Caro</span>
        </button>
      </div>

      {over && loss === null && !celebrate && (
        <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
          <button
            type="button"
            aria-label="Play again"
            className="hm-tap"
            onClick={restart}
            style={{ width: 110, height: 110, borderRadius: 55, border: 'none', background: '#fff', boxShadow: '0 8px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg aria-hidden="true" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
            </svg>
          </button>
        </div>
      )}

      {/* Player 1 (the child) on the left, the opponent on the right. */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: SIDE_W, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Side label="Player 1" mark={childMark} src={childSrc} active={!over && turn === childMark} />
      </div>
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: SIDE_W, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Side label="Player 2" mark={opponentMark} src={opponentSrc} active={!over && turn === opponentMark} />
      </div>

      <div
        aria-label="Caro board"
        onKeyDown={(e) => { gridStep(Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.caro-cell')), COLS, e); }}
        style={{
          position: 'absolute', top: (1080 - BOARD_H) / 2, left: (1920 - BOARD_W) / 2, width: BOARD_W, height: BOARD_H,
          boxSizing: 'border-box', padding: PAD, background: '#fff', borderRadius: 24, boxShadow: '0 8px 0 #EADCC8',
          display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`, gap: GAP,
        }}
      >
        {board.map((cell, i) => (
          <Cell key={i} index={i} mark={cell} winning={won.has(i)} clickable={!cell && !over} onPress={press} />
        ))}
      </div>

      {celebrate && <CaroHooray />}
      {loss === 'toast' && <CaroOhOh />}
      {loss === 'modal' && (
        <CaroRetry
          avatar={childSrc}
          onYes={restart}
          onNo={() => router.push('/games')}
        />
      )}

      {help && <CaroHelp playHref={null} onClose={closeHelp} />}
      <MusicButton />
    </Stage>
  );
}
