'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dragDelta, moved, stageScale } from '@/lib/sort/drag';
import { dropIntent, isPair, moveTo } from '@/lib/pairs/board';
import type { Pt } from '@/lib/pairs/types';

/** H8: how long the pointer rests over a face-down half or an empty slot before the halves make room. */
export const DWELL_MS = 200;

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
  pointerId: number;
  start: Pt;
  lifted: boolean;
  preview: string[] | null;
  dwellIndex: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  detach: () => void;
};

const client = (e: { clientX: number; clientY: number }): Pt => ({ x: e.clientX, y: e.clientY });

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

  const scaleOf = () => {
    const r = optsRef.current.stageRef.current?.getBoundingClientRect();
    return { scale: stageScale(r?.width ?? 0), left: r?.left ?? 0, top: r?.top ?? 0 };
  };
  const stagePoint = (c: Pt): Pt => {
    const { scale, left, top } = scaleOf();
    return { x: (c.x - left) / scale, y: (c.y - top) / scale };
  };

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

      const onMove = (ev: PointerEvent) => {
        const d = live.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        const c = client(ev);
        if (!d.lifted && !moved(d.start, c)) return;
        d.lifted = true;
        const delta = dragDelta(d.start, c, scaleOf().scale);
        setDragging({ id: d.id, dx: delta.x, dy: delta.y });
        const cur = d.preview ?? optsRef.current.order;
        const intent = dropIntent(cur, optsRef.current.up, d.id, stagePoint(c));
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
        const intent = lifted ? dropIntent(cur, optsRef.current.up, d.id, stagePoint(c)) : { kind: 'none' as const };
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

      live.current = { id, pointerId, start: client(e), lifted: false, preview: null, dwellIndex: null, timer: null, detach };
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
