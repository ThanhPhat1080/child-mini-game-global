import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpotLevel } from '@/lib/spot/types';
import { SpotBoard } from '@/components/spot/SpotBoard';
import { SpotDots } from '@/components/spot/SpotDots';

const level: SpotLevel = {
  id: 'L1', image_a_path: 'a.svg', image_b_path: 'b.svg', active: true, sort_order: 1,
  differences: [{ x: 0.25, y: 0.3, r: 0.06 }, { x: 0.5, y: 0.6, r: 0.06 }, { x: 0.75, y: 0.4, r: 0.06 }],
};
const pic = (s: 'a' | 'b') => document.querySelector<HTMLElement>(`[data-spot-pic="${s}"]`)!;
const area = (s: 'a' | 'b') => document.querySelector<HTMLElement>(`[data-spot-pic="${s}"] [data-spot-area]`)!;
const rect = (el: HTMLElement, r: { left: number; top: number; width: number; height: number }) => {
  el.getBoundingClientRect = () => ({ ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON() {} }) as DOMRect;
};
afterEach(cleanup);

describe('SpotBoard', () => {
  it('reports the click as fractions of the inner picture area, same on A and B', () => {
    const onTap = vi.fn();
    render(<SpotBoard level={level} urlA="/a.svg" urlB="/b.svg" found={[]} onTap={onTap} />);
    rect(area('a'), { left: 100, top: 50, width: 400, height: 300 });
    rect(area('b'), { left: 700, top: 50, width: 400, height: 300 });
    fireEvent.click(pic('a'), { clientX: 200, clientY: 200 });
    expect(onTap).toHaveBeenLastCalledWith({ x: 0.25, y: 0.5 }, 1);
    fireEvent.click(pic('b'), { clientX: 800, clientY: 200 });
    expect(onTap).toHaveBeenLastCalledWith({ x: 0.25, y: 0.5 }, 1);
  });

  it('measures the inner area, not the framed outer box (S3)', () => {
    const onTap = vi.fn();
    render(<SpotBoard level={level} urlA="/a.svg" urlB="/b.svg" found={[]} onTap={onTap} />);
    rect(pic('a'), { left: 92, top: 42, width: 416, height: 316 }); // outer border box incl. 8px frame
    rect(area('a'), { left: 100, top: 50, width: 400, height: 300 });
    fireEvent.click(pic('a'), { clientX: 200, clientY: 200 });
    expect(onTap).toHaveBeenLastCalledWith({ x: 0.25, y: 0.5 }, 1);
  });

  it('a click on the frame (outside the inner area) is not a tap', () => {
    const onTap = vi.fn();
    const onSide = vi.fn();
    render(<SpotBoard level={level} urlA="/a.svg" urlB="/b.svg" found={[]} onTap={onTap} onSide={onSide} />);
    rect(pic('a'), { left: 92, top: 42, width: 416, height: 316 });
    rect(area('a'), { left: 100, top: 50, width: 400, height: 300 });
    fireEvent.click(pic('a'), { clientX: 96, clientY: 200 }); // on the left frame
    fireEvent.click(pic('a'), { clientX: 300, clientY: 46 }); // on the top frame
    fireEvent.click(pic('a'), { clientX: 504, clientY: 200 }); // on the right frame
    fireEvent.click(pic('a'), { clientX: 300, clientY: 354 }); // on the bottom frame
    expect(onTap).not.toHaveBeenCalled();
    expect(onSide).not.toHaveBeenCalled();
  });

  it('uses the CURRENT inner rect at every tap, never a cached size', () => {
    const onTap = vi.fn();
    render(<SpotBoard level={level} urlA="/a.svg" urlB="/b.svg" found={[]} onTap={onTap} />);
    rect(area('a'), { left: 0, top: 0, width: 400, height: 300 });
    fireEvent.click(pic('a'), { clientX: 100, clientY: 150 });
    expect(onTap).toHaveBeenLastCalledWith({ x: 0.25, y: 0.5 }, 1);
    rect(area('a'), { left: 0, top: 0, width: 200, height: 150 });
    fireEvent.click(pic('a'), { clientX: 100, clientY: 75 });
    expect(onTap).toHaveBeenLastCalledWith({ x: 0.5, y: 0.5 }, 1);
  });

  it('draws a ring on both pictures for each found difference, with no text', () => {
    render(<SpotBoard level={level} urlA="/a.svg" urlB="/b.svg" found={[0, 2]} onTap={() => {}} />);
    expect(pic('a').querySelectorAll('[data-spot-found]')).toHaveLength(2);
    expect(pic('b').querySelectorAll('[data-spot-found]')).toHaveLength(2);
    expect(document.body.textContent).toBe('');
  });

  it('draws a ripple only on the tapped side', () => {
    render(<SpotBoard level={level} urlA="/a.svg" urlB="/b.svg" found={[]} onTap={() => {}} ripple={{ side: 'b', x: 0.4, y: 0.6, key: 1 }} />);
    expect(pic('a').querySelectorAll('[data-spot-ripple]')).toHaveLength(0);
    expect(pic('b').querySelectorAll('[data-spot-ripple]')).toHaveLength(1);
  });

  it('a missing picture shows a placeholder and clicks do not throw', () => {
    const onTap = vi.fn();
    render(<SpotBoard level={level} urlA={null} urlB="/b.svg" found={[]} onTap={onTap} />);
    expect(pic('a').querySelector('[data-placeholder]')).not.toBeNull();
    expect(pic('a').querySelector('img')).toBeNull();
    rect(area('a'), { left: 0, top: 0, width: 400, height: 300 });
    expect(() => fireEvent.click(pic('a'), { clientX: 100, clientY: 100 })).not.toThrow();
  });

  it('a picture that fails to load becomes a placeholder', () => {
    render(<SpotBoard level={level} urlA="/a.svg" urlB="/b.svg" found={[]} onTap={() => {}} />);
    fireEvent.error(pic('b').querySelector('img')!);
    expect(pic('b').querySelector('[data-placeholder]')).not.toBeNull();
  });

  it('shows a picture as a 860x860 square before it loads, since pictures are square now (ADR-032)', () => {
    render(<SpotBoard level={level} urlA="/a.svg" urlB="/b.svg" found={[]} onTap={() => {}} />);
    expect(pic('a').style.width).toBe('860px');
    expect(pic('a').style.height).toBe('860px');
  });

  it('shows a portrait picture 860 tall (aspect 0.73) and a 4:3 picture 880x660', async () => {
    const { unmount } = render(<SpotBoard level={level} urlA="/a.svg" urlB="/b.svg" found={[]} onTap={() => {}} />);
    const img = pic('a').querySelector('img')!;
    Object.defineProperty(img, 'naturalWidth', { value: 730, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 1000, configurable: true });
    await act(async () => { fireEvent.load(img); });
    expect(pic('a').style.height).toBe('860px');
    expect(pic('a').style.width).toBe(`${Math.floor(860 * 0.73)}px`);
    expect(pic('b').style.height).toBe('860px');
    unmount();
    render(<SpotBoard level={level} urlA="/a.svg" urlB="/b.svg" found={[]} onTap={() => {}} />);
    const img2 = pic('a').querySelector('img')!;
    Object.defineProperty(img2, 'naturalWidth', { value: 1600, configurable: true });
    Object.defineProperty(img2, 'naturalHeight', { value: 1200, configurable: true });
    await act(async () => { fireEvent.load(img2); });
    expect(pic('a').style.width).toBe('880px');
    expect(pic('a').style.height).toBe('660px');
  });

  it('a zero-size rect is ignored', () => {
    const onTap = vi.fn();
    render(<SpotBoard level={level} urlA="/a.svg" urlB="/b.svg" found={[]} onTap={onTap} />);
    rect(area('a'), { left: 0, top: 0, width: 0, height: 0 });
    fireEvent.click(pic('a'), { clientX: 0, clientY: 0 });
    expect(onTap).not.toHaveBeenCalled();
  });
});

describe('SpotDots', () => {
  it('lights the first `found` dots, labelled, with no text', () => {
    const { container } = render(<SpotDots total={5} found={2} />);
    const root = container.firstElementChild!;
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toBe('Found 2 of 5');
    expect(root.querySelectorAll('[data-spot-dot]')).toHaveLength(5);
    expect(root.querySelectorAll('[data-lit]')).toHaveLength(2);
    expect(root.textContent).toBe('');
  });
});
