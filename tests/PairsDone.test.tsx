import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PuzzlePicture } from '@/lib/pairs/types';

const h = vi.hoisted(() => ({
  applause: vi.fn((_s?: number, speak?: () => void) => { speak?.(); return undefined as unknown; }),
  speakKid: vi.fn(),
  playFile: vi.fn(),
  sayWord: vi.fn(),
  stopWord: vi.fn(),
}));
vi.mock('@/lib/sfx', () => ({ applause: h.applause, speakKid: h.speakKid, playFile: h.playFile }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null | undefined) => (p ? `/media/${p}` : null) }));
vi.mock('@/lib/memory/cards', () => ({ sayWord: h.sayWord, stopWord: h.stopWord }));

import { PairsDone } from '@/components/pairs/PairsDone';

const pic = (id: string): PuzzlePicture => ({ id, word: id, image_path: `seed/${id}.svg`, audio_path: null });
const PICS = ['fish', 'triangle', 'house', 'apple'].map(pic);

const setup = (over: Partial<React.ComponentProps<typeof PairsDone>> = {}) => {
  const onAgain = vi.fn();
  const onHome = vi.fn();
  const r = render(<PairsDone pictures={PICS} childName="childPlayer" completeUrl={null} onAgain={onAgain} onHome={onHome} {...over} />);
  return { onAgain, onHome, ...r };
};
const again = () => screen.getByRole('button', { name: 'New level' });
const home = () => screen.getByRole('button', { name: 'Back to games' });
const pictures = () => Array.from(document.querySelectorAll<HTMLElement>('[data-done-picture]'));

beforeEach(() => { for (const f of Object.values(h)) f.mockReset(); h.applause.mockImplementation((_s?: number, speak?: () => void) => { speak?.(); return undefined; }); });
afterEach(cleanup);

