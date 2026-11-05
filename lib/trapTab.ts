/**
 * Keeps Tab focus inside a dialog (FP6). Only acts on Tab. At the last item Tab wraps to the first,
 * at the first Shift+Tab wraps to the last, and focus that has left the dialog comes back in.
 */
export function trapTab(e: { key: string; shiftKey: boolean; preventDefault(): void }, root: HTMLElement): void {
  if (e.key !== 'Tab') return;
  const items = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]'));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!root.contains(active)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}
