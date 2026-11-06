import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// X1-X8: two players on one computer, big board, drawn marks, keyboard, play again.

const h = vi.hoisted(() => ({ chime: vi.fn(), applause: vi.fn(), push: vi.fn() }));
vi.mock('@/lib/sfx', () => ({ chime: h.chime, applause: h.applause }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, replace: vi.fn() }), usePathname: () => '/games/caro' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import CaroPlay from '@/app/games/caro/page';

const square = (n: number) => screen.getByRole('button', { name: new RegExp(`^Square ${n},`) });
const play = (...nums: number[]) => nums.forEach((n) => fireEvent.click(square(n)));

beforeEach(() => {
  h.chime.mockReset();
  h.applause.mockReset();
  h.push.mockReset();
});
afterEach(cleanup);

describe('Caro X O (X1-X8)', () => {
  it('X starts; the turn is shown by the enlarged player chip', () => {
    render(<CaroPlay />);
    expect(screen.getByLabelText('X player').getAttribute('aria-current')).toBe('true');
    expect(screen.getByLabelText('O player').getAttribute('aria-current')).toBeNull();
    fireEvent.click(square(1));
    expect(square(1).getAttribute('aria-label')).toBe('Square 1, X');
    expect(screen.getByLabelText('O player').getAttribute('aria-current')).toBe('true');
    expect(h.chime).toHaveBeenCalledTimes(1);
  });

  it('a press on an occupied cell does nothing', () => {
    render(<CaroPlay />);
    play(1, 1);
    expect(square(1).getAttribute('aria-label')).toBe('Square 1, X');
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('O player').getAttribute('aria-current')).toBe('true');
  });

  it('three in a row wins: the line is highlighted, the applause plays, and Play again appears', () => {
    render(<CaroPlay />);
    play(1, 4, 2, 5, 3); // X takes the top row
    expect(h.applause).toHaveBeenCalledTimes(1);
    for (const n of [1, 2, 3]) expect(square(n).className).toContain('caro-win');
    expect(square(4).className).not.toContain('caro-win');
    expect(screen.getByRole('button', { name: 'Play again' })).toBeTruthy();
    // No move is possible after the win.
    fireEvent.click(square(6));
    expect(square(6).getAttribute('aria-label')).toBe('Square 6, empty');
  });

  it('a full board with no line is a draw: no winner highlight, Play again appears, no applause', () => {
    render(<CaroPlay />);
    play(1, 2, 3, 5, 4, 7, 8, 6, 9); // X O X / X O O / O X X
    expect(h.applause).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play again' })).toBeTruthy();
    for (let n = 1; n <= 9; n++) expect(square(n).className).not.toContain('caro-win');
  });

  it('Play again clears the board and X starts again', () => {
    render(<CaroPlay />);
    play(1, 4, 2, 5, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    for (let n = 1; n <= 9; n++) expect(square(n).getAttribute('aria-label')).toBe(`Square ${n}, empty`);
    expect(screen.getByLabelText('X player').getAttribute('aria-current')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull();
  });

  it('arrow keys move focus across the 3x3 board', () => {
    render(<CaroPlay />);
    const board = screen.getByLabelText('Caro board');
    fireEvent.keyDown(board, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(square(1));
    fireEvent.keyDown(board, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(square(4));
    fireEvent.keyDown(board, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(square(3));
  });

  it('the back button goes to the games list', () => {
    render(<CaroPlay />);
    expect(screen.getByRole('link', { name: 'Back to games' }).getAttribute('href')).toBe('/games');
  });
});
