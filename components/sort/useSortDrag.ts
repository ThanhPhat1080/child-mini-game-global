'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dragDelta, hitBasket, moved, stageScale, type Pt, type Rect } from '@/lib/sort/drag';

export type SortDragOptions = {
  /** The page root that fills the scaled stage; its on-screen width gives the stage scale. */
  stageRef: React.RefObject<HTMLElement | null>;
  /** Basket 0 and basket 1 elements; a drop is tested against their on-screen rectangles. */
  basketRefs: React.RefObject<(HTMLElement | null)[]>;
  /** While true (slide-back, right-drop settle) a press is ignored. */
  busy: boolean;
  onPickUp: (id: string) => void;
  onTap: (id: string) => void;
  onDrop: (id: string, basket: 0 | 1 | null) => void;
};

export type SortDragging = { id: string; dx: number; dy: number };

type Live = { id: string; pointerId: number; start: Pt; scale: number; lifted: boolean; detach: () => void };

const pt = (e: { clientX: number; clientY: number }): Pt => ({ x: e.clientX, y: e.clientY });

/**
 * Pointer drag for Sort It (R3, R9): one object at a time, primary button of the first pointer only.
 * `dragging` is set once the pointer moves beyond the tap slop; dx/dy are stage pixels.
 * Release: a tap calls onTap, a drag calls onDrop with the basket under the pointer (or null).
 * pointercancel / lost capture after a real drag calls onDrop(id, null). cancel() and unmount call neither.
 */
export function useSortDrag(opts: SortDragOptions): {
  dragging: SortDragging | null;
  press: (id: string, e: React.PointerEvent<HTMLElement>) => void;
  cancel: () => void;
} {
  const [dragging, setDragging] = useState<SortDragging | null>(null);
  const optsRef = useRef(opts);
  const live = useRef<Live | null>(null);

  useEffect(() => {
    optsRef.current = opts;
  });

  /** Ends the live drag (if any): removes the listeners once and clears `dragging`. Returns the ended drag. */
  const end = useCallback((): Live | null => {
    const d = live.current;
    if (!d) return null;
    live.current = null;
    d.detach();
    setDragging(null);
    return d;
  }, []);

  const press = useCallback(
    (id: string, e: React.PointerEvent<HTMLElement>) => {
      const o = optsRef.current;
      // Right button counts as left (the child's right-click is treated as a click everywhere else too).
      if (o.busy || live.current || (e.button !== 0 && e.button !== 2) || e.isPrimary === false) return;
      const pointerId = e.pointerId;
      const target = e.currentTarget;

      const readScale = (fallback: number) => {
        const stage = optsRef.current.stageRef.current;
        return stage ? stageScale(stage.getBoundingClientRect().width) : fallback;
      };

      const onMove = (ev: PointerEvent) => {
        const d = live.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        const p = pt(ev);
        if (!d.lifted && !moved(d.start, p)) return;
        d.lifted = true;
        d.scale = readScale(d.scale);
        const delta = dragDelta(d.start, p, d.scale);
        setDragging({ id: d.id, dx: delta.x, dy: delta.y });
      };
      const onUp = (ev: PointerEvent) => {
        const d = live.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        const p = pt(ev);
        const lifted = d.lifted || moved(d.start, p);
        const rects: (Rect | null)[] = [0, 1].map((i) => optsRef.current.basketRefs.current?.[i]?.getBoundingClientRect() ?? null);
        end();
        if (lifted) optsRef.current.onDrop(d.id, hitBasket(p, rects));
        else optsRef.current.onTap(d.id);
      };
      const onCancel = (ev: PointerEvent) => {
        const d = live.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        end();
        if (d.lifted) optsRef.current.onDrop(d.id, null);
      };

      const detach = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('lostpointercapture', onCancel);
      };

      live.current = { id, pointerId, start: pt(e), scale: readScale(1), lifted: false, detach };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('lostpointercapture', onCancel);

      if (target && typeof target.setPointerCapture === 'function') {
        try {
          target.setPointerCapture(pointerId);
        } catch {
          // No capture (pointer already gone, or not supported): window listeners still follow the pointer.
        }
      }

      o.onPickUp(id);
    },
    [end],
  );

  const cancel = useCallback(() => {
    end();
  }, [end]);

  useEffect(
    () => () => {
      const d = live.current;
      live.current = null;
      d?.detach();
    },
    [],
  );

  return { dragging, press, cancel };
}
