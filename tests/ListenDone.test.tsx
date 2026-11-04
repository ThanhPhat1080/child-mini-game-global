import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryCard } from '@/lib/memory/types';

const h = vi.hoisted(() => ({ applause: vi.fn(), speakKid: vi.fn(), playFile: vi.fn(), push: vi.fn(), sayWord: vi.fn() }));
vi.mock('@/lib/sfx', () => ({ applause: h.applause, speakKid: h.speakKid, playFile: h.playFile }));
vi.mock('@/lib/memory/cards', () => ({ sayWord: h.sayWord }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import { ListenDone } from '@/components/listen/ListenDone';

const card = (n: number): MemoryCard => ({ id: `c${n}`, word: `word${n}`, image_path: `c${n}.svg`, audio_path: null, active: true });
const cardMap = (...ns: number[]) => new Map(ns.map((n) => [`c${n}`, card(n)] as const));

const setup = (over: Partial<React.ComponentProps<typeof ListenDone>> = {}) => {
  const onAgain = vi.fn();
  const r = render(
    <ListenDone
      wrong={[{ id: 'c1', word: 'word1', count: 2 }, { id: 'c2', word: 'word2', count: 1 }]}
      cards={cardMap(1, 2)}
      childName="childPlayer"
      completeUrl={null}
      onAgain={onAgain}
      gamesHref="/games"
      {...over}
    />,
  );
  return { onAgain, ...r };
};
const again = () => screen.getByRole('button', { name: 'Play again' });
const back = () => {
  const a = screen.getByRole('link', { name: 'Back to games' });
  a.addEventListener('click', (e) => e.preventDefault()); // no real navigation in jsdom
  return a;
};
const items = () => Array.from(document.querySelectorAll<HTMLElement>('[data-wrong-item]'));

beforeEach(() => { for (const f of Object.values(h)) f.mockReset(); });
afterEach(cleanup);

describe('ListenDone (L6, L7)', () => {
  it('greets the child by name, or without one', () => {
    setup();
    expect(screen.getByRole('heading').textContent).toBe('You did it, childPlayer!');
    cleanup();
    setup({ childName: '' });
    expect(screen.getByRole('heading').textContent).toBe('You did it!');
  });

  it('shows "Wrong N times" with the total highlighted', () => {
    setup();
    expect(document.querySelector('[data-wrong-line]')?.textContent).toBe('Wrong 3 times');
    expect(document.querySelector('[data-wrong-total]')?.textContent).toBe('3');
    expect(document.querySelector('[data-listen-done]')).toBeTruthy();
  });

  it('lists each word with x2 only above 1; each item is a button that says the word', () => {
    setup();
    expect(items()).toHaveLength(2);
    expect(items()[0].textContent).toContain('word1');
    expect(items()[0].textContent).toContain('x2');
    expect(items()[1].textContent).toContain('word2');
    expect(items()[1].textContent).not.toContain('x');
    expect(items()[0].tagName).toBe('BUTTON');
    expect(screen.getByRole('button', { name: 'Hear word1' })).toBe(items()[0]);
    expect(new URL(items()[0].querySelector('img')!.src).pathname).toBe('/media/c1.svg');
    fireEvent.click(items()[1]);
    expect(h.sayWord).toHaveBeenCalledTimes(1);
    expect(h.sayWord.mock.calls[0][0].id).toBe('c2');
  });

  it('a card missing from the map shows a plain placeholder and still says its word', () => {
    setup({ cards: cardMap(2) });
    expect(items()[0].querySelector('img')).toBeNull();
    expect(items()[0].querySelector('[data-placeholder]')).toBeTruthy();
    fireEvent.click(items()[0]);
    expect(h.sayWord.mock.calls[0][0].word).toBe('word1');
  });

  it('with no entries shows "Wrong 0 times" and no list', () => {
    setup({ wrong: [] });
    expect(document.querySelector('[data-wrong-line]')?.textContent).toBe('Wrong 0 times');
    expect(document.querySelector('[data-wrong-total]')?.textContent).toBe('0');
    expect(document.querySelector('[data-wrong-list]')).toBeNull();
  });

  it('shows the shared celebration and two picture-only action buttons', () => {
    setup();
    expect(screen.getByRole('img', { name: '3 stars earned' })).toBeTruthy();
    const actions = Array.from(document.querySelectorAll('[data-done-btn]'));
    expect(actions).toHaveLength(2);
    expect(actions.every((c) => (c.textContent ?? '').trim() === '')).toBe(true);
  });

  it('Play again calls onAgain; Back to games links to gamesHref', () => {
    const { onAgain } = setup();
    fireEvent.click(again());
    expect(onAgain).toHaveBeenCalledTimes(1);
    expect(back().getAttribute('href')).toBe('/games');
  });

  it('plays the custom file instead of applause and speech', () => {
    setup({ completeUrl: '/media/yay.mp3' });
    expect(h.playFile).toHaveBeenCalledWith('/media/yay.mp3');
    expect(h.applause).not.toHaveBeenCalled();
    expect(h.speakKid).not.toHaveBeenCalled();
  });

  it('without a custom file plays applause and speaks once', () => {
    const { rerender, onAgain } = setup();
    expect(h.applause).toHaveBeenCalledTimes(1);
    expect(h.speakKid).toHaveBeenCalledTimes(1);
    expect(h.speakKid.mock.calls[0][0]).toBe('You did it, childPlayer!');
    rerender(<ListenDone wrong={[]} cards={cardMap()} childName="childPlayer" completeUrl={null} onAgain={onAgain} gamesHref="/games" />);
    expect(h.applause).toHaveBeenCalledTimes(1);
    expect(h.speakKid).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['applause', null, () => h.applause],
    ['the custom file', '/media/yay.mp3', () => h.playFile],
  ])('the praise sound (%s) is stopped by Play again, Back and Esc, but not on mount under StrictMode', (_n, completeUrl, sound) => {
    const stop = vi.fn();
    sound().mockReturnValue({ stop, ms: 3000 });
    const onAgain = vi.fn();
    const props = { wrong: [], cards: cardMap(), childName: 'childPlayer', completeUrl, onAgain, gamesHref: '/games' };
    render(<StrictMode><ListenDone {...props} /></StrictMode>);
    expect(sound()).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    fireEvent.click(again());
    expect(stop).toHaveBeenCalledTimes(1);
    expect(onAgain).toHaveBeenCalledTimes(1);
    fireEvent.click(back());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(stop).toHaveBeenCalledTimes(1); // the handle is dropped after the first stop
  });

  it('Back to games and Esc each stop the praise sound', () => {
    for (const act of [() => fireEvent.click(back()), () => fireEvent.keyDown(window, { key: 'Escape' })]) {
      const stop = vi.fn();
      h.applause.mockReturnValue({ stop, ms: 3000 });
      setup();
      act();
      expect(stop).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it('Play again has the focus; arrows move between the two buttons', () => {
    setup();
    expect(document.activeElement).toBe(again());
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(back());
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(again());
  });

  it('the finish keys are live as soon as Play again has the focus (data-keys="ready")', () => {
    setup();
    expect(document.activeElement).toBe(again());
    expect(document.querySelector('[data-listen-done]')?.getAttribute('data-keys')).toBe('ready');
  });

  it('Esc goes to the game list', () => {
    setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games');
  });
});
