import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FindMarkerEditor } from '@/components/admin/FindMarkerEditor';
import type { EObject } from '@/lib/find/adminLevels';

const say = vi.hoisted(() => ({ sayWord: vi.fn(), stopWord: vi.fn() }));
vi.mock('@/lib/memory/cards', () => say);

afterEach(cleanup);

const o = (x: number, y: number, r = 0.06, word = '', audio: string | null = null): EObject => ({ x, y, r, word, audio_path: audio });

function setup(objects: EObject[] = []) {
  const onChange = vi.fn();
  const onLibrarySound = vi.fn();
  render(<FindMarkerEditor src="/a.png" objects={objects} onChange={onChange} onLibrarySound={onLibrarySound} />);
  const img = screen.getByRole('img', { name: 'Picture' });
  // a 400 x 300 picture at (100, 50)
  img.getBoundingClientRect = () => ({ left: 100, top: 50, width: 400, height: 300, right: 500, bottom: 350, x: 100, y: 50, toJSON: () => ({}) });
  const clickAt = (fx: number, fy: number) => fireEvent.click(img, { clientX: 100 + fx * 400, clientY: 50 + fy * 300 });
  return { onChange, onLibrarySound, clickAt };
}

describe('FindMarkerEditor (A21)', () => {
  it('clicking the picture adds object 1 with the default radius and no word', () => {
    const { onChange, clickAt } = setup();
    clickAt(0.3, 0.4);
    expect(onChange).toHaveBeenCalledWith([{ x: 0.3, y: 0.4, r: 0.06, word: '', audio_path: null }]);
  });

  it('a second click adds object 2 and keeps object 1', () => {
    const { onChange, clickAt } = setup([o(0.2, 0.2, 0.06, 'cat')]);
    clickAt(0.6, 0.6);
    expect(onChange).toHaveBeenCalledWith([o(0.2, 0.2, 0.06, 'cat'), o(0.6, 0.6)]);
  });

  it('clamps clicks on the border to 0.01-0.99', () => {
    const { onChange, clickAt } = setup();
    clickAt(0, 1);
    expect(onChange).toHaveBeenCalledWith([o(0.01, 0.99)]);
  });

  it('refuses a 13th object with a visible message', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => o(0.05 + i * 0.07, 0.5));
    const { onChange, clickAt } = setup(twelve);
    clickAt(0.5, 0.9);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/at most 12/i);
  });

  it('draws numbered circles; a click on one selects it without adding', () => {
    const { onChange } = setup([o(0.2, 0.2), o(0.6, 0.6)]);
    fireEvent.click(screen.getByRole('button', { name: 'Object 2' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Object 2' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Object 1' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Object 2' }).textContent).toBe('2');
  });

  it('selecting a circle highlights its row, and focusing a row highlights its circle', () => {
    setup([o(0.2, 0.2), o(0.6, 0.6)]);
    fireEvent.click(screen.getByRole('button', { name: 'Object 2' }));
    expect(screen.getByLabelText('Object 2 row').getAttribute('data-selected')).toBe('true');
    expect(screen.getByLabelText('Object 1 row').getAttribute('data-selected')).toBe('false');
    fireEvent.focus(screen.getByLabelText('Word for object 1'));
    expect(screen.getByRole('button', { name: 'Object 1' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Object 2' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('Object 1 row').getAttribute('data-selected')).toBe('true');
  });

  it('the Radius slider (3-15 %) changes only the selected object and clamps', () => {
    const { onChange } = setup([o(0.2, 0.2), o(0.6, 0.6)]);
    fireEvent.click(screen.getByRole('button', { name: 'Object 2' }));
    const slider = screen.getByLabelText('Radius') as HTMLInputElement;
    expect(slider.min).toBe('3');
    expect(slider.max).toBe('15');
    expect(slider.value).toBe('6');
    fireEvent.change(slider, { target: { value: '9' } });
    expect(onChange).toHaveBeenLastCalledWith([o(0.2, 0.2), o(0.6, 0.6, 0.09)]);
    fireEvent.change(slider, { target: { value: '30' } });
    expect(onChange).toHaveBeenLastCalledWith([o(0.2, 0.2), o(0.6, 0.6, 0.15)]);
    fireEvent.change(slider, { target: { value: '1' } });
    expect(onChange).toHaveBeenLastCalledWith([o(0.2, 0.2), o(0.6, 0.6, 0.03)]);
  });

  it('Delete object removes the selected object and renumbers, the word stays with its circle', () => {
    const { onChange } = setup([o(0.2, 0.2, 0.06, 'cat'), o(0.6, 0.6, 0.06, 'dog')]);
    fireEvent.click(screen.getByRole('button', { name: 'Object 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete object' }));
    expect(onChange).toHaveBeenCalledWith([o(0.6, 0.6, 0.06, 'dog')]);
  });

  it('no slider or delete button until an object is selected', () => {
    setup([o(0.2, 0.2)]);
    expect(screen.queryByLabelText('Radius')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete object' })).toBeNull();
  });

  it('typing a word calls onChange with that word on the same object', () => {
    const { onChange } = setup([o(0.2, 0.2), o(0.6, 0.6, 0.06, 'dog')]);
    fireEvent.change(screen.getByLabelText('Word for object 1'), { target: { value: 'cat' } });
    expect(onChange).toHaveBeenCalledWith([o(0.2, 0.2, 0.06, 'cat'), o(0.6, 0.6, 0.06, 'dog')]);
  });

  it('the row down arrow swaps whole objects (word and sound travel together)', () => {
    const { onChange } = setup([o(0.2, 0.2, 0.06, 'cat', 'sound/cat.mp3'), o(0.6, 0.6, 0.06, 'dog')]);
    fireEvent.click(screen.getByRole('button', { name: 'Move object 1 down' }));
    expect(onChange).toHaveBeenCalledWith([o(0.6, 0.6, 0.06, 'dog'), o(0.2, 0.2, 0.06, 'cat', 'sound/cat.mp3')]);
  });

  it('the up arrow of object 1 and the down arrow of the last object are disabled', () => {
    setup([o(0.2, 0.2), o(0.6, 0.6)]);
    expect((screen.getByRole('button', { name: 'Move object 1 up' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Move object 2 down' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('warns about small objects in the singular and plural, without blocking', () => {
    const { unmount } = render(<FindMarkerEditor src="/a.png" objects={[o(0.2, 0.2, 0.03)]} onChange={vi.fn()} onLibrarySound={vi.fn()} />);
    expect(screen.getByText('1 object is small and may be hard to click.')).toBeTruthy();
    unmount();
    render(<FindMarkerEditor src="/a.png" objects={[o(0.2, 0.2, 0.03), o(0.6, 0.6, 0.035)]} onChange={vi.fn()} onLibrarySound={vi.fn()} />);
    expect(screen.getByText('2 objects are small and may be hard to click.')).toBeTruthy();
  });

  it('shows the sound name, or "No sound", on each row', () => {
    setup([o(0.2, 0.2, 0.06, 'cat', 'sound/cat.mp3'), o(0.6, 0.6, 0.06, 'dog')]);
    expect(screen.getByLabelText('Object 1 row').textContent).toContain('cat.mp3');
    expect(screen.getByLabelText('Object 2 row').textContent).toContain('No sound');
  });


  it('Choose sound asks the parent for the library for that object', () => {
    const { onLibrarySound } = setup([o(0.2, 0.2), o(0.6, 0.6)]);
    fireEvent.click(screen.getByRole('button', { name: 'Choose sound for object 2' }));
    expect(onLibrarySound).toHaveBeenCalledWith(1);
  });

  it('Clear sound sets audio_path back to null', () => {
    const { onChange } = setup([o(0.2, 0.2, 0.06, 'cat', 'sound/cat.mp3'), o(0.6, 0.6)]);
    fireEvent.click(screen.getByRole('button', { name: 'Clear sound for object 1' }));
    expect(onChange).toHaveBeenCalledWith([o(0.2, 0.2, 0.06, 'cat', null), o(0.6, 0.6)]);
  });

  it('Play is on without a sound when the object has a word: the browser says it', () => {
    setup([o(0.2, 0.2, 0.06, 'cat')]);
    const play = screen.getByRole('button', { name: 'Play sound for object 1' }) as HTMLButtonElement;
    expect(play.disabled).toBe(false);
    fireEvent.click(play);
    expect(say.sayWord).toHaveBeenCalledWith({ word: 'cat', audio_path: null }, expect.any(Function));
  });

  it('shows Pause while the browser says the word, Play again when it ends or is paused', () => {
    setup([o(0.2, 0.2, 0.06, 'cat')]);
    fireEvent.click(screen.getByRole('button', { name: 'Play sound for object 1' }));
    expect(screen.getByRole('button', { name: 'Pause sound for object 1' })).toBeTruthy();
    const end = say.sayWord.mock.calls.at(-1)![1] as () => void;
    act(() => end());
    expect(screen.getByRole('button', { name: 'Play sound for object 1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Play sound for object 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause sound for object 1' }));
    expect(say.stopWord).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play sound for object 1' })).toBeTruthy();
  });

  it('Play is off only when the object has neither a sound nor a word', () => {
    setup([o(0.2, 0.2)]);
    expect((screen.getByRole('button', { name: 'Play sound for object 1' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
