import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ applause: vi.fn(), speakKid: vi.fn(), playFile: vi.fn(), push: vi.fn() }));
vi.mock('@/lib/sfx', () => ({ applause: h.applause, speakKid: h.speakKid, playFile: h.playFile }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import { SortDone } from '@/components/sort/SortDone';

const setup = (over: Partial<React.ComponentProps<typeof SortDone>> = {}) => {
  const onAgain = vi.fn();
  const r = render(<SortDone wrong={3} childName="Hà My" completeUrl={null} onAgain={onAgain} gamesHref="/games" {...over} />);
  return { onAgain, ...r };
};
const again = () => screen.getByRole('button', { name: 'Play again' });
const back = () => {
  const a = screen.getByRole('link', { name: 'Back to games' });
  a.addEventListener('click', (e) => e.preventDefault()); // no real navigation in jsdom
  return a;
};

beforeEach(() => { for (const f of Object.values(h)) f.mockReset(); });
afterEach(cleanup);

describe('SortDone (R7)', () => {
  it('greets the child by name, or without one', () => {
    setup();
    expect(screen.getByRole('heading').textContent).toBe('You did it, Hà My!');
    cleanup();
    setup({ childName: '' });
    expect(screen.getByRole('heading').textContent).toBe('You did it!');
  });

  it.each([[3], [0], [1]])('shows "Wrong %i times" with the number highlighted and no word list', (n) => {
    setup({ wrong: n });
    expect(document.querySelector('[data-wrong-line]')?.textContent).toBe(`Wrong ${n} times`);
    expect(document.querySelector('[data-wrong-total]')?.textContent).toBe(String(n));
    expect(document.querySelector('[data-sort-done]')).toBeTruthy();
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

  it('without a custom file plays applause and speaks once, also under StrictMode and after a rerender', () => {
    const onAgain = vi.fn();
    const props = { wrong: 0, childName: 'Hà My', completeUrl: null, onAgain, gamesHref: '/games' };
    const { rerender } = render(<StrictMode><SortDone {...props} /></StrictMode>);
    expect(h.applause).toHaveBeenCalledTimes(1);
    expect(h.speakKid).toHaveBeenCalledTimes(1);
    expect(h.speakKid.mock.calls[0][0]).toBe('You did it, Hà My!');
    rerender(<StrictMode><SortDone {...props} wrong={1} /></StrictMode>);
    expect(h.applause).toHaveBeenCalledTimes(1);
    expect(h.speakKid).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['applause', null, () => h.applause],
    ['the custom file', '/media/yay.mp3', () => h.playFile],
  ])('the praise sound (%s) is stopped by Play again, but not on mount under StrictMode', (_n, completeUrl, sound) => {
    const stop = vi.fn();
    sound().mockReturnValue({ stop, ms: 3000 });
    const onAgain = vi.fn();
    render(<StrictMode><SortDone wrong={0} childName="Hà My" completeUrl={completeUrl} onAgain={onAgain} gamesHref="/games" /></StrictMode>);
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
    expect(document.querySelector('[data-sort-done]')?.getAttribute('data-keys')).toBe('ready');
  });

  it('Esc goes to the game list', () => {
    setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games');
  });
});
