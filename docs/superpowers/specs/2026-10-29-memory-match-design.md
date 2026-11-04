# Design: Memory Match (Phase 2, game 1)

Status: **approved by the PO (brainstorm 2026-10-29); implemented on branch claude/phase2/memory-match**. Phase 2 only adds games (ADR-029). This spec covers the game list registry and the "Memory Match" game. Spot the Differences gets its own spec later.

## 1. Goal
Hà My (4-5, cannot read) flips cards to find matching pairs, and hears the English word of every pair she finds. Secondary goal: learn English words by hearing them, over and over, without pressure.

Success:
1. She plays a full level (12, 16, 20, 24 or 30 cards) from the game list to the end with nobody reading to her.
2. A parent adds a new card (picture + English word) in under a minute, and can add many at once with a JSON file.
3. The game list is driven by a registry, so the next game is one new entry.

## 2. Decisions from the brainstorm
| Topic | Decision |
|---|---|
| Content | One shared pool of cards ("card pool"). No sets or boards. Parent adds any number of cards; a few sample cards are seeded. |
| Card | Picture + English word (required), optional recorded pronunciation, active on/off. |
| Levels | 12, 16, 20, 24 or 30 cards = 6, 8, 10, 12 or 15 pairs (grids 4x3, 4x4, 5x4, 6x4, 6x5). The child picks only the level. |
| Deck | On start, 6/8/10/12/15 random cards are drawn from the active pool, each doubled, then shuffled. A level is available only if the pool has enough active cards. |
| Voice | Recorded file if the card has one, else the browser voice in English (`speakKid`). |
| Progress | None. No stars, no storage. A finished level shows a celebration and the number of flips used (not kept). |
| Tech | React + CSS (DOM), like Quiz. Phaser only as a last resort if HTML/CSS cannot do the job (ADR-030). |
| Name | "Memory Match" (English, shown on the game card). |
| Language | The game is English. No Vietnamese text is hard-coded. |

## 3. Requirement IDs
- **G1** game registry. **M1-M10** child side of Memory Match. **A11-A13** admin.

## 4. Game registry (G1)
- New `lib/games/registry.ts`: a typed list of games, each with `id`, `href`, card art and `ready`.
- The game list (`app/games/page.tsx`) reads it instead of `N = 3` and hand-written cards. Entries: Quiz, Memory Match (ready), Spot the Differences (placeholder, not playable).
- The registry has no help flag (the former `hasHelp` was removed by the PO decision). Quiz and Memory Match each have a "How to play ..." popup (Memory Match: 4 steps, `components/MemoryHelp.tsx`), built on the shared shell `components/GameHelp.tsx`, opened only from the in-game badges ("? Quiz", "? Memory Match"). The game list cards show a decorative icon only (`GameIcon` in `components/games/GameArt.tsx`: Quiz "?", Memory Match two flower cards), not a button; the Memory Match card uses sage green (border `#A9CDB1`, title `#5E8F69`), and its icon is green to match the title (circle `#EAF3EC` / ring `#5E8F69`, cards `#C9DFCE`, white petals; the ring green is the exported `MEMORY_GREEN`, shared with the title).
- Enter/Space opens the game at the focused position; drag, arrows and dots keep working (C2, ADR-018).

## 5. Data
New migration, table `memory_cards`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `word` | text not null | English word, trimmed, 1-40 chars |
| `image_path` | text not null | in bucket `media` (PNG/JPG/WebP/SVG, max 2 MB) |
| `audio_path` | text null | optional recorded pronunciation (mp3/m4a/wav) |
| `active` | boolean not null default true | |
| `created_at` | timestamptz | |

- RLS: anon may `select` where `active`; only the admin may insert/update/delete. Storage rules are the existing `media` rules.
- Seed: 31 sample cards (21 reused or added everyday and shape pictures from `public/seed/*.svg`, plus 10 school and home cards: ruler, pencil, pen, eraser, book, scissors, backpack, cup, chair, clock; the 10 come from a second migration) so every level can be tried right away. Seeded paths start with `seed/` and are never deleted from storage (T15 rule).
- A level is available when enough cards are active: 12 cards needs 6, 16 cards needs 8, 20 cards needs 10, 24 cards needs 12, 30 cards needs 15.

