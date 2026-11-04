import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSortDrag } from '@/components/sort/useSortDrag';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * jsdom (v25) has no PointerEvent, so pointer events are MouseEvents (which carry button and clientX/Y)
 * with pointerId and isPrimary added. React's synthetic pointer events read those fields from the native event.
 */
function pe(type: string, x: number, y: number, init: { pointerId?: number; button?: number; isPrimary?: boolean } = {}) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: init.button ?? 0, clientX: x, clientY: y });
  Object.defineProperty(e, 'pointerId', { value: init.pointerId ?? 1 });
  Object.defineProperty(e, 'isPrimary', { value: init.isPrimary ?? true });
  return e;
}

type Callbacks = { onPickUp: (id: string) => void; onTap: (id: string) => void; onDrop: (id: string, basket: 0 | 1 | null) => void };

function Harness({ busy = false, cb }: { busy?: boolean; cb: Callbacks }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const basketRefs = useRef<(HTMLElement | null)[]>([]);
  const { dragging, press, cancel } = useSortDrag({ stageRef, basketRefs, busy, ...cb });
  return (
    <div ref={stageRef} data-testid="stage">
      <div data-testid="b0" ref={(el) => { basketRefs.current[0] = el; }} />
      <div data-testid="b1" ref={(el) => { basketRefs.current[1] = el; }} />
      <div data-testid="obj-a" onPointerDown={(e) => press('a', e)} />
      <div data-testid="obj-b" onPointerDown={(e) => press('b', e)} />
      <output data-testid="drag">{dragging ? `${dragging.id} ${dragging.dx} ${dragging.dy}` : 'none'}</output>
      <button type="button" onClick={cancel}>cancel</button>
    </div>
  );
}

function rect(left: number, top: number, width: number, height: number) {
  return () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
}

function setup(busy = false) {
  const cb = { onPickUp: vi.fn(), onTap: vi.fn(), onDrop: vi.fn() };
  const ui = render(<Harness busy={busy} cb={cb} />);
  // Stage drawn at 960 px wide: scale 0.5. Basket 0 at x 100-300, basket 1 at x 500-700, both y 100-300.
  screen.getByTestId('stage').getBoundingClientRect = rect(0, 0, 960, 540);
  screen.getByTestId('b0').getBoundingClientRect = rect(100, 100, 200, 200);
  screen.getByTestId('b1').getBoundingClientRect = rect(500, 100, 200, 200);
  const objA = screen.getByTestId('obj-a');
  const down = (x: number, y: number, init?: Parameters<typeof pe>[3], el: HTMLElement = objA) => act(() => { el.dispatchEvent(pe('pointerdown', x, y, init)); });
  const fire = (type: string, x: number, y: number, init?: Parameters<typeof pe>[3]) => act(() => { window.dispatchEvent(pe(type, x, y, init)); });
  const drag = () => screen.getByTestId('drag').textContent;
  return { cb, ui, objA, down, fire, drag };
}

const POINTER_TYPES = ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'];

function countPointerCalls(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter((c) => POINTER_TYPES.includes(c[0] as string)).length;
}

