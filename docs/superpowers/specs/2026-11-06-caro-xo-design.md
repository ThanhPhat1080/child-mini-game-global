# Caro X O for two players (Phase 2 game)

Date: 2026-11-06. Status: implemented on branch `claude/phase2/caro-xo`.
Requirement IDs: X1–X12 (listed in `spec.md`, section 4g).

## 1. Goal

Two players (the child and a grown-up, or two children) play caro X O on one computer, taking turns.
The board is large, so the cells are easy to hit with a mouse or the keyboard.

## 2. Decisions

- **Board:** 30 columns × 20 rows. **Five in a row** wins (rows, columns and both diagonals).
- **Players:** the child is on the left, the opponent on the right. A boy plays **X** (blue), a girl plays **O** (red). X always starts.
- **Pictures:** the child's own avatar (the prince or princess picture when there is none). The opponent is the other gender's picture: for a boy the **princess**, for a girl the **prince**.
- **Turn:** the player whose turn it is bounces gently, and their mark wiggles. Nothing moves when the round is over. Reduced motion turns both off.
- **Layout:** the board is centred. There are no X and O chips at the top.
- **Card and icon on the game list:** a drawn 3×3 caro board with the word "Caro" under it. The round icon is kept.
- **Help:** a "? Caro" button at the top right, like the other games. It opens the how-to-play popup (`GameHelp`, 3 steps).
- **Calm and slow:** no timer, no penalty, no score. A press on an occupied cell does nothing. Win and draw end the round.
- **Sound:** `chime()` when a mark is placed. A child win plays the Hooray (`yay`, with the child's own hooray sound if set). An opponent win plays the Oh-oh (`ohOh`, with the child's own sound if set). A draw plays nothing extra.
- **Keyboard:** Arrow keys move between cells, Enter or Space place a mark, Esc goes back (`lib/keynav.ts`, `BackButton`). A visible focus ring stays on the focused cell.

## 3. Requirements

- **X1** Board: 30 columns × 20 rows of cells (38 px cells, 2 px gap), centred on the 1920×1080 stage.
- **X2** Players take turns, X first. A press on an occupied cell or after the round is over does nothing.
- **X3** Two player sides: the child on the left (their avatar, then their mark: X for a boy, O for a girl), the opponent on the right (the other gender's prince or princess, then the other mark).
- **X4** The side whose turn it is bounces and its mark wiggles (`caro-bob`, `caro-wobble`). Reduced motion stops both.
- **X5** Five in a row wins. The five winning cells are highlighted. The sound and screen depend on who won (X11, X12).
- **X6** A full board with no five in a row is a draw. The draw is shown by the board alone (no penalty, no message).
- **X7** When the round ends, a "play again" button (drawn arrow, no text) at the top centre starts a new empty board.
- **X8** Keyboard: Arrow keys move between the 600 cells, Enter and Space place a mark, Esc goes back. Works on the `/games/caro` page only.
- **X9** The game is in the game registry (ADR-014) and in the game list carousel: a drawn 3×3 board and the word "Caro" on the card, and the round icon.
- **X10** A "? Caro" button at the top right opens the how-to-play popup (dialog "How to play Caro", 3 steps, Play goes to `/games/caro`, Esc closes).
- **X11** The child wins: the full-screen Hooray (star, confetti, "Hooray!") shows for about 3 seconds, then the board is shown again with the win line and Play again.
- **X12** The opponent wins: the Oh-oh toast ("Oh-oh… try again!") shows, then a small popup opens over a blurred board: "Let's try again?" with the child's round avatar in the middle, and two choices. Yes starts a new board. No goes back to the game list. Arrow keys move between Yes and No; Yes has focus when the popup opens.

## 4. Out of scope

- Playing against the computer, online play, scores, or saved games.
- Any admin-written content (the game has no content to manage).