## 6. Child screens
### 6.1 Level select, `/games/memory` (M1)
- Five buttons in one centered row (about 300 px each, 48 px gaps), drawn as mini card grids (4x3, 4x4, 5x4, 6x4, 6x5), each with its label "12 cards" / "16 cards" / "20 cards" / "24 cards" / "30 cards" under the picture (decorative; the `aria-label` stays). A level without enough cards is dimmed and cannot be chosen.
- Empty pool: a friendly picture screen, not an error (like C11). Load failure: the same screen.
- A "? Memory Match" badge (top right, like the "? Quiz" badge on the Quiz set screen) opens the "How to play Memory Match" popup (the only way to open it); its last button (Play) only closes it. While the popup is open, Esc/Back/Close/backdrop close it without leaving the screen, and Left/Right do not move the level focus.
- Back button, music button. Keys: Left/Right move, Enter/Space choose, Esc goes back. Visible focus ring.

### 6.2 Play, `/games/memory/[level]` (M2-M9)
Layout: 1920x1080 stage, centered grid of 4x3, 4x4, 5x4, 6x4 or 6x5 cards sized to fit. Header with back button.

- **M2 Card faces.** Face-down: light-pink background with one small white/pale-yellow flower (inline SVG), same on every card. Face-up: the card picture on white, no written word. The English word is only heard, never shown.
- **M3 Flip.** Click/tap or Enter/Space flips a face-down card with a slow flip (about 0.5 s). Each flip and each flip-back plays a soft "tick" sound.
- **M4 Match.** Two face-up cards with the same card id: both stay up, a gentle bounce/sparkle animation plays, a soft "ting ting" chime plays, then the English word is read once (recorded file, else `speakKid`).
- **M5 No match.** Both cards stay visible about 1.2 s, then flip back gently. No penalty sound, no timer, and no counter on screen during play (flips are counted silently, see M7). While this happens, new flips are ignored.
- **M6 Replay.** Clicking a matched (face-up) card plays its English word again. Clicking the single face-up unmatched card does nothing.
- **M7 Completion.** When every pair is found, after about 1 s a celebration shows in the same page: dense confetti, "You did it, <child name>!" with the applause/praise sound (or the custom "You did it" sound from Settings), the **number of flips** used in this game as the text "Total N times" with N highlighted (for the parent to see; the child does not need to read it), on the shared celebration scene with 3 stars and both characters (same as the Quiz set-done page), and two picture buttons: "play again" (draws a new deck at the same level) and "choose level".
- **M8 Keyboard.** Arrow keys (all four) move focus across the grid; Enter/Space flips or replays; Esc returns to the level screen. Visible focus ring.
- **M9 Reduced motion.** With `prefers-reduced-motion`: no 3D flip and no bounce, the face just fades. Sounds stay.
- **M10 Robustness.** Missing picture: a plain placeholder, game still playable. No English voice on the device: no spoken word, game still works. Leaving the page cancels timers and speech. A third quick click during a mismatch is ignored.
- **Flip count.** One flip = turning a face-down card face-up (the fewest possible is 2 x pairs: 12, 16, 20, 24, 30 cards give 12, 16, 20, 24, 30). Flip-backs, replays of matched cards and ignored clicks are not counted. The count is shown only on the completion screen, is not saved, and there is no best score or comparison.
- Images of the drawn deck are preloaded before the first flip.

### 6.3 Sounds
- "tick" (flip/flip-back) and "ting ting" (match) are synthesized with Web Audio in `lib/sfx.ts`, like `yay` and `ohOh`; no audio files. Quiet, short. Background music keeps playing (ADR-016). Nothing plays before "tap to enter".

## 7. Admin (A11-A13)
New "Cards" item in the admin nav, `/admin/cards`.