describe('useSortDrag', () => {
  it('moves in stage pixels: client delta divided by the 0.5 scale', () => {
    const { down, fire, drag } = setup();
    down(400, 500);
    expect(drag()).toBe('none');
    fire('pointermove', 420, 510);
    expect(drag()).toBe('a 40 20');
    fire('pointermove', 380, 490);
    expect(drag()).toBe('a -40 -20');
  });

  it('re-reads the stage scale on each move (window resized mid-drag)', () => {
    const { down, fire, drag } = setup();
    down(400, 500);
    fire('pointermove', 420, 510);
    expect(drag()).toBe('a 40 20');
    screen.getByTestId('stage').getBoundingClientRect = rect(0, 0, 1920, 1080);
    fire('pointermove', 430, 510);
    expect(drag()).toBe('a 30 10');
  });

  it('drops on basket 0, basket 1, or outside (null)', () => {
    const { cb, down, fire, drag } = setup();
    down(400, 500);
    fire('pointermove', 200, 200);
    fire('pointerup', 200, 200);
    expect(cb.onDrop).toHaveBeenLastCalledWith('a', 0);
    expect(drag()).toBe('none');

    down(400, 500);
    fire('pointermove', 600, 200);
    fire('pointerup', 600, 200);
    expect(cb.onDrop).toHaveBeenLastCalledWith('a', 1);

    down(400, 500);
    fire('pointermove', 400, 200);
    fire('pointerup', 400, 200);
    expect(cb.onDrop).toHaveBeenLastCalledWith('a', null);

    expect(cb.onDrop).toHaveBeenCalledTimes(3);
    expect(cb.onTap).not.toHaveBeenCalled();
    expect(cb.onPickUp).toHaveBeenCalledTimes(3);
  });

  it('a press and release within 8 px is a tap: onTap once, never onDrop, never lifted', () => {
    const { cb, down, fire, drag } = setup();
    down(400, 500);
    expect(cb.onPickUp).toHaveBeenCalledTimes(1);
    expect(cb.onPickUp).toHaveBeenCalledWith('a');
    fire('pointermove', 405, 505);
    expect(drag()).toBe('none');
    fire('pointerup', 405, 505);
    expect(cb.onTap).toHaveBeenCalledTimes(1);
    expect(cb.onTap).toHaveBeenCalledWith('a');
    expect(cb.onDrop).not.toHaveBeenCalled();
    expect(cb.onPickUp).toHaveBeenCalledTimes(1);
  });

  it('calls onPickUp once on press for a drag too', () => {
    const { cb, down, fire } = setup();
    down(400, 500);
    fire('pointermove', 450, 500);
    fire('pointermove', 500, 500);
    expect(cb.onPickUp).toHaveBeenCalledTimes(1);
  });

  it('pointercancel after a real drag drops on null', () => {
    const { cb, down, fire, drag } = setup();
    down(400, 500);
    fire('pointermove', 200, 200);
    fire('pointercancel', 200, 200);
    expect(cb.onDrop).toHaveBeenCalledTimes(1);
    expect(cb.onDrop).toHaveBeenCalledWith('a', null);
    expect(drag()).toBe('none');
    fire('pointerup', 200, 200);
    expect(cb.onDrop).toHaveBeenCalledTimes(1);
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it('pointercancel before moving calls neither onDrop nor onTap', () => {
    const { cb, down, fire } = setup();
    down(400, 500);
    fire('pointercancel', 400, 500);
    fire('pointerup', 400, 500);
    expect(cb.onDrop).not.toHaveBeenCalled();
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it('lost pointer capture after a real drag drops on null', () => {
    const { cb, down, fire, drag } = setup();
    down(400, 500);
    fire('pointermove', 200, 200);
    fire('lostpointercapture', 200, 200);
    expect(cb.onDrop).toHaveBeenCalledWith('a', null);
    expect(drag()).toBe('none');
  });

  it('ignores events of a second pointer id', () => {
    const { cb, down, fire, drag } = setup();
    down(400, 500);
    fire('pointermove', 200, 200, { pointerId: 2 });
    expect(drag()).toBe('none');
    fire('pointerup', 200, 200, { pointerId: 2 });
    fire('pointercancel', 200, 200, { pointerId: 2 });
    expect(cb.onDrop).not.toHaveBeenCalled();
    expect(cb.onTap).not.toHaveBeenCalled();
    fire('pointermove', 600, 200);
    fire('pointerup', 600, 200);
    expect(cb.onDrop).toHaveBeenCalledWith('a', 1);
  });

  it('treats the right button like the left one', () => {
    const { cb, down, fire } = setup();
    down(400, 500, { button: 2 });
    fire('pointermove', 600, 200);
    fire('pointerup', 600, 200);
    expect(cb.onDrop).toHaveBeenCalledWith('a', 1);
  });

  it('ignores a middle button or a non-primary pointer', () => {
    const { cb, down, fire, drag } = setup();
    down(400, 500, { button: 1 });
    down(400, 500, { isPrimary: false });
    fire('pointermove', 200, 200);
    fire('pointerup', 200, 200);
    expect(drag()).toBe('none');
    expect(cb.onPickUp).not.toHaveBeenCalled();
    expect(cb.onDrop).not.toHaveBeenCalled();
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it('ignores a press while busy', () => {
    const { cb, down, fire, drag } = setup(true);
    down(400, 500);
    fire('pointermove', 200, 200);
    fire('pointerup', 200, 200);
    expect(drag()).toBe('none');
    expect(cb.onPickUp).not.toHaveBeenCalled();
    expect(cb.onDrop).not.toHaveBeenCalled();
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it('ignores a second press while a drag is active', () => {
    const { cb, down, fire, drag } = setup();
    down(400, 500);
    fire('pointermove', 420, 510);
    down(420, 510, { pointerId: 2 }, screen.getByTestId('obj-b'));
    down(420, 510, {}, screen.getByTestId('obj-b'));
    expect(cb.onPickUp).toHaveBeenCalledTimes(1);
    expect(drag()).toBe('a 40 20');
    fire('pointerup', 600, 200);
    expect(cb.onDrop).toHaveBeenCalledTimes(1);
    expect(cb.onDrop).toHaveBeenCalledWith('a', 1);
  });

  it('captures the pointer on the pressed element when it can', () => {
    const { down, objA } = setup();
    const capture = vi.fn();
    objA.setPointerCapture = capture;
    down(400, 500, { pointerId: 7 });
    expect(capture).toHaveBeenCalledWith(7);
  });

  it('does not throw when setPointerCapture throws', () => {
    const { cb, down, fire, objA } = setup();
    objA.setPointerCapture = () => { throw new Error('InvalidStateError'); };
    expect(() => down(400, 500)).not.toThrow();
    fire('pointerup', 400, 500);
    expect(cb.onTap).toHaveBeenCalledTimes(1);
  });

  it('removes each window listener exactly once after a drop', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { down, fire } = setup();
    down(400, 500);
    expect(countPointerCalls(add)).toBe(4);
    fire('pointermove', 200, 200);
    fire('pointermove', 210, 200);
    expect(countPointerCalls(add)).toBe(4);
    fire('pointerup', 200, 200);
    expect(countPointerCalls(remove)).toBe(4);
    fireEvent.click(screen.getByText('cancel'));
    expect(countPointerCalls(remove)).toBe(4);
  });

  it('cancel() mid-drag removes the listeners, clears dragging and calls neither callback', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { cb, down, fire, drag } = setup();
    down(400, 500);
    fire('pointermove', 200, 200);
    expect(drag()).not.toBe('none');
    fireEvent.click(screen.getByText('cancel'));
    expect(drag()).toBe('none');
    expect(countPointerCalls(remove)).toBe(4);
    fire('pointerup', 200, 200);
    fire('pointercancel', 200, 200);
    expect(cb.onDrop).not.toHaveBeenCalled();
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it('unmount mid-drag removes the listeners; a late pointerup does nothing', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { cb, ui, down, fire } = setup();
    down(400, 500);
    fire('pointermove', 200, 200);
    ui.unmount();
    expect(countPointerCalls(remove)).toBe(4);
    fire('pointerup', 200, 200);
    fire('pointercancel', 200, 200);
    expect(cb.onDrop).not.toHaveBeenCalled();
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it('a new drag works after a finished one', () => {
    const { cb, down, fire, drag } = setup();
    down(400, 500);
    fire('pointermove', 200, 200);
    fire('pointerup', 200, 200);
    down(400, 500, {}, screen.getByTestId('obj-b'));
    fire('pointermove', 410, 500);
    expect(drag()).toBe('b 20 0');
    fire('pointerup', 600, 200);
    expect(cb.onDrop).toHaveBeenNthCalledWith(1, 'a', 0);
    expect(cb.onDrop).toHaveBeenNthCalledWith(2, 'b', 1);
  });
});
