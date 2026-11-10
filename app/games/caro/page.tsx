'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChildScreen } from '@/components/ChildScreen';
import { Hills } from '@/components/Hills';
import { Pic } from '@/components/Pic';
import { CaroHelp } from '@/components/CaroHelp';
import { CaroHooray, CaroOhOh, HOORAY_MS, OHOH_MS, RESULT_DELAY_MS } from '@/components/caro/CaroResult';
import { CaroMark, markColor } from '@/components/caro/CaroMark';
import { RobotIcon } from '@/components/caro/RobotIcon';
import { InitialsAvatar } from '@/components/admin/InitialsAvatar';
import { CARO_TEAL } from '@/components/games/GameArt';
import { getMyProfile } from '@/lib/auth/roles';
import { gridStep } from '@/lib/keynav';
import { COLS, ROWS, emptyBoard, place, roundState, turnOf, type Board, type Player } from '@/lib/caro/rules';
import { robotMove } from '@/lib/caro/robot';
import { GENDER_THEME, type Gender } from '@/lib/childTheme';
import { mediaUrl } from '@/lib/media';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
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
/** How long the robot "thinks" before its mark goes down, so the child can follow the move. */
const ROBOT_THINK_MS = 900;

const MOTION = `
  @keyframes caroBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-18px); } }
  @keyframes caroWobble { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-12deg); } 75% { transform: rotate(12deg); } }
  .caro-bob { animation: caroBob 1.1s ease-in-out infinite; }
  .caro-wobble { animation: caroWobble 1s ease-in-out infinite; }
  /* O is round, so turning it shows nothing: it breathes in and out instead */
  @keyframes caroPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.14); } }
  .caro-pulse { animation: caroPulse 1.1s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .caro-bob, .caro-wobble, .caro-pulse { animation: none; } }
  .caro-win { animation: caroWin 1.2s ease-in-out infinite; }
  @keyframes caroWin { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
  @media (prefers-reduced-motion: reduce) { .caro-win { animation: none; } }
  .caro-cell:focus-visible { outline: 4px solid #E59AA1; outline-offset: 1px; }
  .caro-mode:focus-visible { outline: 8px solid #E59AA1; outline-offset: 8px; }
`;

/**
 * Where the round is: `playing` (moves go on), `waiting` (the last mark is down; the board stays for a second),
 * `hooray` or `ohoh` (the child won, or the opponent did), and `done` (the board again, with Play again).
 * A draw goes straight to `done`.
 */
type Phase = 'playing' | 'waiting' | 'hooray' | 'ohoh' | 'done';

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
 * and the mark moves: X wiggles, O (round, so a turn would not show) zooms in and out gently (all stop under reduced motion). `picture` is the child's photo, the prince or princess,
 * or the parent's initials (against a human).
 */
