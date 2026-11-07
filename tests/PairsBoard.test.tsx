import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PairsBoard, type BoardProps } from '@/components/pairs/PairsBoard';
import { PairsShelf } from '@/components/pairs/PairsShelf';
import { moveTo } from '@/lib/pairs/board';
import { SLOT_H, SLOT_W, pieceXY, slotXY, wholeXY, shelfXY } from '@/lib/pairs/geometry';
import type { PuzzlePicture } from '@/lib/pairs/types';

/** jsdom has no PointerEvent: a MouseEvent with pointerId and isPrimary (as tests/useSortDrag.test.tsx). */
function pe(type: string, x: number, y: number) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'isPrimary', { value: true });
  return e;
}

const pic = (id: string): PuzzlePicture => ({ id, word: id, image_path: `seed/${id}.svg`, audio_path: null });
const pictures = new Map(['a', 'b', 'c', 'd'].map((id) => [id, pic(id)]));
const ORDER = ['a:L', 'b:R', 'a:R', 'c:L', 'b:L', 'c:R', 'd:L', 'd:R'];
const UP = new Set(['a:L', 'a:R', 'b:R']);
const center = (i: number) => ({ x: slotXY(i).x + SLOT_W / 2, y: slotXY(i).y + SLOT_H / 2 });
const tr = (p: { x: number; y: number }) => `translate(${p.x}px, ${p.y}px)`;

type Over = Partial<Omit<BoardProps, 'stageRef'>>;
function Harness(props: Omit<BoardProps, 'stageRef'>) {
  const stageRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={stageRef} data-testid="stage">
      <PairsBoard {...props} stageRef={stageRef} />
    </div>
  );
}

function setup(over: Over = {}) {
  const cb = { onOpen: vi.fn(), onMove: vi.fn(), onJoin: vi.fn() };
  const props = { pictures, order: ORDER, up: UP, flipping: null, busy: false, joining: null, ...cb, ...over };
  const ui = render(<Harness {...props} />);
  const box = (id: string) => document.querySelector(`[data-piece="${id}"]`) as HTMLElement;
  const hit = (id: string) => box(id).querySelector('[data-hit]') as HTMLElement;
  const down = (id: string, p: { x: number; y: number }) => act(() => { hit(id).dispatchEvent(pe('pointerdown', p.x, p.y)); });
  const move = (p: { x: number; y: number }) => act(() => { window.dispatchEvent(pe('pointermove', p.x, p.y)); });
  const up = (p: { x: number; y: number }) => act(() => { window.dispatchEvent(pe('pointerup', p.x, p.y)); });
  return { cb, ui, box, hit, down, move, up };
}

beforeEach(() => {
  vi.useFakeTimers();
  // The stage is drawn at full size: scale 1, client pixels are stage pixels.
  HTMLElement.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, width: this.getAttribute('data-testid') === 'stage' ? 1920 : 0, height: 1080, right: 1920, bottom: 1080, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PairsBoard faces (H3)', () => {
  it('face-down halves show the back and no picture; face-up halves show the picture', () => {
    const { box } = setup();
    expect(box('c:L').getAttribute('data-up')).toBe('false');
    expect(box('c:L').querySelector('img')).toBeNull();
    expect(box('c:L').querySelector('[data-face="back"]')).not.toBeNull();
    const img = box('a:L').querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('');
    expect(box('a:L').getAttribute('data-up')).toBe('true');
  });

  it('places each half in its slot', () => {
    const { box } = setup();
    expect(box('a:L').style.transform).toBe(tr(pieceXY('L', 0)));
    expect(box('b:R').style.transform).toBe(tr(pieceXY('R', 1)));
  });

  it('never writes the picture word', () => {
    setup({ up: new Set(ORDER) });
    expect(document.body.textContent ?? '').not.toMatch(/\b[abcd]\b/);
  });
});

