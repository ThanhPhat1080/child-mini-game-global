'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { FindBoard, type FindRipple } from '@/components/find/FindBoard';
import { FindWordList } from '@/components/find/FindWordList';
import { FindScrollColumn } from '@/components/find/FindScrollColumn';
import { FindDone } from '@/components/find/FindDone';
import { FlowerBack } from '@/components/memory/FlowerBack';
import { fetchFindLevel } from '@/lib/find/levels';
import { hitCurrent } from '@/lib/find/hit';
import { advance, isDone, startFind, type FindState } from '@/lib/find/rules';
import { isPlayable } from '@/lib/find/validate';
import type { FindLevel } from '@/lib/find/types';
import { preloadImages } from '@/lib/memory/preload';
import { sayWord, stopWord } from '@/lib/memory/cards';
import { mediaUrl } from '@/lib/media';
import { getMyChildSettings } from '@/lib/settings';
import { chime } from '@/lib/sfx';

/** The picture is open; a short pause before the first word is said. */
const PROMPT_DELAY_MS = 600;
/** After a right tap, taps are ignored for this long; then the next word is shown and said. */
const ADVANCE_MS = 1000;
/** After the last object is found, a short breath before the celebration. */
const FINISH_DELAY_MS = 1000;
/** How long a wrong-tap ripple stays on the picture. */
const RIPPLE_MS = 800;
/** If the settings request has not settled this long after the win, celebrate with the empty default anyway. */
const PRAISE_FALLBACK_MS = 2000;
const LEVELS = '/games/find';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/** A level that cannot be read or is not playable is the same friendly screen as an unknown id. */
async function loadLevel(id: string): Promise<FindLevel | null> {
  try {
    const level = await fetchFindLevel(id);
    return level && isPlayable(level) ? level : null;
  } catch {
    return null;
  }
}