describe('PairsDone (H10)', () => {
  it('greets the child by name, or without one', () => {
    setup();
    expect(screen.getByRole('heading').textContent).toBe('You did it, childPlayer!');
    cleanup();
    setup({ childName: '' });
    expect(screen.getByRole('heading').textContent).toBe('You did it!');
  });

  it('shows the 4 finished pictures in order, each a white box with the picture and no text', () => {
    setup();
    expect(pictures().map((el) => el.getAttribute('data-done-picture'))).toEqual(['fish', 'triangle', 'house', 'apple']);
    const img = pictures()[0].querySelector('img')!;
    expect(new URL(img.src).pathname).toBe('/media/seed/fish.svg');
    expect(img.getAttribute('alt')).toBe('');
    expect(pictures()[0].textContent).toBe('');
  });

  it('a picture without a file shows a plain placeholder', () => {
    setup({ pictures: [{ ...PICS[0], image_path: '' }] });
    expect(pictures()[0].querySelector('img')).toBeNull();
    expect(pictures()[0].querySelector('[data-placeholder]')).toBeTruthy();
  });

  it('shows the shared celebration and two picture-only action buttons', () => {
    setup();
    expect(screen.getByRole('img', { name: '3 stars earned' })).toBeTruthy();
    const actions = Array.from(document.querySelectorAll('[data-done-btn]'));
    expect(actions).toHaveLength(2);
    expect(actions.every((c) => (c.textContent ?? '').trim() === '')).toBe(true);
  });

  it('New level calls onAgain; Back to games calls onHome', () => {
    const { onAgain, onHome } = setup();
    fireEvent.click(again());
    expect(onAgain).toHaveBeenCalledTimes(1);
    expect(onHome).not.toHaveBeenCalled();
    fireEvent.click(home());
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('plays the custom file instead of applause and speech', () => {
    setup({ completeUrl: '/media/yay.mp3' });
    expect(h.playFile).toHaveBeenCalledWith('/media/yay.mp3');
    expect(h.applause).not.toHaveBeenCalled();
    expect(h.speakKid).not.toHaveBeenCalled();
  });

  it('without a custom file plays applause and speaks once', () => {
    const { rerender, onAgain, onHome } = setup();
    expect(h.applause).toHaveBeenCalledTimes(1);
    expect(h.speakKid).toHaveBeenCalledTimes(1);
    expect(h.speakKid.mock.calls[0][0]).toBe('You did it, childPlayer!');
    rerender(<PairsDone pictures={PICS} childName="childPlayer" completeUrl={null} onAgain={onAgain} onHome={onHome} />);
    expect(h.applause).toHaveBeenCalledTimes(1);
    expect(h.speakKid).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['applause', null, () => h.applause],
    ['the custom file', '/media/yay.mp3', () => h.playFile],
  ])('the praise sound (%s) is stopped by New level, Back and Esc, but not on mount under StrictMode', (_n, completeUrl, sound) => {
    const stop = vi.fn();
    sound().mockReturnValue({ stop, ms: 3000 });
    const onAgain = vi.fn();
    const onHome = vi.fn();
    const props = { pictures: PICS, childName: 'childPlayer', completeUrl, onAgain, onHome };
    render(<StrictMode><PairsDone {...props} /></StrictMode>);
    expect(sound()).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    fireEvent.click(again());
    expect(stop).toHaveBeenCalledTimes(1);
    expect(onAgain).toHaveBeenCalledTimes(1);
    fireEvent.click(home());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(stop).toHaveBeenCalledTimes(1); // the handle is dropped after the first stop
    expect(onHome).toHaveBeenCalledTimes(2); // Back, then Esc
  });

  it('Back to games and Esc each stop the praise sound', () => {
    for (const act of [() => fireEvent.click(home()), () => fireEvent.keyDown(window, { key: 'Escape' })]) {
      const stop = vi.fn();
      h.applause.mockImplementation((_s?: number, speak?: () => void) => { speak?.(); return { stop, ms: 3000 }; });
      setup();
      act();
      expect(stop).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it('New level has the focus; arrows move between the two buttons', () => {
    setup();
    expect(document.activeElement).toBe(again());
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(home());
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(again());
  });

  it('the finish keys are live as soon as New level has the focus (data-keys="ready")', () => {
    setup();
    expect(document.activeElement).toBe(again());
    expect(document.querySelector('[data-pairs-done]')?.getAttribute('data-keys')).toBe('ready');
  });

  it('Esc goes to the game list through onHome', () => {
    const { onHome, onAgain } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onAgain).not.toHaveBeenCalled();
  });

  it('the Left/Right keys go across the pictures, then New level and Back to games (H10, H11)', () => {
    setup();
    pictures()[0].focus();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(pictures()[1]);
    pictures()[3].focus();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(again());
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(home());
  });
});

describe('PairsDone finished pictures say their word (H10)', () => {
  const WORDS = [
    { id: 'fish', word: 'fish', image_path: 'seed/fish.svg', audio_path: 'seed/fish.mp3' },
    { id: 'house', word: 'house', image_path: 'seed/house.svg', audio_path: null },
    { id: 'triangle', word: 'triangle', image_path: 'seed/triangle.svg', audio_path: null },
    { id: 'apple', word: 'apple', image_path: 'seed/apple.svg', audio_path: null },
  ];

  it('each finished picture is a button named by its word, with no visible text', () => {
    setup({ pictures: WORDS });
    expect(pictures()[0].tagName).toBe('BUTTON');
    expect(pictures()[0].getAttribute('type')).toBe('button');
    expect(screen.getByRole('button', { name: 'Hear fish' })).toBe(pictures()[0]);
    expect(pictures()[0].textContent).toBe('');
  });

  it('a click says that picture\'s word and stops the praise sound first', () => {
    const stop = vi.fn();
    h.applause.mockImplementation((_s?: number, speak?: () => void) => { speak?.(); return { stop, ms: 3000 }; });
    setup({ pictures: WORDS });
    fireEvent.click(pictures()[0]);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    expect(h.sayWord).toHaveBeenCalledWith({ word: 'fish', audio_path: 'seed/fish.mp3' });
    fireEvent.click(pictures()[1]);
    expect(h.sayWord).toHaveBeenLastCalledWith({ word: 'house', audio_path: null });
  });

  it('Enter or Space on a focused picture says its word', () => {
    setup({ pictures: WORDS });
    pictures()[2].focus();
    fireEvent.keyDown(pictures()[2], { key: 'Enter' });
    expect(h.sayWord).toHaveBeenLastCalledWith({ word: 'triangle', audio_path: null });
    fireEvent.keyDown(pictures()[3], { key: ' ' });
    expect(h.sayWord).toHaveBeenLastCalledWith({ word: 'apple', audio_path: null });
    expect(h.sayWord).toHaveBeenCalledTimes(2);
  });

  it('leaving the finish stops the word; mounting under StrictMode does not', () => {
    const { unmount } = setup({ pictures: WORDS });
    expect(h.stopWord).not.toHaveBeenCalled();
    fireEvent.click(pictures()[0]);
    unmount();
    expect(h.stopWord).toHaveBeenCalledTimes(1);
    cleanup();
    h.stopWord.mockReset();
    render(<StrictMode><PairsDone pictures={WORDS} childName="" completeUrl={null} onAgain={vi.fn()} onHome={vi.fn()} /></StrictMode>);
    expect(h.stopWord).not.toHaveBeenCalled();
  });
});
