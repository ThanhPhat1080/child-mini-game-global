'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { SpotBoard, type SpotRipple } from '@/components/spot/SpotBoard';
import { SpotDots } from '@/components/spot/SpotDots';
import { SpotDone } from '@/components/spot/SpotDone';
import { FlowerBack } from '@/components/memory/FlowerBack';
import { fetchLevel } from '@/lib/spot/levels';
import { hitTest } from '@/lib/spot/hit';
import { isWon, markFound, startSpot, type SpotState } from '@/lib/spot/rules';
import type { SpotLevel } from '@/lib/spot/types';
import { preloadImages } from '@/lib/memory/preload';
import { mediaUrl } from '@/lib/media';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { chime } from '@/lib/sfx';

/** After the last difference, a short breath before the celebration. */
const WIN_DELAY_MS = 1000;
/** How long a miss ripple stays on the picture. */
const RIPPLE_MS = 800;
/** If the settings request has not settled this long after the win, celebrate with the empty default anyway. */
const PRAISE_FALLBACK_MS = 2000;
const LEVELS = '/games/spot';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/** Spot the Differences board (S2-S10). The rules live in lib/spot; this page plays the sound and the animations. */
export default function SpotPlay() {
  const { levelId } = useParams<{ levelId: string }>();
  const game = useRef<SpotState | null>(null);
  const [, setRender] = useState(0);
  const rerender = useCallback(() => setRender((n) => n + 1), []);
  const [phase, setPhase] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [level, setLevel] = useState<SpotLevel | null>(null);
  const [won, setWon] = useState(false);
  const [praise, setPraise] = useState<{ name: string; url: string | null } | null>(null);
  const [ripple, setRipple] = useState<SpotRipple | null>(null);
  const [reduced, setReduced] = useState(false);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const alive = useRef(true);
  const rippleKey = useRef(0);
  /** The picture the latest tap landed on (reported by the board just before the tap). */
  const side = useRef<'a' | 'b'>('a');

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
    };
  }, []);

  // Load the level, preload both pictures, then open the board. A failed load is the same friendly screen as an unknown id.
  useEffect(() => {
    let live = true;
    let stopPreload: (() => void) | null = null;
    const open = async () => {
      let found: SpotLevel | null = null;
      try {
        found = await fetchLevel(String(levelId ?? ''));
      } catch {
        found = null;
      }
      if (!live) return;
      if (!found) { setPhase('missing'); return; }
      stopPreload = preloadImages([mediaUrl(found.image_a_path), mediaUrl(found.image_b_path)], () => {
        if (!live) return;
        game.current = startSpot(found.differences.length);
        setLevel(found);
        setPhase('ready');
      });
    };
    void open();
    return () => { live = false; stopPreload?.(); };
  }, [levelId]);

  // The completion screen needs the child's name and optional custom sound (as the Quiz and Memory done pages).
  useEffect(() => {
    if (!won) return;
    let live = true;
    const done = (name: string, url: string | null) => live && setPraise({ name, url });
    later(() => { if (live) setPraise((p) => p ?? { name: '', url: null }); }, PRAISE_FALLBACK_MS);
    try {
      createSupabaseBrowserClient().from('settings').select('child_name, complete_path').eq('id', 1).single()
        .then(({ data }) => done(data?.child_name ?? '', mediaUrl(data?.complete_path)), () => done('', null));
    } catch {
      done('', null);
    }
    return () => { live = false; };
  }, [won, later]);

  const again = useCallback(() => {
    if (!level) return;
    game.current = startSpot(level.differences.length);
    setWon(false);
    setPraise(null);
    setRipple(null);
    rerender();
  }, [level, rerender]);

  const onTap = useCallback((point: { x: number; y: number }, aspect: number) => {
    const s = game.current;
    if (!s || !level || isWon(s)) return;
    const hit = hitTest(level.differences, new Set(s.found), point, aspect);
    if (hit.kind === 'found') {
      chime();
      game.current = markFound(s, hit.index);
      if (isWon(game.current)) later(() => setWon(true), WIN_DELAY_MS);
    } else if (hit.kind === 'miss') {
      const key = ++rippleKey.current;
      setRipple({ side: side.current, x: point.x, y: point.y, key });
      later(() => setRipple((r) => (r && r.key === key ? null : r)), RIPPLE_MS);
    }
    rerender();
  }, [level, later, rerender]);

  const s = game.current;
  const urlA = level ? mediaUrl(level.image_a_path) : null;
  const urlB = level ? mediaUrl(level.image_b_path) : null;

  return (
    <Stage>
      <div data-spot-play data-won={won ? 'true' : 'false'} className={reduced ? 'hm-reduced' : undefined} style={{ position: 'absolute', inset: 0 }}>
        {won && praise ? (
          <SpotDone childName={praise.name} completeUrl={praise.url} onAgain={again} levelsHref={LEVELS} />
        ) : (
          <>
            <Hills />
            <div style={{ position: 'absolute', top: 48, zIndex: 2, left: 56, right: 56, display: 'flex', alignItems: 'center' }}>
              <BackButton href={LEVELS} />
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
        {phase === 'ready' && s && level && !(won && praise) && (
          <>
            <div style={{ position: 'absolute', top: 78, left: 0, right: 0, zIndex: 1 }}>
              <SpotDots total={s.total} found={s.found.length} />
            </div>
            <div style={{ position: 'absolute', top: 190, left: 0, right: 0, zIndex: 1 }}>
              <SpotBoard level={level} urlA={urlA} urlB={urlB} found={s.found} ripple={ripple} reduced={reduced} onTap={onTap} onSide={(sd) => { side.current = sd; }} />
            </div>
          </>
        )}
        <MusicButton />
      </div>
    </Stage>
  );
}
