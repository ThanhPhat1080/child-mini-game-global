import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// X1-X8 on the game page: 30x20 board in the middle, two players on the sides, turn animation, help popup.

const h = vi.hoisted(() => ({ chime: vi.fn(), yay: vi.fn(), ohOh: vi.fn(), push: vi.fn(), settings: vi.fn() }));
vi.mock('@/lib/sfx', () => ({ chime: h.chime, yay: h.yay, ohOh: h.ohOh }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: () => h.settings() }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, replace: vi.fn() }), usePathname: () => '/games/caro' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import CaroPlay from '@/app/games/caro/page';
import { HOORAY_MS, OHOH_MS, RESULT_DELAY_MS } from '@/components/caro/CaroResult';

// Direct DOM lookup: role queries compute the name of every cell on each call and are very slow here.
const squares = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.caro-cell'));
const square = (n: number) => squares()[n - 1];
const play = (...nums: number[]) => nums.forEach((n) => fireEvent.click(square(n)));
const playAgain = () => document.querySelector<HTMLButtonElement>('[aria-label="Play again"]');
const side = (label: string) => screen.getByLabelText(label);
/** The picture of a player: the <img> inside the side (alt is empty, so it has no img role). */
const picture = (label: string) => side(label).querySelector('img') as HTMLImageElement;
/** Renders the page and waits until the child's settings have loaded (a boy by default, so X is the child). */
async function renderBoy() {
  render(<CaroPlay />);
  await waitFor(() => expect(picture('Player 2').getAttribute('src')).toContain('princess.webp'));
}