/** Find It play screen (F2-F9). The child hears and sees one object's word at a time and taps it in the picture. The rules live in lib/find; this page plays the sound and the timing. */
export default function FindPlay() {
  const { levelId } = useParams<{ levelId: string }>();
  const [phase, setPhase] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [level, setLevel] = useState<FindLevel | null>(null);
  const [game, setGame] = useState<FindState | null>(null);
  /** Indices of the objects the child has found, in the order found. */
  const [found, setFound] = useState<number[]>([]);
  const [won, setWon] = useState(false);
  const [praise, setPraise] = useState<{ name: string; url: string | null } | null>(null);
  const [ripple, setRipple] = useState<FindRipple | null>(null);
  const [reduced, setReduced] = useState(false);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const alive = useRef(true);
  /** True from a right tap until the next word is shown: taps in that pause are ignored. */
  const locked = useRef(false);
  const rippleKey = useRef(0);

  const later = useCallback((fn: () => void, ms: number) => {
    if (!alive.current) return;
    const id = setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => {
    alive.current = true;
    setReduced(reducedMotion());
    const pending = timers.current;
    return () => {
      alive.current = false;
      for (const id of pending) clearTimeout(id);
      pending.clear();
      stopWord();
    };
  }, []);

  // Load the level, preload its picture, then open the board. Object sounds are not preloaded (preloadImages is image-only).
  useEffect(() => {
    let live = true;
    let stopPreload: (() => void) | null = null;
    void loadLevel(String(levelId ?? '')).then((loaded) => {
      if (!live) return;
      if (!loaded) { setPhase('missing'); return; }
      stopPreload = preloadImages([mediaUrl(loaded.image_path)], () => {
        if (!live) return;
        setGame(startFind(loaded.objects.length));
        setLevel(loaded);
        setPhase('ready');
      });
    });
    return () => { live = false; stopPreload?.(); };
  }, [levelId]);

  const index = game?.index ?? -1;

  /** Says one object's word. It never changes the game: the list rows use it too. */
  const sayAt = useCallback((i: number) => {
    if (!level || !alive.current) return;
    const obj = level.objects[i];
    if (!obj) return;
    sayWord(obj);
  }, [level]);

  // Each new object: the first after PROMPT_DELAY_MS, the rest as soon as the advance pause ends.
  useEffect(() => {
    if (phase !== 'ready' || !level || index < 0 || index >= level.objects.length) return;
    if (index === 0) later(() => sayAt(0), PROMPT_DELAY_MS);
    else sayAt(index);
  }, [phase, level, index, later, sayAt]);

  // The completion screen needs the child's name and optional custom sound (as the Spot and Memory done pages).
  useEffect(() => {
    if (!won) return;
    let live = true;
    const done = (name: string, url: string | null) => live && setPraise({ name, url });
    later(() => { if (live) setPraise((p) => p ?? { name: '', url: null }); }, PRAISE_FALLBACK_MS);
    try {
      getMyChildSettings()
        .then((data) => done(data?.child_name ?? '', mediaUrl(data?.complete_path)), () => done('', null));
    } catch {
      done('', null);
    }
    return () => { live = false; };
  }, [won, later]);

  // R says the current word again.
  useEffect(() => {
    if (won || !level) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && index >= 0 && index < level.objects.length) sayAt(index);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [won, level, index, sayAt]);

  const again = useCallback(() => {
    if (!level) return;
    locked.current = false;
    setGame(startFind(level.objects.length));
    setFound([]);
    setWon(false);
    setPraise(null);
    setRipple(null);
  }, [level]);

  const onTap = useCallback((point: { x: number; y: number }, aspect: number) => {
    if (!level || !game || won || locked.current || isDone(game)) return;
    const i = game.index;
    const obj = level.objects[i];
    if (!obj) return;
    if (hitCurrent(obj, point, aspect)) {
      chime();
      locked.current = true;
      setFound((f) => [...f, i]);
      if (i + 1 >= level.objects.length) later(() => setWon(true), FINISH_DELAY_MS);
      else later(() => { locked.current = false; setGame((g) => (g ? advance(g) : g)); }, ADVANCE_MS);
      return;
    }
    // A repeat tap on an object already found does nothing; any other tap is a quiet ripple (no sound, no count).
    if (found.some((j) => { const o = level.objects[j]; return !!o && hitCurrent(o, point, aspect); })) return;
    const key = ++rippleKey.current;
    setRipple({ x: point.x, y: point.y, key });
    later(() => setRipple((r) => (r && r.key === key ? null : r)), RIPPLE_MS);
  }, [level, game, found, won, later]);

  const pictureUrl = level ? mediaUrl(level.image_path) : null;

  return (
    <Stage>
      <div data-find-play data-won={won ? 'true' : 'false'} className={reduced ? 'hm-reduced' : undefined} style={{ position: 'absolute', inset: 0 }}>
        {won && praise ? (
          <FindDone childName={praise.name} completeUrl={praise.url} onAgain={again} levelsHref={LEVELS} />
        ) : (
          <>
            <Hills />
            <div style={{ position: 'absolute', top: 48, zIndex: 2, left: 56, right: 56, display: 'flex', alignItems: 'center' }}>
              <BackButton href={LEVELS} game="find" />
            </div>
          </>
        )}
        {phase === 'missing' && (
          <div role="status" aria-label="This picture is not available" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 400, height: 400, borderRadius: 64, overflow: 'hidden', border: '8px solid #EBB7BC', boxSizing: 'border-box' }}>
              <FlowerBack />
            </span>
          </div>
        )}
        {phase === 'ready' && level && !(won && praise) && (
          <>
            {/* The words, in object order, on the left (F3). The asked word is the current row; the list never shows it once done. */}
            <FindScrollColumn reduced={reduced}>
              <FindWordList objects={level.objects} current={found.length >= level.objects.length ? -1 : index} found={found} onSay={sayAt} />
            </FindScrollColumn>
            {/* The picture fills the rest of the stage (F2): FindBoard sizes it from the picture's aspect, capped at 1500 x 900. */}
            <div style={{ position: 'absolute', left: 560, right: 176, top: 110, bottom: 56, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FindBoard url={pictureUrl} objects={level.objects} found={found} ripple={ripple} reduced={reduced} onTap={onTap} />
            </div>
          </>
        )}
        <MusicButton />
      </div>
    </Stage>
  );
}
