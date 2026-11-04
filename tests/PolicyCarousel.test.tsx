import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PolicyCarousel from '@/components/auth/PolicyCarousel';
import { POLICY_SLIDES, POLICY_VERSION } from '@/lib/policy/slides';
import { BAN_REASONS } from '@/lib/policy/reasons';

afterEach(cleanup);

const register = () => screen.getByRole('button', { name: /register/i });
const next = () => screen.getByRole('button', { name: /next/i });
const dot = (n: number) => screen.getByRole('button', { name: `Slide ${n}` });
const current = () => screen.getByTestId('slide-index').textContent;

function setup() {
  const onClose = vi.fn();
  const onAccept = vi.fn();
  const utils = render(<PolicyCarousel open onClose={onClose} onAccept={onAccept} />);
  return { onClose, onAccept, ...utils };
}

describe('PolicyCarousel (U16)', () => {
  it('Register is disabled on slides 1-5 and enabled on slide 6', () => {
    setup();
    for (let i = 1; i <= 5; i++) {
      expect(current()).toBe(String(i));
      expect(register().hasAttribute('disabled')).toBe(true);
      fireEvent.click(next());
    }
    expect(current()).toBe('6');
    expect(register().hasAttribute('disabled')).toBe(false);
  });

  it('clicking dot 6 from slide 1 does nothing', () => {
    setup();
    expect(dot(6).hasAttribute('disabled')).toBe(true);
    fireEvent.click(dot(6));
    expect(current()).toBe('1');
    expect(register().hasAttribute('disabled')).toBe(true);
  });

  it('Back works and the furthest-viewed rule holds', () => {
    setup();
    fireEvent.click(next());
    fireEvent.click(next());
    expect(current()).toBe('3');
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(current()).toBe('2');
    expect(dot(3).hasAttribute('disabled')).toBe(false);
    expect(dot(4).hasAttribute('disabled')).toBe(true);
    fireEvent.click(dot(3));
    expect(current()).toBe('3');
    fireEvent.click(dot(4));
    expect(current()).toBe('3');
  });

  it('closing never calls onAccept', () => {
    const { onClose, onAccept } = setup();
    for (let i = 0; i < 5; i++) fireEvent.click(next());
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('Register on the last slide calls onAccept', () => {
    const { onAccept } = setup();
    for (let i = 0; i < 5; i++) fireEvent.click(next());
    fireEvent.click(register());
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('ArrowRight advances', () => {
    setup();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(current()).toBe('2');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' });
    expect(current()).toBe('1');
  });

  it('reopening resets to slide 1 with Register disabled', () => {
    const onClose = vi.fn();
    const onAccept = vi.fn();
    const { rerender } = render(<PolicyCarousel open onClose={onClose} onAccept={onAccept} />);
    for (let i = 0; i < 5; i++) fireEvent.click(next());
    expect(register().hasAttribute('disabled')).toBe(false);
    rerender(<PolicyCarousel open={false} onClose={onClose} onAccept={onAccept} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<PolicyCarousel open onClose={onClose} onAccept={onAccept} />);
    expect(current()).toBe('1');
    expect(register().hasAttribute('disabled')).toBe(true);
    expect(dot(2).hasAttribute('disabled')).toBe(true);
  });
});

describe('PolicyCarousel focus and keys', () => {
  it('Tab from the last focusable wraps to the first and Shift+Tab the reverse', () => {
    setup();
    for (let i = 0; i < 5; i++) fireEvent.click(next());
    const close = screen.getByRole('button', { name: /close/i });
    register().focus();
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(register());
  });

  it('Escape pressed with focus outside the dialog closes it without accepting', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const { onClose, onAccept } = setup();
    outside.focus();
    fireEvent.keyDown(outside, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
    outside.remove();
  });

  it('focus returns to the opener after close', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const props = { onClose: vi.fn(), onAccept: vi.fn() };
    const { rerender } = render(<PolicyCarousel open {...props} />);
    expect(document.activeElement).not.toBe(opener);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<PolicyCarousel open={false} {...props} />);
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe('');
    opener.remove();
  });
});

describe('policy content', () => {
  it('has 6 slides with image, vi and en, and the version constant', () => {
    expect(POLICY_VERSION).toBe('2026-11-04');
    expect(POLICY_SLIDES).toHaveLength(6);
    POLICY_SLIDES.forEach((s, i) => {
      expect(s.image).toBe(`/policy/slide-${i + 1}.svg`);
      expect(s.vi.trim()).not.toBe('');
      expect(s.en.trim()).not.toBe('');
    });
  });

  it('has the 8 ban reason codes of spec 5.1', () => {
    expect(BAN_REASONS.map((r) => r.code)).toEqual([
      'inaccurate', 'sexual', 'violent_scary', 'political', 'hate', 'off_target', 'personal_or_copyright', 'other',
    ]);
    BAN_REASONS.forEach((r) => {
      expect(r.label.trim()).not.toBe('');
      expect(r.en.trim()).not.toBe('');
    });
  });
});
