import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdultCheck from '@/components/auth/AdultCheck';

afterEach(cleanup);

// random 0 -> 6, so 6 + 6 = 12
const setup = (random: () => number = () => 0) => {
  const onPass = vi.fn();
  const onCancel = vi.fn();
  const view = render(<AdultCheck open onPass={onPass} onCancel={onCancel} random={random} />);
  return { onPass, onCancel, view };
};
const input = () => screen.getByRole('textbox') as HTMLInputElement;
const question = () => screen.getByTestId('adult-question').textContent;
const submit = (v: string) => {
  fireEvent.change(input(), { target: { value: v } });
  fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
};

describe('AdultCheck Escape isolation', () => {
  it('Esc closes the dialog without reaching window bubble listeners, and reaches them again after close', () => {
    const spy = vi.fn();
    window.addEventListener('keydown', spy);
    function Host() {
      const [open, setOpen] = useState(true);
      return <AdultCheck open={open} onPass={() => {}} onCancel={() => setOpen(false)} />;
    }
    render(<Host />);
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', spy);
  });
});

describe('AdultCheck (U10)', () => {
  it('wrong answer keeps the dialog open and does not call onPass', () => {
    const { onPass } = setup();
    submit('99');
    expect(onPass).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(input().value).toBe('');
  });

  it('wrong answer generates new numbers', () => {
    const seq = [0, 0, 0.999, 0.999];
    let i = 0;
    setup(() => seq[i++ % seq.length]);
    expect(question()).toMatch(/6 \+ 6/);
    submit('1');
    expect(question()).toMatch(/9 \+ 9/);
  });

  it('correct answer calls onPass', () => {
    const { onPass } = setup();
    submit('12');
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('Enter submits', () => {
    const { onPass } = setup();
    fireEvent.change(input(), { target: { value: '12' } });
    fireEvent.submit(input().closest('form')!);
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('Cancel and Escape call onCancel', () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('sum is always between 12 and 18 for random values 0, 0.5 and 0.999', () => {
    for (const r of [0, 0.5, 0.999]) {
      const { view } = setup(() => r);
      const m = question()!.match(/(\d+) \+ (\d+)/)!;
      const sum = Number(m[1]) + Number(m[2]);
      expect(sum).toBeGreaterThanOrEqual(12);
      expect(sum).toBeLessThanOrEqual(18);
      view.unmount();
    }
  });

  it('Tab stays inside the dialog', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    const ok = screen.getByRole('button', { name: /^ok$/i });
    ok.focus();
    fireEvent.keyDown(ok, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    // the top-right Close button is the first item in the cycle now (FA4), so Tab wraps to it
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    // Close is the first item now, so Shift+Tab from it wraps to OK
    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(ok);
  });
});
