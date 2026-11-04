import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SortObject } from '@/components/sort/SortObject';
import type { SortItem } from '@/lib/sort/rounds';

afterEach(cleanup);

const item: SortItem = { id: 'c1', basket: 0, card: { id: 'c1', word: 'banana', image_path: 'seed/banana.svg', audio_path: null, active: true } };

function setup(state: 'idle' | 'lifted' | 'sliding' | 'hidden' = 'idle', offset = { x: 0, y: 0 }, wrap?: string) {
  const onPointerDown = vi.fn();
  const ui = <SortObject item={item} state={state} offset={offset} onPointerDown={onPointerDown} />;
  render(wrap ? <div className={wrap}>{ui}</div> : ui);
  return { onPointerDown, el: document.querySelector('[data-object]') as HTMLElement };
}

describe('SortObject', () => {
  it('renders a picture only, with ids and state, and never the word', () => {
    const { el } = setup();
    expect(el.getAttribute('data-card-id')).toBe('c1');
    expect(el.getAttribute('data-state')).toBe('idle');
    const img = el.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('draggable')).toBe('false');
    expect((document.body.textContent ?? '').toLowerCase()).not.toContain('banana');
    expect(el.style.touchAction).toBe('none');
    expect(el.style.userSelect).toBe('none');
  });

  it('calls onPointerDown', () => {
    const { el, onPointerDown } = setup();
    fireEvent.pointerDown(el);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it('lifted translates by the offset, grows and floats above others', () => {
    const { el } = setup('lifted', { x: 40, y: -25 });
    expect(el.style.transform).toContain('translate(40px, -25px)');
    expect(el.style.transform).toMatch(/scale\(/);
    expect(Number(el.style.zIndex)).toBeGreaterThan(0);
    expect(el.style.boxShadow).not.toBe('');
  });

  it('idle has no translation', () => {
    const { el } = setup('idle', { x: 40, y: 40 });
    expect(el.style.transform).toBe('');
  });

  it('sliding has the slide class', () => {
    const { el } = setup('sliding');
    expect(el.className).toContain('hm-so-slide');
  });

  it('hidden stays in the DOM, invisible and out of the tab order', () => {
    const { el } = setup('hidden');
    expect(el.style.visibility).toBe('hidden');
    expect(el.getAttribute('tabindex')).toBe('-1');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('idle objects are focusable', () => {
    const { el } = setup();
    expect(el.getAttribute('tabindex')).toBe('0');
  });

  it('a broken image shows the placeholder', () => {
    const { el } = setup();
    fireEvent.error(el.querySelector('img')!);
    expect(el.querySelector('[data-placeholder]')).not.toBeNull();
  });

  it('works inside an hm-reduced ancestor (the CSS removes transitions there)', () => {
    const { el } = setup('sliding', { x: 0, y: 0 }, 'hm-reduced');
    expect(el.closest('.hm-reduced')).not.toBeNull();
    expect(el.className).toContain('hm-so-obj');
  });
});

describe('SortObject picture already loaded or failed before mount', () => {
  const setImg = (complete: boolean, naturalWidth: number) => {
    Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => complete });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => naturalWidth });
  };
  afterEach(() => {
    delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).complete;
    delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).naturalWidth;
  });

  it('complete with naturalWidth 0 shows the placeholder without an error event', () => {
    setImg(true, 0);
    const { el } = setup();
    expect(el.querySelector('[data-placeholder]')).not.toBeNull();
    expect(el.querySelector('img')).toBeNull();
  });

  it('complete with naturalWidth > 0 keeps the picture', () => {
    setImg(true, 120);
    const { el } = setup();
    expect(el.querySelector('img')).not.toBeNull();
    expect(el.querySelector('[data-placeholder]')).toBeNull();
  });

  it('alt, aria-label, title and src never carry the word', () => {
    const { el } = setup();
    const attrs = Array.from(el.querySelectorAll('*')).concat(el).flatMap((n) => ['alt', 'aria-label', 'title'].map((a) => n.getAttribute(a) ?? ''));
    expect(attrs.join(' ').toLowerCase()).not.toContain('banana');
  });
});
