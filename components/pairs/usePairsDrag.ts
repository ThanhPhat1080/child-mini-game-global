'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dragDelta, moved, stageScale } from '@/lib/sort/drag';
import { dropIntent, isPair, magnetTarget, moveTo, parsePieceId, type DropIntent } from '@/lib/pairs/board';
import { CARD, HALF, pieceXY } from '@/lib/pairs/geometry';
import type { Pt, Side } from '@/lib/pairs/types';

/**
 * H8: how long the dragged half must rest over a face-down half or an empty slot before the halves make room.
 * 0.6 s (0.2 s before the PO's play-test).
 */
export const DWELL_MS = 600;

export type PairsDragOptions = {
  stageRef: React.RefObject<HTMLElement | null>;
  busy: boolean;
  order: readonly string[];
  up: ReadonlySet<string>;
  onMove: (order: string[]) => void;
  onJoin: (dragId: string, targetId: string) => void;
};

export type PairsDragging = { id: string; dx: number; dy: number };

type Live = {
  id: string;
  side: Side;
  /** The box position of the dragged half at press (`pieceXY`). */
  home: Pt;
  pointerId: number;
  start: Pt;
  lifted: boolean;
  preview: string[] | null;
  dwellIndex: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  detach: () => void;
};

const client = (e: { clientX: number; clientY: number }): Pt => ({ x: e.clientX, y: e.clientY });

/** The stage point of the dragged half's visible centre (H8): its box at press, moved by the drag. */
const centreOf = (d: Pick<Live, 'side' | 'home'>, delta: Pt): Pt => ({
  x: d.home.x + delta.x + (d.side === 'L' ? HALF / 2 : CARD - HALF / 2),
  y: d.home.y + delta.y + CARD / 2,
});

/** What the dragged half would do where it is drawn (H8, H9): the magnet to its partner first, else the slot under it. */
function aimAt(cur: readonly string[], up: ReadonlySet<string>, d: Pick<Live, 'id' | 'side' | 'home'>, delta: Pt): DropIntent {
  const centre = centreOf(d, delta);
  const partner = magnetTarget(cur, up, d.id, centre);
  return partner ? { kind: 'join', targetId: partner } : dropIntent(cur, up, d.id, centre);
}

/**
 * Pointer drag of one face-up half (H8, H9): primary pointer only, starts after the tap slop.
 * `preview` is the order while the halves make room; `target` is the face-up half under the pointer.
 * Release on the other half calls onJoin; otherwise a changed preview is committed with onMove.
 */
export function usePairsDrag(opts: PairsDragOptions) {
  const [dragging, setDragging] = useState<PairsDragging | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const optsRef = useRef(opts);
  const live = useRef<Live | null>(null);

  useEffect(() => {
    optsRef.current = opts;
  });

  const scaleOf = () => stageScale(optsRef.current.stageRef.current?.getBoundingClientRect().width ?? 0);

  const end = useCallback((): Live | null => {
    const d = live.current;
    if (!d) return null;
    live.current = null;
    if (d.timer) clearTimeout(d.timer);
    d.detach();
    setDragging(null);
    setPreview(null);
    setTarget(null);
    return d;
  }, []);

  const press = useCallback(
    (id: string, e: React.PointerEvent<HTMLElement>) => {
      const o = optsRef.current;
      if (o.busy || live.current || e.button !== 0 || e.isPrimary === false) return;
      const pointerId = e.pointerId;
      const el = e.currentTarget;
      const { side } = parsePieceId(id);
      const home = pieceXY(side, o.order.indexOf(id));

      const onMove = (ev: PointerEvent) => {
        const d = live.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        const c = client(ev);
        if (!d.lifted && !moved(d.start, c)) return;
        d.lifted = true;
        const delta = dragDelta(d.start, c, scaleOf());
        setDragging({ id: d.id, dx: delta.x, dy: delta.y });
        const cur = d.preview ?? optsRef.current.order;
        const intent = aimAt(cur, optsRef.current.up, d, delta);
        setTarget(intent.kind === 'join' ? intent.targetId : null);
        if (intent.kind !== 'room') {
          if (d.timer) clearTimeout(d.timer);
          d.timer = null;
          d.dwellIndex = null;
          return;
        }
        if (d.dwellIndex === intent.index) return;
        if (d.timer) clearTimeout(d.timer);
        d.dwellIndex = intent.index;
        d.timer = setTimeout(() => {
          const now = live.current;
          if (!now || now !== d) return;
          now.preview = moveTo(now.preview ?? optsRef.current.order, now.id, intent.index);
          now.dwellIndex = null;
          now.timer = null;
          setPreview(now.preview);
        }, DWELL_MS);
      };

      const onUp = (ev: PointerEvent) => {
        const d = live.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        const c = client(ev);
        const lifted = d.lifted || moved(d.start, c);
        const cur = d.preview ?? optsRef.current.order;
        const intent: DropIntent = lifted ? aimAt(cur, optsRef.current.up, d, dragDelta(d.start, c, scaleOf())) : { kind: 'none' };
        const changed = !!d.preview && d.preview.join() !== optsRef.current.order.join();
        end();
        if (!lifted) return;
        if (changed) optsRef.current.onMove(d.preview as string[]);
        if (intent.kind === 'join' && isPair(d.id, intent.targetId)) optsRef.current.onJoin(d.id, intent.targetId);
      };

      const onCancel = (ev: PointerEvent) => {
        const d = live.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        end();
      };

      const detach = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('lostpointercapture', onCancel);
      };

      live.current = { id, side, home, pointerId, start: client(e), lifted: false, preview: null, dwellIndex: null, timer: null, detach };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('lostpointercapture', onCancel);
      if (el && typeof el.setPointerCapture === 'function') {
        try {
          el.setPointerCapture(pointerId);
        } catch {
          // no capture: the window listeners still follow the pointer
        }
      }
    },
    [end],
  );

  useEffect(() => () => { end(); }, [end]);

  return { dragging, preview, target, press, cancel: end };
}
