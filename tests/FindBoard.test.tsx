import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FindObject } from '@/lib/find/types';
import { FindBoard } from '@/components/find/FindBoard';

const objects: FindObject[] = [
  { x: 0.25, y: 0.3, r: 0.06, word: 'apple', audio_path: null },
  { x: 0.5, y: 0.6, r: 0.06, word: 'ball', audio_path: null },
  { x: 0.75, y: 0.4, r: 0.06, word: 'cat', audio_path: null },
];
const pic = () => document.querySelector<HTMLElement>('[data-find-pic]')!;
const area = () => document.querySelector<HTMLElement>('[data-find-area]')!;
const rect = (el: HTMLElement, r: { left: number; top: number; width: number; height: number }) => {
  el.getBoundingClientRect = () => ({ ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON() {} }) as DOMRect;
};
afterEach(cleanup);

describe('FindBoard (F2-F9)', () => {
  it('reports the click as fractions of the inner picture area', () => {
    const onTap = vi.fn();
    render(<FindBoard url="/a.svg" objects={objects} found={[]} onTap={onTap} />);
    rect(area(), { left: 100, top: 50, width: 400, height: 300 });
    fireEvent.click(area(), { clientX: 200, clientY: 200 });
    expect(onTap).toHaveBeenLastCalledWith({ x: 0.25, y: 0.5 }, 1);
  });

  it('a click on the frame (outside the inner area) is not a tap', () => {
    const onTap = vi.fn();
    render(<FindBoard url="/a.svg" objects={objects} found={[]} onTap={onTap} />);
    rect(pic(), { left: 92, top: 42, width: 416, height: 316 });
    rect(area(), { left: 100, top: 50, width: 400, height: 300 });
    fireEvent.click(pic(), { clientX: 96, clientY: 200 });
    fireEvent.click(pic(), { clientX: 300, clientY: 46 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it('uses the CURRENT rect at every tap, never a cached size', () => {
    const onTap = vi.fn();
    render(<FindBoard url="/a.svg" objects={objects} found={[]} onTap={onTap} />);
    rect(area(), { left: 0, top: 0, width: 400, height: 300 });
    fireEvent.click(area(), { clientX: 100, clientY: 150 });
    expect(onTap).toHaveBeenLastCalledWith({ x: 0.25, y: 0.5 }, 1);
    rect(area(), { left: 0, top: 0, width: 200, height: 150 });
    fireEvent.click(area(), { clientX: 100, clientY: 75 });
    expect(onTap).toHaveBeenLastCalledWith({ x: 0.5, y: 0.5 }, 1);
  });

  it('a zero-size rect is ignored', () => {
    const onTap = vi.fn();
    render(<FindBoard url="/a.svg" objects={objects} found={[]} onTap={onTap} />);
    rect(area(), { left: 0, top: 0, width: 0, height: 0 });
    fireEvent.click(area(), { clientX: 0, clientY: 0 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it('draws a ring for each found object and no text', () => {
    render(<FindBoard url="/a.svg" objects={objects} found={[0, 2]} onTap={() => {}} />);
    expect(document.querySelectorAll('[data-find-found]')).toHaveLength(2);
    expect(document.body.textContent).toBe('');
  });

  it('draws a ripple at the tap point', () => {
    render(<FindBoard url="/a.svg" objects={objects} found={[]} onTap={() => {}} ripple={{ x: 0.4, y: 0.6, key: 1 }} />);
    expect(document.querySelectorAll('[data-find-ripple]')).toHaveLength(1);
  });

  it('a missing picture shows a placeholder and clicks do not throw', () => {
    const onTap = vi.fn();
    render(<FindBoard url={null} objects={objects} found={[]} onTap={onTap} />);
    expect(area().querySelector('[data-placeholder]')).not.toBeNull();
    expect(area().querySelector('img')).toBeNull();
    rect(area(), { left: 0, top: 0, width: 400, height: 300 });
    expect(() => fireEvent.click(area(), { clientX: 100, clientY: 100 })).not.toThrow();
  });

  it('a picture that fails to load becomes a placeholder', () => {
    render(<FindBoard url="/a.svg" objects={objects} found={[]} onTap={() => {}} />);
    fireEvent.error(area().querySelector('img')!);
    expect(area().querySelector('[data-placeholder]')).not.toBeNull();
  });

  it('a picture is a 900x900 square before it loads, since pictures are square now (ADR-032)', () => {
    render(<FindBoard url="/a.svg" objects={objects} found={[]} onTap={() => {}} />);
    expect(pic().style.width).toBe('900px');
    expect(pic().style.height).toBe('900px');
  });

  it('a 2:1 picture fills 1184 px wide, a tall one fills 900 px high', async () => {
    const { unmount } = render(<FindBoard url="/a.svg" objects={objects} found={[]} onTap={() => {}} />);
    const img = area().querySelector('img')!;
    Object.defineProperty(img, 'naturalWidth', { value: 2000, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 1000, configurable: true });
    await act(async () => { fireEvent.load(img); });
    expect(pic().style.width).toBe('1184px');
    expect(pic().style.height).toBe('592px'); // 1184 / 2
    unmount();
    render(<FindBoard url="/a.svg" objects={objects} found={[]} onTap={() => {}} />);
    const img2 = area().querySelector('img')!;
    Object.defineProperty(img2, 'naturalWidth', { value: 730, configurable: true });
    Object.defineProperty(img2, 'naturalHeight', { value: 1000, configurable: true });
    await act(async () => { fireEvent.load(img2); });
    expect(pic().style.height).toBe('900px');
    expect(pic().style.width).toBe(`${Math.floor(900 * 0.73)}px`);
  });
});
