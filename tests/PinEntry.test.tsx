import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PinEntry from '@/components/play/PinEntry';
import type { Child } from '@/lib/children';

const child: Child = { id: 'c1', parent_id: 'p1', child_name: 'my', display_name: 'My', avatar_path: null, gender: 'female', age_band: '2-5', pin: 'aB3z' };
const onCorrect = vi.fn();
const onCancel = vi.fn();

beforeEach(() => { onCorrect.mockReset(); onCancel.mockReset(); });
afterEach(cleanup);

const boxes = () => screen.getAllByRole('textbox') as HTMLInputElement[];
function type(text: string) {
  [...text].forEach((c, i) => fireEvent.change(boxes()[i], { target: { value: c } }));
}
const setup = () => render(<PinEntry child={child} onCorrect={onCorrect} onCancel={onCancel} />);

describe('PinEntry (K10, KU10)', () => {
  it('shows four one-character boxes and focuses the first', () => {
    setup();
    expect(boxes()).toHaveLength(4);
    boxes().forEach((b) => expect(b.maxLength).toBe(1));
    expect(document.activeElement).toBe(boxes()[0]);
  });

  it('auto-advances after each character', () => {
    setup();
    fireEvent.change(boxes()[0], { target: { value: 'a' } });
    expect(document.activeElement).toBe(boxes()[1]);
    fireEvent.change(boxes()[1], { target: { value: 'B' } });
    expect(document.activeElement).toBe(boxes()[2]);
  });

  it('ignores characters that are not letters or digits', () => {
    setup();
    fireEvent.change(boxes()[0], { target: { value: '-' } });
    expect(boxes()[0].value).toBe('');
    expect(document.activeElement).toBe(boxes()[0]);
  });

  it('Backspace on an empty box goes back and clears the previous one', () => {
    setup();
    type('aB');
    expect(document.activeElement).toBe(boxes()[2]);
    fireEvent.keyDown(boxes()[2], { key: 'Backspace' });
    expect(document.activeElement).toBe(boxes()[1]);
    expect(boxes()[1].value).toBe('');
  });

  it('the right PIN calls onCorrect when the fourth character is entered', () => {
    setup();
    type('aB3');
    expect(onCorrect).not.toHaveBeenCalled();
    type('aB3z');
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });

  it('is case sensitive: a wrong case is a wrong PIN', () => {
    setup();
    type('ab3z');
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it('a wrong PIN shakes with no text, clears the boxes and refocuses the first', () => {
    const { container } = setup();
    const before = container.textContent;
    type('0000');
    expect(onCorrect).not.toHaveBeenCalled();
    expect(boxes().map((b) => b.value)).toEqual(['', '', '', '']);
    expect(document.activeElement).toBe(boxes()[0]);
    expect(container.querySelector('[data-wrong="true"]')).toBeTruthy();
    expect(container.textContent).toBe(before);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('can try again after a wrong PIN', () => {
    setup();
    type('0000');
    type('aB3z');
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });

  it('a pasted PIN of four characters fills all boxes and is checked', () => {
    setup();
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => 'aB3z' } });
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });

  it('a pasted wrong PIN is cleared', () => {
    setup();
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => 'zzzz' } });
    expect(onCorrect).not.toHaveBeenCalled();
    expect(boxes().map((b) => b.value)).toEqual(['', '', '', '']);
  });

  it('Esc leaves the PIN step', () => {
    setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('PIN popup (FP6-FP8)', () => {
  it('is a dialog titled with the child name, with the matching hero', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Enter your PIN, My!' })).toBeTruthy();
    expect(document.querySelector('img[src*="princess.png"]')).toBeTruthy();
    cleanup();
    render(<PinEntry child={{ ...child, gender: 'male' }} onCorrect={onCorrect} onCancel={onCancel} />);
    expect(document.querySelector('img[src*="prince.png"]')).toBeTruthy();
  });
  it('shows * and never the real character', () => {
    setup();
    fireEvent.change(boxes()[0], { target: { value: 'a' } });
    expect(boxes()[0].value).toBe('*');
    expect(document.body.innerHTML).not.toContain('value="a"');
  });
  it('a caret before the mask still reads the new character', () => {
    setup();
    type('a');
    fireEvent.change(boxes()[0], { target: { value: 'B*' } });
    expect(boxes()[0].value).toBe('*');
    fireEvent.change(boxes()[1], { target: { value: 'B' } });
    fireEvent.change(boxes()[2], { target: { value: '3' } });
    fireEvent.change(boxes()[3], { target: { value: 'z' } });
    expect(onCorrect).not.toHaveBeenCalled(); // box 1 now holds B, so the PIN is BB3z
  });
  it('typing a literal * does not clear or change a filled box', () => {
    setup();
    type('a');
    fireEvent.change(boxes()[0], { target: { value: '**' } });
    fireEvent.change(boxes()[1], { target: { value: 'B' } });
    fireEvent.change(boxes()[2], { target: { value: '3' } });
    fireEvent.change(boxes()[3], { target: { value: 'z' } });
    expect(onCorrect).toHaveBeenCalledTimes(1); // box 1 still holds a
  });
  it('closes by X and by a click outside, not by a click inside', () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(container.querySelector('[data-pin-overlay]') as Element);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});