beforeEach(() => {
  h.chime.mockReset();
  h.yay.mockReset();
  h.ohOh.mockReset();
  h.push.mockReset();
  h.settings.mockReset().mockResolvedValue({ gender: 'male', child_name: 'Bin', avatar_path: null, hooray_path: null, ohoh_path: null });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** A child win (the child is X): five in a row on the top row. Waits for the Hooray screen to be up. */
const CHILD_WINS = [1, 31, 2, 32, 3, 33, 4, 34, 5];
/** The opponent (O) wins with five on row 2 while X plays elsewhere. */
const OPPONENT_WINS = [1, 31, 2, 32, 3, 33, 50, 34, 51, 35];

describe('Caro X O page (X1-X8)', () => {
  it('a 30-column by 20-row board in the middle of the stage, with 600 cells', () => {
    render(<CaroPlay />);
    expect(squares()).toHaveLength(600);
    const board = screen.getByLabelText('Caro board');
    expect(board.style.gridTemplateColumns).toBe('repeat(30, 38px)');
    expect(board.style.gridTemplateRows).toBe('repeat(20, 38px)');
    // Centred horizontally on the 1920-wide stage.
    expect(parseFloat(board.style.left)).toBeCloseTo((1920 - parseFloat(board.style.width)) / 2, 0);
  });

  it('the top X and O chips are gone', () => {
    render(<CaroPlay />);
    expect(screen.queryByLabelText('X player')).toBeNull();
    expect(screen.queryByLabelText('O player')).toBeNull();
  });

  it('a boy is X (blue), a girl is O (red), and X always starts', async () => {
    await renderBoy();
    // The child (boy) is X, so the child is the side whose turn it is.
    expect(side('Player 1').getAttribute('aria-current')).toBe('true');
    expect(side('Player 2').getAttribute('aria-current')).toBeNull();
  });

  it('a girl is O, the opponent gets the prince, and the child waits for X to move', async () => {
    h.settings.mockResolvedValue({ gender: 'female', child_name: 'Mai', avatar_path: null });
    render(<CaroPlay />);
    await waitFor(() => expect(picture('Player 2').getAttribute('src')).toContain('prince.webp'));
    // The girl is O: the opponent (X) starts.
    expect(side('Player 1').getAttribute('aria-current')).toBeNull();
    expect(side('Player 2').getAttribute('aria-current')).toBe('true');
    fireEvent.click(square(1));
    // After X moved, O (the child, a girl) is up.
    expect(side('Player 1').getAttribute('aria-current')).toBe('true');
    expect(side('Player 2').getAttribute('aria-current')).toBeNull();
  });

  it("the child's own avatar is shown when there is one; the opponent is the other gender's prince or princess", async () => {
    h.settings.mockResolvedValue({ gender: 'male', child_name: 'Bin', avatar_path: 'kids/bin.png' });
    render(<CaroPlay />);
    await waitFor(() => expect(picture('Player 1').getAttribute('src')).toContain('/media/kids/bin.png'));
    expect(picture('Player 2').getAttribute('src')).toContain('princess.webp');
  });

  it('the active side bounces and its mark wiggles; the other side does not', async () => {
    await renderBoy();
    expect(side('Player 1').querySelector('.caro-bob')).not.toBeNull();
    expect(side('Player 1').querySelector('.caro-wobble')).not.toBeNull();
    expect(side('Player 2').querySelector('.caro-bob')).toBeNull();
    expect(side('Player 2').querySelector('.caro-wobble')).toBeNull();
    fireEvent.click(square(1));
    expect(side('Player 2').querySelector('.caro-bob')).not.toBeNull();
    expect(side('Player 1').querySelector('.caro-bob')).toBeNull();
  });

  it('nothing bounces once the round is over', async () => {
    await renderBoy();
    play(1, 31, 2, 32, 3, 33, 4, 34, 5);
    expect(side('Player 1').querySelector('.caro-bob')).toBeNull();
    expect(side('Player 2').querySelector('.caro-bob')).toBeNull();
  });

  it('moves alternate and a press on an occupied cell does nothing', async () => {
    await renderBoy();
    fireEvent.click(square(1));
    expect(square(1).getAttribute('aria-label')).toBe('Square 1, X');
    expect(h.chime).toHaveBeenCalledTimes(1);
    fireEvent.click(square(1));
    expect(h.chime).toHaveBeenCalledTimes(1);
    expect(side('Player 2').getAttribute('aria-current')).toBe('true');
  });

  it('a child win: the board keeps the win line for a second, then Hooray, then the board with a blue Play again', async () => {
    await renderBoy();
    vi.useFakeTimers();
    play(...CHILD_WINS); // X (the child) takes five in the top row
    // The win line is lit at once; nothing else happens for the first second.
    for (const n of [1, 2, 3, 4, 5]) expect(square(n).className).toContain('caro-win');
    expect(square(31).className).not.toContain('caro-win');
    expect(h.yay).not.toHaveBeenCalled();
    expect(screen.queryByText('Hooray!')).toBeNull();
    expect(playAgain()).toBeNull();
    act(() => { vi.advanceTimersByTime(RESULT_DELAY_MS); });
    expect(h.yay).toHaveBeenCalledTimes(1);
    expect(h.ohOh).not.toHaveBeenCalled();
    expect(screen.getByText('Hooray!')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(HOORAY_MS); });
    expect(screen.queryByText('Hooray!')).toBeNull();
    expect(playAgain()).not.toBeNull();
    fireEvent.click(square(6));
    expect(square(6).getAttribute('aria-label')).toBe('Square 6, empty');
  });

  it('the Play again button is blue', async () => {
    await renderBoy();
    vi.useFakeTimers();
    play(...CHILD_WINS);
    act(() => { vi.advanceTimersByTime(RESULT_DELAY_MS); });
    act(() => { vi.advanceTimersByTime(HOORAY_MS); });
    expect(playAgain()?.style.background).toBe('rgb(79, 143, 216)');
  });

  it('the opponent wins: after a second the Oh-oh toast, then the board stays with Play again, and no popup', async () => {
    await renderBoy();
    vi.useFakeTimers();
    play(...OPPONENT_WINS);
    // The opponent's five stays on the board, lit, while the second passes.
    for (const n of [31, 32, 33, 34, 35]) expect(square(n).className).toContain('caro-win');
    expect(h.ohOh).not.toHaveBeenCalled();
    expect(screen.queryByText('Oh-oh… try again!')).toBeNull();
    act(() => { vi.advanceTimersByTime(RESULT_DELAY_MS); });
    expect(h.ohOh).toHaveBeenCalledTimes(1);
    expect(h.yay).not.toHaveBeenCalled();
    expect(screen.getByText('Oh-oh… try again!')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(OHOH_MS); });
    expect(screen.queryByText('Oh-oh… try again!')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(playAgain()).not.toBeNull();
    // The board is still there, with the five-in-a-row, so the child can see how it was lost.
    expect(square(31).className).toContain('caro-win');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('Play again after a loss gives an empty board and X starts', async () => {
    await renderBoy();
    vi.useFakeTimers();
    play(...OPPONENT_WINS);
    act(() => { vi.advanceTimersByTime(RESULT_DELAY_MS); });
    act(() => { vi.advanceTimersByTime(OHOH_MS); });
    fireEvent.click(playAgain()!);
    expect(square(31).getAttribute('aria-label')).toBe('Square 31, empty');
    expect(side('Player 1').getAttribute('aria-current')).toBe('true');
    expect(playAgain()).toBeNull();
  });

  it('Play again clears the board and X starts again', async () => {
    await renderBoy();
    vi.useFakeTimers();
    play(...CHILD_WINS);
    act(() => { vi.advanceTimersByTime(RESULT_DELAY_MS); });
    act(() => { vi.advanceTimersByTime(HOORAY_MS); });
    fireEvent.click(playAgain()!);
    for (const n of [1, 2, 31]) expect(square(n).getAttribute('aria-label')).toBe(`Square ${n}, empty`);
    expect(side('Player 1').getAttribute('aria-current')).toBe('true');
    expect(playAgain()).toBeNull();
  });

  it('arrow keys move focus across the 30-column board', () => {
    render(<CaroPlay />);
    const board = screen.getByLabelText('Caro board');
    fireEvent.keyDown(board, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(square(1));
    fireEvent.keyDown(board, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(square(31));
    fireEvent.keyDown(board, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(square(30));
  });

  it('the back button goes to the games list', () => {
    render(<CaroPlay />);
    expect(screen.getByRole('link', { name: 'Back to games' }).getAttribute('href')).toBe('/games');
  });

  it('the top right "? Caro" button opens the how-to-play popup, and Esc closes it', () => {
    render(<CaroPlay />);
    fireEvent.click(screen.getByRole('button', { name: 'What is Caro? Show how to play' }));
    const dialog = screen.getByRole('dialog', { name: 'How to play Caro' });
    expect(dialog.querySelectorAll('h2')).toHaveLength(3);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'How to play Caro' })).toBeNull();
  });
});
