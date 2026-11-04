# Design: Listen & Pick (Phase 2, game 2)

Status: **implemented on branch `claude/phase2/listen-pick` (2026-10-30), awaiting the PO play-test before merge into `develop`**. Phase 2 only adds games (ADR-029). Order chosen by the PO: Listen & Pick, then sorting (Group It), then Spot the Differences; each gets its own spec and plan.

## 1. Goal
Hà My (4-5, cannot read) hears an English word and taps the matching picture out of three. She plays a full round of 10 questions with nobody reading to her. Secondary goal: learn English words by hearing them, without pressure.

Success:
1. She plays a full round from the game list to the end on her own.
2. A parent does nothing new in the admin: the game uses the Memory Match card pool (`memory_cards`, page Cards).
3. The game is one more registry entry (ADR-014); no migration.

## 2. Decisions from the brainstorm
| Topic | Decision |
|---|---|
| Content | The shared card pool (picture + English word + optional recording, active on/off). No new tables. |
| Mode | One fixed mode: 10 questions, 3 pictures each. No level screen. |
| Answers | Like Quiz: number + fixed color (1 rose, 2 sky, 3 butter), keys 1/2/3. |
| Wrong pick | Like Quiz: "Oh-Oh" sound, the picked picture dims and stays disabled, she picks again. No penalty, no timer. |
| Right pick | "Hooray" sound, the word is said once more, next question. |
| Progress | None stored, except the temporary "wrong picks" log (L7). |
| Parent view | The finish screen shows how many wrong picks and which words (L6); data lives in localStorage only. |
| Tech | React + CSS (DOM), no Phaser (ADR-030). |
| Name | "Listen & Pick" (English). |

## 3. Requirement IDs
- **G1** (extended): registry entry. **L1-L10**: child side of Listen & Pick. No admin IDs.

| ID | Requirement |
|---|---|
| L1 | Entry: `/games/listen` plays directly (no level select). Registry entry `listen`, ready. |
| L2 | Round: 10 questions, each with a different answer card; two distractors are random other cards; the answer position (1/2/3) is random. |
| L3 | Voice: the word is said automatically when a question appears and again on speaker button / key R. Recorded file if the card has one, else `speakKid`. |
| L4 | Wrong pick: "Oh-Oh", the picture dims and is disabled, the word is said again after a short pause. |
| L5 | Right pick: "Hooray", the word is said once, then the next question. After question 10 the finish screen shows. |
| L6 | Finish screen: shared celebration scene (3 stars, both characters, confetti), "Wrong N times" with N highlighted, and two picture buttons: play again (new 10 questions), back to games. If any picks were wrong, a row of small round pictures with the English word and count ("apple x2"); tapping one says the word. No row when there were none. |
| L7 | Wrong-picks log in localStorage under one key (`hamy.listen.wrong`), entries `{id, word, count}`. It is written at every wrong pick. Cleared when a round starts (also after a reload, which starts a new round), on play again and on leaving to the game list. Blocked or failing storage: the game works and the list still shows from memory for that page visit. |
| L8 | Keyboard: 1/2/3 pick, Left/Right move, Enter/Space pick, R replays the word, Esc goes back. Visible focus ring. |
| L9 | Reduced motion: no bounce or slide, pictures just fade. Sounds stay. |
| L10 | Robustness: missing picture shows a placeholder; no English voice means no spoken word, game still works; leaving the page cancels timers and speech; clicks on a disabled picture or during the hooray pause are ignored; the question's images are preloaded. |

## 4. Rounds (L2)
- The pool is the active cards (`fetchActiveCards`). Needs at least 3.
- With 3 to 9 active cards the round has as many questions as there are cards (7 cards = 7 questions); with 10 or more it has 10.
- Answer cards are drawn without repeats. Each question's two distractors are drawn from the other active cards, different from each other and from the answer; their picture order and the answer position are shuffled.
- Cards with the same word (trim, ignoring case) count once and never share a question.
- Fewer than 3 active cards, or a load failure: a friendly picture screen, not an error (like C11 and M1).

