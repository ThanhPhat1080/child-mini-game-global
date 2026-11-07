import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// X1-X8 on the game page: 30x20 board in the middle, two players on the sides, turn animation, help popup.

const h = vi.hoisted(() => ({ chime: vi.fn(), yay: vi.fn(), ohOh: vi.fn(), push: vi.fn(), settings: vi.fn(), profile: vi.fn(), script: [] as number[] }));
vi.mock('@/lib/sfx', () => ({ chime: h.chime, yay: h.yay, ohOh: h.ohOh }));
vi.mock('@/lib/auth/roles', () => ({ getMyProfile: () => h.profile() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({}) }));
// The robot's picks come from `h.script` first (cells, in order), so a round can be played out exactly; then the real robot.
vi.mock('@/lib/caro/robot', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/caro/robot')>();
  return { ...real, robotMove: (...args: Parameters<typeof real.robotMove>) => (h.script.length ? h.script.shift()! : real.robotMove(...args)) };
});
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
/** Renders the page and picks "vs human" on the first screen, so the board is up (X1-X12 are two-player). */
function renderHuman() {
  render(<CaroPlay />);
  fireEvent.click(screen.getByRole('button', { name: /vs human/ }));
}
/** Renders the page and waits until the child's settings have loaded (a boy by default, so X is the child). */
async function renderBoy() {
  renderHuman();
  // Against a human the opponent is the parent: the initials of "Lan Anh" (no picture).
  await waitFor(() => expect(side('Player 2').textContent).toBe('LA'));
}

beforeEach(() => {
  h.profile.mockReset().mockResolvedValue({ display_name: 'Lan Anh' });
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
    renderHuman();
    expect(squares()).toHaveLength(600);
    const board = screen.getByLabelText('Caro board');
    expect(board.style.gridTemplateColumns).toBe('repeat(30, 38px)');
    expect(board.style.gridTemplateRows).toBe('repeat(20, 38px)');
    // Centred horizontally on the 1920-wide stage.
    expect(parseFloat(board.style.left)).toBeCloseTo((1920 - parseFloat(board.style.width)) / 2, 0);
  });

  it('the top X and O chips are gone', () => {
    renderHuman();
    expect(screen.queryByLabelText('X player')).toBeNull();
    expect(screen.queryByLabelText('O player')).toBeNull();
  });

  it('a boy is X (blue), a girl is O (red), and X always starts', async () => {
    await renderBoy();
    // The child (boy) is X, so the child is the side whose turn it is.
    expect(side('Player 1').getAttribute('aria-current')).toBe('true');
    expect(side('Player 2').getAttribute('aria-current')).toBeNull();
  });

  it('a girl is O, the opponent is the parent, and the child waits for X to move', async () => {
    h.settings.mockResolvedValue({ gender: 'female', child_name: 'Mai', avatar_path: null });
    renderHuman();
    await waitFor(() => expect(side('Player 2').textContent).toBe('LA'));
    // The girl is O: the opponent (X) starts.
    expect(side('Player 1').getAttribute('aria-current')).toBeNull();
    expect(side('Player 2').getAttribute('aria-current')).toBe('true');
    fireEvent.click(square(1));
    // After X moved, O (the child, a girl) is up.
    expect(side('Player 1').getAttribute('aria-current')).toBe('true');
    expect(side('Player 2').getAttribute('aria-current')).toBeNull();
  });

  it("the child's own avatar is shown when there is one; against a human the opponent is the parent's initials", async () => {
    h.settings.mockResolvedValue({ gender: 'male', child_name: 'Bin', avatar_path: 'kids/bin.png' });
    renderHuman();
    await waitFor(() => expect(picture('Player 1').getAttribute('src')).toContain('/media/kids/bin.png'));
    await waitFor(() => expect(side('Player 2').textContent).toBe('LA'));
    expect(picture('Player 2')).toBeNull();
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

  it('after the round the board is inert, Play again? carries its text, and Back and Guide stay clickable', async () => {
    await renderBoy();
    vi.useFakeTimers();
    play(...CHILD_WINS);
    act(() => { vi.advanceTimersByTime(RESULT_DELAY_MS); });
    act(() => { vi.advanceTimersByTime(HOORAY_MS); });
    expect(playAgain()?.textContent).toContain('Play again?');
    expect(screen.getByLabelText('Caro board').hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('link', { name: 'Back to games' }).hasAttribute('inert')).toBe(false);
    expect(screen.getByRole('button', { name: /What is Caro/ }).hasAttribute('inert')).toBe(false);
    fireEvent.click(square(6));
    expect(square(6).getAttribute('aria-label')).toBe('Square 6, empty');
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
    renderHuman();
    const board = screen.getByLabelText('Caro board');
    fireEvent.keyDown(board, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(square(1));
    fireEvent.keyDown(board, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(square(31));
    fireEvent.keyDown(board, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(square(30));
  });

  it('the back button goes to the games list', () => {
    renderHuman();
    expect(screen.getByRole('link', { name: 'Back to games' }).getAttribute('href')).toBe('/games');
  });

  it('the top right "? Caro" button opens the how-to-play popup, and Esc closes it', () => {
    renderHuman();
    fireEvent.click(screen.getByRole('button', { name: 'What is Caro? Show how to play' }));
    const dialog = screen.getByRole('dialog', { name: 'How to play Caro' });
    expect(dialog.querySelectorAll('h2')).toHaveLength(3);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'How to play Caro' })).toBeNull();
  });
});

