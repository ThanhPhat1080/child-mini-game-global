'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { MemoryDone } from '@/components/memory/MemoryDone';
import { MemoryTile } from '@/components/memory/MemoryTile';
import { FlowerBack } from '@/components/memory/FlowerBack';
import { fetchActiveCards, sayWord, stopWord } from '@/lib/memory/cards';
import { drawDeck, pairsOf, parseLevel, type Level } from '@/lib/memory/deck';
import { flip, MISMATCH_MS, resolveMismatch, startGame, WIN_DELAY_MS, type GameEvent, type GameState } from '@/lib/memory/rules';
import { preloadImages } from '@/lib/memory/preload';
import { mediaUrl } from '@/lib/media';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { chime, flipTick } from '@/lib/sfx';
import { gridStep } from '@/lib/keynav';

/** Columns per level (4x3, 4x4, 5x4, 6x4, 6x5). */
const COLS: Record<Level, number> = { 12: 4, 16: 4, 20: 5, 24: 6, 30: 6 };
/** Board area on the 1920x1080 stage, under the header band. */
const TOP = 190;
const AREA_W = 1700;
/** Leaves room under the bottom row for the 6 px focus ring + 8 px offset (the Stage clips at 1080). */
const AREA_H = 856;
const GAP = 20;
/** The word starts a little after the chime so the two do not overlap (M4). */
const WORD_AFTER_CHIME_MS = 550;
const WIGGLE_MS = 700;
/** After the last word ends, a short breath before the celebration starts (its sounds would cut the word). */
const WORD_PAUSE_MS = 400;
/** The celebration shows at the latest this long after the last match, even if the voice never reports its end. */
const WIN_CAP_MS = 4000;