function Side({ label, mark, active, picture }: { label: string; mark: Player; active: boolean; picture: ReactNode }) {
  return (
    <div aria-label={label} aria-current={active ? 'true' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
      <div className={active ? 'caro-bob' : undefined} style={{ width: 240, height: 240, borderRadius: 120, overflow: 'hidden', border: '8px solid #fff', boxSizing: 'border-box', boxShadow: '0 8px 0 #EADCC8', background: '#F5D9C4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {picture}
      </div>
      <div className={active ? (mark === 'O' ? 'caro-pulse' : 'caro-wobble') : undefined} style={{ width: 120, height: 120, borderRadius: 60, background: '#fff', boxShadow: active ? `0 0 0 8px ${markColor(mark)}55, 0 6px 0 #EADCC8` : '0 6px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CaroMark player={mark} size={84} />
      </div>
    </div>
  );
}

/** The two big choice buttons on the first screen (X13). Colours are set per button. */
const MODE_BUTTON = {
  width: 620, height: 380, borderRadius: 64, border: 'none', boxSizing: 'border-box' as const, padding: '0 40px',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, textAlign: 'center' as const,
  fontFamily: 'inherit', fontSize: 56, fontWeight: 700, lineHeight: 1.15, cursor: 'pointer',
};

/** A round picture inside a choice button: the child, the parent's initials, or the robot. */
function ChoiceCircle({ children }: { children: ReactNode }) {
  return (
    <span style={{ width: 150, height: 150, borderRadius: 75, background: '#F5D9C4', border: '8px solid #fff', boxSizing: 'border-box', overflow: 'hidden', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </span>
  );
}

type Child = { name: string; gender: Gender; avatar: string | null; hooray: string | null; ohoh: string | null };
/**
 * `pick` is the first screen: the child chooses to play a human or the robot. `human` is two players on one computer;
 * `robot` is the child against the robot (X13), which plays the other mark.
 */
type Mode = 'pick' | 'human' | 'robot';

/** Caro X O for two players on one computer (X1-X12), or against the robot (X13-X16). The child is X (boy) or O (girl); X always starts. */
export default function CaroPlay() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [phase, setPhase] = useState<Phase>('playing');
  const [mode, setMode] = useState<Mode>('pick');
  const [help, setHelp] = useState(false);
  // false until the child's settings have loaded: the robot must not move before it knows which mark the child has.
  const [ready, setReady] = useState(false);
  const [child, setChild] = useState<Child>({ name: '', gender: 'female', avatar: null, hooray: null, ohoh: null });
  // The parent's name: against a human, the parent's initials stand in for the opponent (X3).
  const [parentName, setParentName] = useState('');
  const helpBtn = useRef<HTMLButtonElement>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read by press() so that press keeps the same identity and the memoised cells do not re-render.
  const boardNow = useRef(board);
  boardNow.current = board;

  useEffect(() => {
    getMyProfile(createSupabaseBrowserClient()).then((p) => setParentName((p?.display_name ?? '').trim()), () => undefined);
    getMyChildSettings().then((d) => {
      if (d) {
        setChild({
          name: (d.child_name ?? '').trim(),
          gender: d.gender === 'male' ? 'male' : 'female',
          avatar: mediaUrl(d.avatar_path),
          hooray: mediaUrl(d.hooray_path),
          ohoh: mediaUrl(d.ohoh_path),
        });
      }
      setReady(true);
    }, () => setReady(true));
    return () => {
      if (resultTimer.current) clearTimeout(resultTimer.current);
    };
  }, []);

  // Hooray and Oh-oh last a while, then the board is shown again with Play again.
  useEffect(() => {
    if (phase !== 'hooray' && phase !== 'ohoh') return;
    const t = setTimeout(() => setPhase('done'), phase === 'hooray' ? HOORAY_MS : OHOH_MS);
    return () => clearTimeout(t);
  }, [phase]);

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

  // Whose mark the robot plays: the other one. Against the robot, the robot moves whenever it is its turn.
  const robotMark: Player = opponentMark;
  const robotTurn = mode === 'robot' && ready && !over && turn === robotMark;
  const robotTurnRef = useRef(robotTurn);
  robotTurnRef.current = robotTurn;

  // Puts a mark on the board for whoever is due (the child's press or the robot's move). Shared by both.
  const commit = useCallback((i: number) => {
    const next = place(boardNow.current, i);
    if (!next) return;
    boardNow.current = next;
    setBoard(next);
    const after = roundState(next);
    if (after.status === 'playing') {
      chime();
      return;
    }
    if (after.status === 'draw') {
      chime();
      setPhase('done');
      return;
    }
    // A win: the board keeps its win line for a second, then Hooray (the child won) or Oh-oh (the opponent won).
    setPhase('waiting');
    resultTimer.current = setTimeout(() => {
      resultTimer.current = null;
      if (after.winner === childMarkRef.current) {
        yay(childRef.current.hooray);
        setPhase('hooray');
      } else {
        ohOh(childRef.current.ohoh);
        setPhase('ohoh');
      }
    }, RESULT_DELAY_MS);
  }, []);

  // The child's press. Ignored while the robot is due, so the child cannot place the robot's mark.
  const press = useCallback((i: number) => {
    if (robotTurnRef.current) return;
    commit(i);
  }, [commit]);

  // The robot's move: after a short think, it marks the cell that robotMove picks.
  useEffect(() => {
    if (!robotTurn) return;
    const t = setTimeout(() => {
      const cell = robotMove(boardNow.current, robotMark);
      if (cell !== null) commit(cell);
    }, ROBOT_THINK_MS);
    return () => clearTimeout(t);
  }, [robotTurn, board, robotMark, commit]);

  /** Play again: a new empty board, no popups. */
  const restart = useCallback(() => {
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = null;
    setPhase('playing');
    boardNow.current = emptyBoard();
    setBoard(boardNow.current);
  }, []);

  const closeHelp = useCallback(() => {
    setHelp(false);
    setTimeout(() => helpBtn.current?.focus(), 0);
  }, []);

  return (
    <ChildScreen back={{ href: '/games', label: 'Back to games', game: 'caro' }} music>
      <style>{MOTION}</style>
      <Hills />

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

      {/* First screen: the child picks the opponent. Blue is a person, yellow is the robot (X13). Arrows move between them. */}
      {mode === 'pick' && (
        <div
          role="group"
          aria-label="Pick who to play with"
          onKeyDown={(e) => { gridStep(Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.caro-mode')), 2, e); }}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80 }}
        >
          {/* Child's picture, "vs", then the opponent: the parent's initials (human) or a robot (robot). Names are for screen readers only. */}
          <button
            type="button"
            className="caro-mode hm-tap"
            autoFocus
            aria-label={child.name ? `${child.name} vs human` : 'vs human'}
            onClick={() => setMode('human')}
            style={{ ...MODE_BUTTON, background: '#4F8FD8', boxShadow: '0 18px 0 #3A6FB0', color: '#fff' }}
          >
            <ChoiceCircle><Pic src={childSrc} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></ChoiceCircle>
            <span aria-hidden="true">vs</span>
            <ChoiceCircle><InitialsAvatar name={parentName} size={134} /></ChoiceCircle>
          </button>
          <button
            type="button"
            className="caro-mode hm-tap"
            aria-label={child.name ? `${child.name} vs Robot` : 'vs Robot'}
            onClick={() => setMode('robot')}
            style={{ ...MODE_BUTTON, background: '#E5C979', boxShadow: '0 18px 0 #C9A64E', color: '#5A4038' }}
          >
            <ChoiceCircle><Pic src={childSrc} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></ChoiceCircle>
            <span aria-hidden="true">vs</span>
            <ChoiceCircle><RobotIcon size={134} body="#A9C6DE" ink="#5A4038" /></ChoiceCircle>
          </button>
        </div>
      )}

      {mode !== 'pick' && (<>
      {/* Centre bottom, under the board. Only this button takes clicks in the strip (the rest passes through). */}
      {phase === 'done' && (
        <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 2 }}>
          <button
            type="button"
            aria-label="Play again"
            className="hm-tap"
            onClick={restart}
            style={{ pointerEvents: 'auto', height: 100, padding: '0 56px 0 40px', borderRadius: 50, border: 'none', background: '#4F8FD8', boxShadow: '0 8px 0 #3A6FB0', display: 'flex', alignItems: 'center', gap: 20, color: '#fff', fontSize: 48, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
            </svg>
            Play again?
          </button>
        </div>
      )}

      {/* Player 1 (the child) on the left, the opponent on the right. */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: SIDE_W, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Side label="Player 1" mark={childMark} active={!over && turn === childMark} picture={<Pic src={childSrc} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />} />
      </div>
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: SIDE_W, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Against a human: the parent's initials. Against the robot: the other gender's prince or princess, as before. */}
        <Side
          label="Player 2"
          mark={opponentMark}
          active={!over && turn === opponentMark}
          picture={mode === 'human'
            ? <InitialsAvatar name={parentName} size={224} />
            : <Pic src={opponentSrc} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        />
      </div>

      <div
        aria-label="Caro board"
        inert={over || robotTurn}
        onKeyDown={(e) => { gridStep(Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.caro-cell')), COLS, e); }}
        style={{
          position: 'absolute', top: (1080 - BOARD_H) / 2, left: (1920 - BOARD_W) / 2, width: BOARD_W, height: BOARD_H,
          boxSizing: 'border-box', padding: PAD, background: '#fff', borderRadius: 24, boxShadow: '0 8px 0 #EADCC8',
          display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`, gap: GAP,
        }}
      >
        {board.map((cell, i) => (
          <Cell key={i} index={i} mark={cell} winning={won.has(i)} clickable={!cell && !over && !robotTurn} onPress={press} />
        ))}
      </div>
      </>)}

      {phase === 'hooray' && <CaroHooray />}
      {phase === 'ohoh' && <CaroOhOh />}

      {help && <CaroHelp playHref={null} onClose={closeHelp} />}
    </ChildScreen>
  );
}