// X13-X16: the first screen picks the opponent; the robot plays the other mark, after a short think.
describe('Caro X O against the robot (X13-X16)', () => {
  const human = () => screen.getByRole('button', { name: /vs human/ });
  const robotBtn = () => screen.getByRole('button', { name: /vs Robot/ });
  const board = () => screen.getByLabelText('Caro board');
  const filled = () => squares().filter((s) => s.getAttribute('aria-label')?.match(/, [XO]$/)).length;
  /** Renders the page and picks the robot. */
  async function renderRobot() {
    render(<CaroPlay />);
    fireEvent.click(robotBtn());
    await act(async () => { await Promise.resolve(); });
  }

  beforeEach(() => {
    h.script.length = 0;
  });

  it('X13: the first screen has a blue "human" and a yellow "Robot" with a robot icon, and no board yet', async () => {
    render(<CaroPlay />);
    expect(squares()).toHaveLength(0);
    expect(human().getAttribute('aria-label')).toBe('vs human');
    expect(robotBtn().querySelector('svg')).not.toBeNull();
    await waitFor(() => expect(human().getAttribute('aria-label')).toBe('Bin vs human'));
    expect(robotBtn().getAttribute('aria-label')).toBe('Bin vs Robot');
    expect(human().style.background).toBe('rgb(79, 143, 216)');
    expect(robotBtn().style.background).toBe('rgb(229, 201, 121)');
  });

  it('X13: the human choice shows the two-player board, with the parent on the right', async () => {
    render(<CaroPlay />);
    fireEvent.click(human());
    expect(squares()).toHaveLength(600);
    await waitFor(() => expect(side('Player 2').textContent).toBe('LA'));
  });

  it('X13: the picker shows the child, "vs", and the parent initials or the robot icon', async () => {
    render(<CaroPlay />);
    // The child's picture, "vs" and the parent's initials once the profile has loaded.
    await waitFor(() => expect(human().textContent).toBe('vsLA'));
    expect(human().querySelectorAll('img')).toHaveLength(1);
    expect(robotBtn().textContent).toBe('vs');
    expect(robotBtn().querySelectorAll('img')).toHaveLength(1);
    expect(robotBtn().querySelector('svg')).not.toBeNull();
  });

  it('X13: against the robot, the right side is the prince or princess again, as before', async () => {
    await renderRobot();
    expect(squares()).toHaveLength(600);
    expect(picture('Player 2').getAttribute('src')).toContain('princess.webp');
  });

  it('X14: the child is X (boy) and moves first; the board waits while the robot answers with O', async () => {
    h.script.push(200);
    await renderRobot();
    fireEvent.click(square(1));
    expect(filled()).toBe(1);
    // The robot is due: the board is inert, so a press does nothing.
    expect(board().getAttribute('inert')).not.toBeNull();
    fireEvent.click(square(2));
    expect(filled()).toBe(1);
    await waitFor(() => expect(filled()).toBe(2), { timeout: 3000 });
    expect(square(201).getAttribute('aria-label')).toBe('Square 201, O');
    expect(screen.getByLabelText('Player 1').getAttribute('aria-current')).toBe('true');
    expect(board().getAttribute('inert')).toBeNull();
  });

  it('X14: a girl is O, so the robot is X and starts by itself', async () => {
    h.settings.mockResolvedValue({ gender: 'female', child_name: 'Mai', avatar_path: null });
    h.script.push(100);
    await renderRobot();
    await waitFor(() => expect(square(101).getAttribute('aria-label')).toBe('Square 101, X'), { timeout: 3000 });
    expect(screen.getByLabelText('Player 1').getAttribute('aria-current')).toBe('true');
  });

  it('X15: the robot makes five and the child sees Oh-oh, not Hooray; Play again starts a new round', async () => {
    // The child (X) plays 1, 2, 3, 4 and 100 (no five). The robot (O) answers 31, 32, 33, 34, then 35 makes five on row 1.
    h.script.push(31, 32, 33, 34, 35);
    await renderRobot();
    for (const n of [1, 2, 3, 4, 100]) {
      if (n !== 1) await waitFor(() => expect(board().getAttribute('inert')).toBeNull(), { timeout: 3000 });
      fireEvent.click(square(n));
    }
    await waitFor(() => expect(h.ohOh).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(h.yay).not.toHaveBeenCalled();
    await waitFor(() => expect(playAgain()).not.toBeNull(), { timeout: 5000 });
    expect(board().getAttribute('inert')).not.toBeNull();

    fireEvent.click(playAgain()!);
    expect(square(1).getAttribute('aria-label')).toBe('Square 1, empty');
    expect(filled()).toBe(0);
  }, 20000);

  it('X16: the robot gets its picks from the real medium AI when no script is left (the game still plays)', async () => {
    await renderRobot();
    fireEvent.click(square(1));
    await waitFor(() => expect(filled()).toBe(2), { timeout: 3000 });
    expect(squares().filter((s) => s.getAttribute('aria-label')?.endsWith(', O'))).toHaveLength(1);
  });
});
