import { afterEach, describe, expect, it, vi } from 'vitest';
import { trapTab } from '@/lib/trapTab';

afterEach(() => { document.body.innerHTML = ''; });

function dialog() {
  document.body.innerHTML = '<div id="d"><button id="a">a</button><input id="b" /><button id="c">c</button></div><button id="out">out</button>';
  return document.getElementById('d') as HTMLElement;
}
const press = (key: string, shiftKey = false) => {
  const preventDefault = vi.fn();
  return { event: { key, shiftKey, preventDefault }, preventDefault };
};

describe('trapTab (FP6)', () => {
  it('Tab on the last item wraps to the first', () => {
    const root = dialog();
    (document.getElementById('c') as HTMLElement).focus();
    const { event, preventDefault } = press('Tab');
    trapTab(event, root);
    expect(preventDefault).toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('a');
  });
  it('Shift+Tab on the first item wraps to the last', () => {
    const root = dialog();
    (document.getElementById('a') as HTMLElement).focus();
    const { event } = press('Tab', true);
    trapTab(event, root);
    expect(document.activeElement?.id).toBe('c');
  });
  it('focus outside the dialog comes back in', () => {
    const root = dialog();
    (document.getElementById('out') as HTMLElement).focus();
    const { event } = press('Tab');
    trapTab(event, root);
    expect(document.activeElement?.id).toBe('a');
  });
  it('does nothing for other keys', () => {
    const root = dialog();
    (document.getElementById('c') as HTMLElement).focus();
    const { event, preventDefault } = press('Enter');
    trapTab(event, root);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('c');
  });
});