## 5. Child screens
### 5.1 Play, `/games/listen` (L1-L5, L8-L10)
- 1920x1080 stage, three large picture buttons in one row, each with its number badge and fixed color border (rose, sky, butter), a big speaker button centered above them. Back and music buttons like Quiz. A "? Listen & Pick" badge top right opens the "How to play" popup (shell `GameHelp`, 3 short steps in `ListenHelp`); the popup is opened only from this badge, Esc/Back/Close/backdrop close it without leaving the screen, and Left/Right do not move focus while it is open.
- On a new question the word is said after a short pause. Nothing plays before "tap to enter". Background music keeps playing (ADR-016).
- Wrong picks dim the picture (opacity and a soft grayscale), they are not hidden. Feedback is like Quiz: a wrong pick wobbles the picture and shows the "Oh-oh… try again!" popup for 1.4 s (non-blocking, a new wrong pick restarts it); the right pick grows with a ring in its color and the Hooray overlay (soft glow, confetti, star, "Hooray!", no countdown) stays until the next question fades in (slow, like the other games). With reduced motion the popups appear without wobble, bounce, ring or flash.
- No counter, no progress text on screen during play. A row of 10 small dots is allowed as decoration if it reads well in the mockup (PO to confirm at the mockup stage).

### 5.2 Finish (L6)
Same page, after the last right pick (about 1 s pause). Built on `CelebrationScene` with a children slot for the "Wrong N times" line and the picture row.

### 5.3 Empty or failed (see section 4)
Friendly picture screen with a back button.

## 6. Game list entry (G1)
- `lib/games/registry.ts`: `listen`, ready, href `/games/listen`. `components/games/GameArt.tsx`: a decorative speaker-wave icon in a round pale circle (not a button, not focusable, `aria-hidden`).
- Colors: Quiz rose, Memory Match sage, Spot sky; Listen & Pick uses lavender (proposed border `#C9BFE4`, title and icon ring `#7B6BAE`, circle `#F0ECF8`; final values from the mockup the PO approves before building).
- Enter/Space opens the game at the focused position; drag, arrows and dots keep working (C2, ADR-018).

## 7. Sounds
`yay`/`ohOh` from `lib/sfx.ts` (the "custom You did it" sound from Settings applies on the finish screen as in Quiz). Word via `sayWord`. No new audio files.

## 8. Architecture notes
- New pure units: `lib/listen/rounds.ts` (`buildRounds(cards, rng, max = 10)` returns questions `{answer, options: [c, c, c], answerIndex}` and throws or returns `null` for fewer than 3 cards) and `lib/listen/wrongLog.ts` (`readWrong`, `recordWrong(card)`, `clearWrong`, `totalWrong`; all storage access in try/catch).
- UI: `app/games/listen/page.tsx`, `components/listen/*` (question view, finish content), `components/ListenHelp.tsx`.
- Reuses: `fetchActiveCards`, `sayWord`/`stopWord`, `lib/keynav.ts` (`handleChoiceKey`), `Stage`, `Hills`, `BackButton`, `MusicButton`, `CelebrationScene`, `Confetti`, `GameHelp`, `preload`.
- No migration. No change to `memory_cards` or to RLS.

## 9. Testing
- Unit: `buildRounds` (question count 10 and the 3-to-9 shortening, no repeated answers, three different cards per question, answer position varies with the rng, fewer than 3 cards), `wrongLog` (record, count merge, summary, clear, storage unavailable or throwing), key handling.
- Component: play screen (auto-say, speaker replays, wrong dims and says "Oh-Oh", right says "Hooray" and advances, ignored clicks), finish (with and without wrong picks, tapping a word replays it), empty pool, help popup, reduced motion.
- E2E (Playwright): a full round by mouse and by keyboard; a wrong pick then the right pick; the finish list and its clearing on play again; empty pool screen; list entry opens the game.
- By hand (PO): how the voice, sounds and pacing feel.

## 10. Out of scope
Stored progress or statistics, an admin view of wrong picks, levels, timers, Phaser, other languages. Sorting and Spot the Differences are separate specs.