describe('PairsBoard open (H3, H11)', () => {
  it('a click, Enter or Space on a face-down half opens it; a face-up half does not', () => {
    const { hit, cb } = setup();
    fireEvent.click(hit('c:L'));
    fireEvent.keyDown(hit('b:L'), { key: 'Enter' });
    fireEvent.keyDown(hit('d:R'), { key: ' ' });
    fireEvent.click(hit('a:L'));
    fireEvent.keyDown(hit('a:R'), { key: 'Enter' });
    expect(cb.onOpen.mock.calls).toEqual([['c:L'], ['b:L'], ['d:R']]);
  });

  it('busy ignores clicks and presses', () => {
    const { hit, cb, down, move, box } = setup({ busy: true });
    fireEvent.click(hit('c:L'));
    down('a:L', center(0));
    move({ x: center(0).x + 60, y: center(0).y });
    expect(box('a:L').getAttribute('data-dragging')).toBeNull();
    expect(cb.onOpen).not.toHaveBeenCalled();
  });

  it('Left/Right and Tab move focus in grid order', () => {
    const { hit } = setup();
    hit('a:L').focus();
    fireEvent.keyDown(hit('a:L'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(hit('b:R'));
    fireEvent.keyDown(hit('b:R'), { key: 'Tab' });
    expect(document.activeElement).toBe(hit('a:R'));
    fireEvent.keyDown(hit('a:R'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(hit('b:R'));
    fireEvent.keyDown(hit('b:R'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(hit('a:L'));
  });
});

describe('PairsBoard drag (H8, H9)', () => {
  it('a face-down half cannot be dragged', () => {
    const { down, move, box } = setup();
    down('c:L', center(3));
    move({ x: center(3).x + 50, y: center(3).y });
    expect(box('c:L').getAttribute('data-dragging')).toBeNull();
  });

  it('a face-up half follows the pointer after the slop', () => {
    const { down, move, box } = setup();
    down('a:L', center(0));
    move({ x: center(0).x + 5, y: center(0).y });
    expect(box('a:L').getAttribute('data-dragging')).toBeNull();
    move({ x: center(0).x + 50, y: center(0).y + 20 });
    expect(box('a:L').getAttribute('data-dragging')).toBe('true');
    const p = pieceXY('L', 0);
    expect(box('a:L').style.transform).toContain(tr({ x: p.x + 50, y: p.y + 20 }));
  });

  it('dropping on the other half joins', () => {
    const { down, move, up, cb, box } = setup();
    down('a:L', center(0));
    move(center(1));
    move(center(2));
    expect(box('a:R').getAttribute('data-target')).toBe('true');
    up(center(2));
    expect(cb.onJoin).toHaveBeenCalledWith('a:L', 'a:R');
    expect(cb.onMove).not.toHaveBeenCalled();
  });

  it('dropping on a wrong face-up half slides back with no callback', () => {
    const { down, move, up, cb, box } = setup();
    down('a:L', center(0));
    move(center(1));
    up(center(1));
    expect(cb.onJoin).not.toHaveBeenCalled();
    expect(cb.onMove).not.toHaveBeenCalled();
    expect(box('a:L').getAttribute('data-dragging')).toBeNull();
    expect(box('a:L').style.transform).toBe(tr(pieceXY('L', 0)));
  });

  it('resting 200 ms over a face-down half makes room there', () => {
    const { down, move, up, cb, box } = setup();
    down('a:L', center(0));
    move(center(3));
    act(() => { vi.advanceTimersByTime(200); });
    // the others slide: c:L moved one slot to the left
    expect(box('c:L').style.transform).toBe(tr(pieceXY('L', 2)));
    up(center(3));
    expect(cb.onMove).toHaveBeenCalledWith(moveTo(ORDER, 'a:L', 3));
    expect(cb.onJoin).not.toHaveBeenCalled();
  });

  it('releasing before 200 ms makes no room', () => {
    const { down, move, up, cb } = setup();
    down('a:L', center(0));
    move(center(3));
    act(() => { vi.advanceTimersByTime(100); });
    up(center(3));
    expect(cb.onMove).not.toHaveBeenCalled();
    expect(cb.onJoin).not.toHaveBeenCalled();
  });

  it('a drop outside the board puts it back', () => {
    const { down, move, up, cb, box } = setup();
    down('a:L', center(0));
    move({ x: 40, y: 40 });
    up({ x: 40, y: 40 });
    expect(cb.onMove).not.toHaveBeenCalled();
    expect(box('a:L').style.transform).toBe(tr(pieceXY('L', 0)));
  });
});

describe('PairsBoard join animation (H9)', () => {
  it('slide puts both halves on the whole card at the target slot; fly moves them to the shelf', () => {
    const one = setup({ joining: { a: 'a:L', b: 'a:R', phase: 'slide', shelfIndex: 0 } });
    expect(one.box('a:L').style.transform).toBe(tr(wholeXY(2)));
    expect(one.box('a:R').style.transform).toBe(tr(wholeXY(2)));
    one.ui.unmount();
    const two = setup({ joining: { a: 'a:L', b: 'a:R', phase: 'fly', shelfIndex: 1 } });
    expect(two.box('a:L').style.transform).toBe(`${tr(shelfXY(1))} scale(0.5)`);
    // the others close the gap while it flies: b:R moves from slot 1 to slot 0
    expect(two.box('b:R').style.transform).toBe(tr(pieceXY('R', 0)));
  });
});

describe('PairsShelf', () => {
  it('shows four places and the finished pictures', () => {
    render(<PairsShelf done={[pic('a'), pic('b')]} />);
    expect(document.querySelectorAll('[data-shelf-place]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-shelf-place] img')).toHaveLength(2);
  });
});
