import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ applause: vi.fn(), speakKid: vi.fn(), playFile: vi.fn(), push: vi.fn() }));
vi.mock('@/lib/sfx', () => ({ applause: h.applause, speakKid: h.speakKid, playFile: h.playFile }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import { MemoryDone } from '@/components/memory/MemoryDone';

const setup = (over: Partial<React.ComponentProps<typeof MemoryDone>> = {}) => {
  const onAgain = vi.fn();
  const r = render(<MemoryDone flips={14} childName="Hà My" completeUrl={null} onAgain={onAgain} levelsHref="/games/memory" {...over} />);
  return { onAgain, ...r };
};
const again = () => screen.getByRole('button', { name: 'Play again' });
const levels = () => screen.getByRole('link', { name: 'Choose level' });

beforeEach(() => { for (const f of Object.values(h)) f.mockReset(); });
afterEach(cleanup);

describe('MemoryDone (M7)', () => {
  it('greets the child by name', () => {
    setup();
    expect(screen.getByRole('heading').textContent).toBe('You did it, Hà My!');
  });

  it('omits the name when empty', () => {
    setup({ childName: '' });
    expect(screen.getByRole('heading').textContent).toBe('You did it!');
  });

  it('shows "Total N times" with the number highlighted', () => {
    setup({ flips: 14 });
    expect(document.querySelector('[data-total]')?.textContent).toBe('Total 14 times');
    expect(document.querySelector('[data-flips]')?.textContent).toBe('14');
    expect(screen.queryByLabelText(/flips$/)).toBeNull();
  });

  it('shows the shared celebration: 3 stars and both characters', () => {
    setup();
    expect(screen.getByRole('img', { name: '3 stars earned' })).toBeTruthy();
    const srcs = [...document.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toContain('/images/girl.webp');
    expect(srcs).toContain('/images/girl-beret.webp');
  });

  it('has exactly two picture-only buttons', () => {
    setup();
    const controls = [...document.querySelectorAll('button, a[href]')];
    expect(controls).toHaveLength(2);
    expect(controls.every((c) => (c.textContent ?? '').trim() === '')).toBe(true);
  });

  it('Play again calls onAgain', () => {
    const { onAgain } = setup();
    fireEvent.click(again());
    expect(onAgain).toHaveBeenCalledTimes(1);
  });

  it('Choose level links to levelsHref', () => {
    setup({ levelsHref: '/games/memory' });
    expect(levels().getAttribute('href')).toBe('/games/memory');
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
    expect(h.speakKid.mock.calls[0][0]).toBe('You did it, Hà My!');
    expect(h.playFile).not.toHaveBeenCalled();
    rerender(<MemoryDone flips={14} childName="Hà My" completeUrl={null} onAgain={onAgain} levelsHref="/games/memory" />);
    expect(h.applause).toHaveBeenCalledTimes(1);
    expect(h.speakKid).toHaveBeenCalledTimes(1);
  });

  it('Play again has the focus at start', () => {
    setup();
    expect(document.activeElement).toBe(again());
  });

  it('arrows move between the two buttons', () => {
    setup();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(levels());
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(again());
  });

  it('Space on the link clicks it', () => {
    setup();
    levels().focus();
    const click = vi.fn();
    levels().addEventListener('click', (e) => { e.preventDefault(); click(); });
    fireEvent.keyDown(window, { key: ' ' });
    expect(click).toHaveBeenCalled();
  });

  it('Esc goes to the level screen', () => {
    setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games/memory');
  });
});