const tileSize = (level: Level) => {
  const cols = COLS[level];
  const rows = Math.ceil(level / cols);
  return Math.min(260, Math.floor((AREA_H - GAP * (rows - 1)) / rows), Math.floor((AREA_W - GAP * (cols - 1)) / cols));
};
const tileEls = () => Array.from(document.querySelectorAll<HTMLElement>('[data-tile]'));
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/** Memory Match board (M2-M6, M8-M10). The rules live in lib/memory/rules.ts; this page plays sounds and animations. */
export default function MemoryPlay() {
  const { level: raw } = useParams<{ level: string }>();
  const level = parseLevel(String(raw ?? ''));
  const router = useRouter();
  const game = useRef<GameState | null>(null);
  const [, setRender] = useState(0);
  const rerender = useCallback(() => setRender((n) => n + 1), []);
  const [phase, setPhase] = useState<'loading' | 'empty' | 'ready'>('loading');
  const [won, setWon] = useState<{ flips: number } | null>(null);
  const [round, setRound] = useState(0);
  const [praise, setPraise] = useState<{ name: string; url: string | null } | null>(null);
  const [wiggle, setWiggle] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const alive = useRef(true);
  /** Bumped by every match (and Play again), so only the newest word's end counts. */
  const wordSeq = useRef(0);
  /** The finished game waiting for both the win delay and the last word before the celebration shows. */
  const finale = useRef<{ flips: number; delay: boolean; word: boolean } | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    if (!alive.current) return;
    const id = setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => {
    if (level === null) router.replace('/games/memory');
  }, [level, router]);

  useEffect(() => {
    alive.current = true;
    setReduced(reducedMotion());
    const pending = timers.current;
    return () => {
      alive.current = false;
      for (const id of pending) clearTimeout(id);
      pending.clear();
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
      stopWord();
    };
  }, []);

  // Load the pool, draw the deck once per mount, preload its pictures, then open the board.
  useEffect(() => {
    if (level === null) return;
    let live = true;
    let stopPreload: (() => void) | null = null;
    fetchActiveCards().then(
      (cards) => {
        if (!live) return;
        if (cards.filter((c) => c.active).length < pairsOf(level)) { setPhase('empty'); return; }
        const tiles = drawDeck(cards, level);
        stopPreload = preloadImages(tiles.map((t) => mediaUrl(t.card.image_path)), () => {
          if (!live) return;
          game.current = startGame(tiles);
          setPhase('ready');
        });
      },
      () => live && setPhase('empty'),
    );
    return () => { live = false; stopPreload?.(); };
  }, [level, round]);

  // The completion screen needs the child's name and optional custom sound (as the Quiz done page).
  useEffect(() => {
    if (!won) return;
    let live = true;
    const done = (name: string, url: string | null) => live && setPraise({ name, url });
    createSupabaseBrowserClient().from('settings').select('child_name, complete_path').eq('id', 1).single()
      .then(({ data }) => done(data?.child_name ?? '', mediaUrl(data?.complete_path)), () => done('', null));
    return () => { live = false; };
  }, [won]);

  const again = useCallback(() => {
    game.current = null;
    finale.current = null;
    wordSeq.current++;
    setWon(null);
    setPraise(null);
    setPhase('loading');
    setRound((n) => n + 1);
  }, []);

  useEffect(() => {
    if (phase !== 'ready') return;
    tileEls()[0]?.focus();
    const onKey = (e: KeyboardEvent) => { gridStep(tileEls(), COLS[level ?? 12], e); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, level]);

  /** Shows the celebration for this finished game, once (the cap and the normal path both call it). */
  const celebrate = useCallback((f: NonNullable<typeof finale.current>, force = false) => {
    if (finale.current !== f || !(force || (f.delay && f.word))) return;
    finale.current = null;
    setWon({ flips: f.flips });
  }, []);

  const handle = useCallback((events: GameEvent[]) => {
    const s = game.current;
    if (!s) return;
    for (const ev of events) {
      if (ev.type === 'flipped') flipTick();
      else if (ev.type === 'matched') {
        const card = s.tiles[ev.indexes[0]].card;
        chime();
        const seq = ++wordSeq.current;
        later(() => sayWord(card, () => {
          // The last pair's word must be heard in full: the celebration's own sounds would cut it.
          later(() => {
            const f = finale.current;
            if (!f || wordSeq.current !== seq) return;
            f.word = true;
            celebrate(f);
          }, WORD_PAUSE_MS);
        }), WORD_AFTER_CHIME_MS);
      } else if (ev.type === 'mismatch') {
        later(() => {
          if (!game.current) return;
          game.current = resolveMismatch(game.current).state;
          flipTick();
          rerender();
        }, MISMATCH_MS);
      } else if (ev.type === 'replay') {
        const card = s.tiles.find((t) => t.card.id === ev.cardId)?.card;
        if (card) sayWord(card);
      } else if (ev.type === 'won') {
        const f = { flips: ev.flips, delay: false, word: false };
        finale.current = f;
        later(() => { f.delay = true; celebrate(f); }, WIN_DELAY_MS);
        later(() => celebrate(f, true), WIN_CAP_MS);
      }
    }
  }, [celebrate, later, rerender]);

  const press = useCallback((index: number) => {
    if (!game.current) return;
    const { state, events } = flip(game.current, index);
    game.current = state;
    handle(events);
    if (events.some((e) => e.type === 'replay')) {
      setWiggle(index);
      later(() => setWiggle((w) => (w === index ? null : w)), WIGGLE_MS);
    }
    rerender();
  }, [handle, later, rerender]);

  const s = game.current;
  const cols = level ? COLS[level] : 4;
  const size = level ? tileSize(level) : 0;

  return (
    <Stage>
      <div data-memory-play data-won={won ? 'true' : 'false'} data-flips={won?.flips} className={reduced ? 'hm-reduced' : undefined} style={{ position: 'absolute', inset: 0 }}>
        {won && praise ? (
          <MemoryDone flips={won.flips} childName={praise.name} completeUrl={praise.url} onAgain={again} levelsHref="/games/memory" />
        ) : (
          <>
            <Hills />
            <div style={{ position: 'absolute', top: 48, zIndex: 2, left: 56, right: 56, display: 'flex', alignItems: 'center' }}>
              <BackButton href="/games/memory" />
            </div>
          </>
        )}
        {phase === 'empty' && (
          <div role="status" aria-label="New cards are coming soon" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 400, height: 400, borderRadius: 64, overflow: 'hidden', border: '8px solid #EBB7BC', boxSizing: 'border-box' }}>
              <FlowerBack />
            </span>
          </div>
        )}
        {phase === 'ready' && s && !won && (
          <div style={{ position: 'absolute', top: TOP, left: 0, right: 0, height: AREA_H, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <div role="group" aria-label="Cards" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${size}px)`, gap: GAP }}>
              {s.tiles.map((t, i) => {
                const matched = s.matched.has(t.card.id);
                return (
                  <MemoryTile
                    key={t.key}
                    tile={t}
                    size={size}
                    label={`card ${i + 1}`}
                    faceUp={matched || s.up.includes(i)}
                    matched={matched}
                    wiggle={wiggle === i}
                    onPress={() => press(i)}
                  />
                );
              })}
            </div>
          </div>
        )}
        <MusicButton />
      </div>
    </Stage>
  );
}
