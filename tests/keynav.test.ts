import { afterEach, describe, expect, it, vi } from 'vitest';
import { gridStep, handleChoiceKey, isPressKey, stepFocus } from '@/lib/keynav';

afterEach(() => { document.body.innerHTML = ''; });

function row(tag: 'button' | 'a', n = 3) {
  const items = Array.from({ length: n }, (_, i) => {
    const el = document.createElement(tag);
    el.textContent = String(i + 1);
    if (tag === 'a') el.setAttribute('href', '#');
    document.body.appendChild(el);
    return el as HTMLElement;
  });
  return items;
}
const key = (k: string) => new KeyboardEvent('keydown', { key: k, cancelable: true });

describe('keynav', () => {
  it('Enter and Space press a focused choice', () => {
    expect(isPressKey({ key: 'Enter' })).toBe(true);
    expect(isPressKey({ key: ' ' })).toBe(true);
    expect(isPressKey({ key: 'a' })).toBe(false);
  });

  it('with nothing focused, Right starts at the first choice and Left at the last', () => {
    const items = row('button');
    stepFocus(items, 1);
    expect(document.activeElement).toBe(items[0]);
    (document.activeElement as HTMLElement).blur();
    stepFocus(items, -1);
    expect(document.activeElement).toBe(items[2]);
  });

  it('arrows move one step and stop at the ends', () => {
    const items = row('button');
    items[1].focus();
    stepFocus(items, 1);
    expect(document.activeElement).toBe(items[2]);
    stepFocus(items, 1);
    expect(document.activeElement).toBe(items[2]);
    stepFocus(items, -1);
    stepFocus(items, -1);
    stepFocus(items, -1);
    expect(document.activeElement).toBe(items[0]);
  });

  it('handleChoiceKey uses the arrows and prevents the default scroll', () => {
    const items = row('button');
    const e = key('ArrowRight');
    expect(handleChoiceKey(e, items)).toBe(true);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items[0]);
  });

  it('Space clicks a focused link (links only react to Enter by default)', () => {
    const items = row('a');
    const click = vi.fn((ev: Event) => ev.preventDefault());
    items[1].addEventListener('click', click);
    items[1].focus();
    expect(handleChoiceKey(key(' '), items)).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('Space on a button is left to the browser (native click), other keys are ignored', () => {
    const items = row('button');
    items[0].focus();
    const e = key(' ');
    expect(handleChoiceKey(e, items)).toBe(false);
    expect(e.defaultPrevented).toBe(false);
    expect(handleChoiceKey(key('x'), items)).toBe(false);
  });
});

describe('gridStep', () => {
  const ev = (k: string) => ({ key: k, preventDefault: vi.fn() });

  it('Down moves by cols, Up at the top stays', () => {
    const items = row('button', 6);
    items[0].focus();
    const e = ev('ArrowDown');
    expect(gridStep(items, 3, e)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(items[3]);
    items[0].focus();
    expect(gridStep(items, 3, ev('ArrowUp'))).toBe(true);
    expect(document.activeElement).toBe(items[0]);
  });

  it('Right at the last item stays, Left moves back one', () => {
    const items = row('button', 6);
    items[5].focus();
    gridStep(items, 3, ev('ArrowRight'));
    expect(document.activeElement).toBe(items[5]);
    items[3].focus();
    gridStep(items, 3, ev('ArrowLeft'));
    expect(document.activeElement).toBe(items[2]);
  });

  it('with nothing focused, an arrow focuses the first item', () => {
    const items = row('button', 6);
    expect(gridStep(items, 3, ev('ArrowRight'))).toBe(true);
    expect(document.activeElement).toBe(items[0]);
  });

  it('other keys return false and do nothing', () => {
    const items = row('button', 6);
    items[1].focus();
    const e = ev('x');
    expect(gridStep(items, 3, e)).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(items[1]);
  });
});