- **A11 Card pool.** A grid of all cards (picture, word, on/off). Add, edit, delete (always with a confirmation, ADR-022). Per card: English word, picture upload (or SVG code), optional pronunciation upload, active toggle, "play" to hear it (recording, else the browser voice). A warning (not a block) when two cards share the same word.
- **A11 Saving** follows T15: picking a file only previews it; Save uploads the new files first, then writes the database; replaced, removed or deleted files are freed after a successful save; Revert discards unsaved edits; Save is disabled until every card is complete (picture + word).
- **A12 JSON import.** A "Quick import cards" text button (blue, no fill) sits in the page header next to Revert and Save, in the order Quick import, Revert, Save; it opens a dialog with a short guide, a "Download memory-cards-template.json" button (`public/memory-cards-template.json`) and a file picker. Shape: `cards[]`, each `word` (required), `image` (blank, `https://` link, or raw SVG code), `audio` (blank or `https://` link), `active` (optional, default true). Validation runs before anything changes and lists every problem with its card number (invalid JSON, no cards, missing word, word over 40 chars, bad image/audio value, file over 1 MB, more than 100 cards). Nothing is imported if there is any error. Valid cards are added to the pool as unsaved changes; cards with a blank image show in the completeness list and are finished by hand. SVG rules, size limit and "same drawing = one file" reuse the Quiz import code (`lib/quizImport.ts`).
- **A13 Pool health.** The page shows which levels are currently available ("6 / 8 / 10 / 12 / 15 active cards needed", for example "12 active cards: levels 12, 16, 20 and 24 are available; 30 needs 15") so the parent knows how many cards to add.

## 8. Architecture notes
- New units: `lib/games/registry.ts`, `lib/memory/deck.ts` (pure: `drawDeck(cards, pairs, rng)`), `lib/memory/rules.ts` (pure state machine for flips/matches), `lib/memory/import.ts` (parser/validator), UI under `app/games/memory/` and `app/admin/cards/`, components `MemoryCard`, `LevelButton`.
- Pure units are unit-tested without the DOM. The UI calls them; it does not re-implement the rules.
- `lib/keynav.ts` gets a 2D grid step (arrows in four directions).
- Reuses: `Stage`, `Hills`, `BackButton`, `MusicButton`, `Confetti`, `speakKid`, `playFile`, the pending-media/T15 save code, `ConfirmDialog`, `ImportDialog` pattern.

## 9. Testing
- Unit: `drawDeck` (right pair count, each card exactly twice, shuffled, never more than available, not enough cards), flip state machine (match, mismatch, third click ignored, replay, win, flip count: only face-down to face-up counts), level availability, JSON import (valid file, each error, blank images, SVG, URLs, the template file itself), sfx calls.
- Component: level select (dimmed levels, empty state), play screen (flip, match plays word, replay, completion buttons, keyboard grid navigation, reduced motion), admin pool (add/edit/delete/toggle, confirm, import dialog).
- Database: migration applies to an empty project; anon reads only active cards; every write by anon is denied (as T1).
- By hand (PO): how the flip, sounds and voice feel in the browser.
- Each ticket's acceptance criteria are written in `docs/superpowers/plans/2026-10-29-memory-match.md` and checked before a Trello card moves to Done.

## 10. Out of scope (this game)
Progress/stars, saved or best scores, per-set boards, "words learned" statistics, other languages, timers, Phaser, Spot the Differences (separate spec). The flip count is shown at the end of a game only.

## 11. ADR to add
- **ADR-030:** Phase 2 games use HTML/CSS (DOM) first. Phaser is a last resort, used only if a game cannot be built well with HTML/CSS.

## 12. Confirmed by the PO (2026-10-29)
- The English word is not shown on cards; it is only heard.
- Import limits: up to 100 cards per file, 40 characters per word.
- Seed pool of 31 cards: 21 from the first migration (reusing `public/seed/*.svg` plus new simple drawings) and 10 school and home cards from `20261030000000_memory_cards_school_home.sql`.
- The completion screen shows the number of flips.
