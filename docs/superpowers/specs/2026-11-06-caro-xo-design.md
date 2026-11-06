# Caro X O for two players (Phase 2 game)

Date: 2026-11-06. Status: implemented on branch `claude/phase2/caro-xo`.
Requirement IDs: X1–X8 (listed in `spec.md`, section 4g).

## 1. Goal

Two players (children, or a child and a grown-up) play caro X O on one computer, taking turns.
The board is large, so the cells are easy to hit with a mouse or the keyboard.

## 2. Decisions

- **Board:** 20 columns × 20 rows. **Five in a row** wins (rows, columns and both diagonals). This is not the small three-in-a-row board.
- **Two players on one device:** Player 1 places **X** (blue), Player 2 places **O** (red). X always starts.
- **No text on screen:** the child cannot read (CLAUDE.md). Marks are drawn shapes in fixed colours; the turn is shown by the marks, not by words.
- **Game card:** the card art is drawn marks only (a row of five X), with no title text, so the card follows the same rule.
- **Calm and slow:** no timer, no penalty, no score. A press on an occupied cell does nothing. Win and draw end the round.
- **Sound:** `chime()` when a mark is placed, `applause()` on a win. No spoken words (`yay()` speaks a fixed English line, so it is not used).
- **Keyboard:** Arrow keys move between cells, Enter or Space place a mark, Esc goes back (`lib/keynav.ts`, `BackButton`). A visible focus ring stays on the focused cell.

## 3. Requirements

- **X1** Board: 20 columns × 20 rows of cells (40 px cells, 2 px gap), centred on the 1920×1080 stage.
- **X2** Players take turns, X first. A press on an occupied cell or after the round is over does nothing.
- **X3** The turn is shown by the two player marks at the top; the player whose turn it is is enlarged and ringed.
- **X4** Five in a row wins. The five winning cells are highlighted, and the win plays `applause()`.
- **X5** A full board with no five in a row is a draw. The draw is shown by the board alone (no penalty, no message).
- **X6** When the round ends, a "play again" button (drawn arrow, no text) in the top right starts a new empty board.
- **X7** Keyboard: Arrow keys move between cells, Enter and Space place a mark, Esc goes back. Works on the `/games/caro` page only.
- **X8** The game is in the game registry (ADR-014) and in the game list carousel, with a drawn card and icon. Reduced motion (`prefers-reduced-motion`) removes the win pulse.

## 4. Out of scope

- Playing against the computer, online play, scores, or saved games.
- Any admin-written content (the game has no content to manage).
