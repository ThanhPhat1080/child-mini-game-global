# Design: Puzzle Pairs (Phase 2)

Status: **design approved by the PO in the grilling session of 2026-11-07; waiting for the PO's OK on the plan before any code.** Mockup: `docs/superpowers/mockups/2026-11-07-puzzle-pairs.html` (also published as a private artifact for the PO). The mockup stage is 1280x720; the game uses the usual 1920x1080 stage, so every size below is the mockup size x 1.5.

## 1. Goal
Four pictures are each cut into a left half and a right half. The 8 halves lie face down in random order. To turn a half over, the child answers one question taken at random from Quiz or Listen & Pick. Face-up halves can be dragged; dropping a half on its other half joins them into the whole picture, says the picture's English word, and puts the picture on a shelf. Four pictures on the shelf end the level; the next level is a new random draw.

Success:
1. A child plays a whole level with a grown-up beside her and never needs to read.
2. The Super Admin controls which pictures the game may use from one admin page; parents do nothing new.
3. Questions come from the content that already exists (Quiz sets, card pool); no new question authoring.

## 2. Decisions (grilling session, 2026-11-07)
| Topic | Decision |
|---|---|
| Name and ids | "Puzzle Pairs" (English), registry id `pairs`, route `/games/pairs`, child requirement IDs **H1-H12**, admin IDs **A32-A35**. |
| Pictures | A new list `puzzle_pictures` that only the Super Admin edits: picture from the Image Library, English word, optional sound from the Sound Library, on/off. One list for every family. Seeded with fish, triangle, house, apple (the `seed/` files). |
| Level | 4 pictures drawn at random from the pictures that are on; 8 halves shuffled into a 2 x 4 grid. Each new level is a new random draw. Nothing is stored. |
| Cut | Left and right halves with a jigsaw tab (the left half has a round tab, the right half the matching notch), cut with CSS `clip-path` from the one picture file. |
| Question source | 50/50 Quiz or Listen & Pick. Quiz: a random published set the child can see (family's own + global, the same list as the Quiz game), then a random playable question of that set. Listen & Pick: a random card the child can see plus two other cards (the same pool as Listen & Pick). |
| Wrong answer | Like Quiz and Listen & Pick: "Oh-Oh", the answer dims and is disabled, she picks again. No penalty. |
| Close the question | X (top right), Esc or a click on the backdrop closes it; the half stays face down and nothing counts. Opening that half again draws a new question. |
| Matching | Mouse drag only (a grown-up plays along; ADR-037). Face-down halves cannot be dragged and do not accept a drop. |
| Board movement | Drop on a face-up half = try to join. Hover over a face-down half or an empty slot for 0.2 s = make room there (the others slide). After a join the rest close the gap. A drop on the wrong face-up half slides back, silently. |
| Join | Chime, then the word once (recording if the picture has one, else the kid voice), then the whole picture flies to the shelf. |
| Finish | The shared celebration screen with two picture buttons: new level, back to games. |
| Tech | React + CSS (DOM), no Phaser (ADR-030). |

## 3. Child requirements
| ID | Requirement |
|---|---|
| H1 | Entry: `/games/pairs` plays directly (no level select). Registry entry `pairs`, ready. Game list card with its own color (proposed berry: border `#E3B5CF`, title and icon ring `#A2577F`, circle `#F8EAF2`; final values from the screenshots the PO approves) and a decorative two-halves icon (`aria-hidden`). A "? Puzzle Pairs" badge opens "How to play" (`GameHelp`, 3 steps). |
| H2 | Level: 4 pictures from the active `puzzle_pictures` (pictures with the same word, trimmed and ignoring case, count once). Each picture gives a left (`L`) and a right (`R`) half; the 8 halves are shuffled into slots 0-7 of a 2 x 4 grid, all face down. When more than 4 pictures are on, a new level is never the exact same 4 as the level before. |
| H3 | Tap (or Enter/Space on the focused half) on a face-down half opens the question modal. Ignored while a modal is open, while a join is animating, or on a face-up half. |
| H4 | Question draw: Quiz or Listen & Pick with equal chance; when one source has nothing, the other is used; when both are empty the half turns over without a question. Never the same question twice in a row. Quiz questions are the ones the Quiz game would play (prompt text or prompt sound, at least 2 answers, each with a picture or text, exactly one right). Listen questions need at least 3 cards with different words. |
| H5 | Modal: the question as in its own game (Quiz: prompt picture/text/sound and 2-3 answers; Listen & Pick: big speaker and 3 pictures), number + fixed color answers (1 rose, 2 sky, 3 butter). The prompt is said automatically after a short pause and again with the speaker button or R. X top right (`ModalClose size="child"`), Esc and a backdrop click close it; the half stays face down and the next open draws a new question. |
| H6 | Wrong pick: "Oh-Oh" (custom `ohoh_path` as in Quiz), the answer dims and is disabled, the "Oh-oh... try again!" popup shows for 1.4 s; Listen & Pick says the word again after a short pause. |
| H7 | Right pick: "Hooray" (custom `hooray_path`), the answer grows with a ring; after 1.2 s the modal closes and the half turns over (a 0.56 s horizontal flip; a fade under reduced motion). |
| H8 | Drag: only face-up halves, primary button, starts after 8 px of movement. While dragging, a face-up half under the pointer glows (join target); a face-down half or an empty slot under the pointer for 0.2 s makes the halves slide so the dragged half takes that slot. A drop outside the board, or a release without a target, puts it in the slot it is shown in. |
| H9 | Join: dropping a half on the other half of the same picture slides both into the whole picture at the target's slot, plays the chime, says the word (`sayWord`: recording if `audio_path`, else kid voice), then moves the whole picture to the next free shelf place (4 places above the board) and the remaining halves close the gap in grid order. A drop on any other face-up half slides back with no sound. |
| H10 | Finish: 0.9 s after the 4th picture lands on the shelf, the shared `CelebrationScene` (stars, confetti, the child's celebration pictures) with the 4 pictures and two picture buttons: new level (H2 draw again) and back to `/games`. The "custom You did it" sound applies as in Quiz. |
| H11 | Keyboard: Left/Right (and Tab) move between halves in grid order, Enter/Space on a face-down half opens the question; in the modal 1/2/3 pick, Left/Right move, Enter/Space pick, R replays, Esc closes; Esc outside the modal goes to `/games`. Joining is mouse only (ADR-037). Visible focus ring everywhere. |
| H12 | Robustness and calm: fewer than 4 usable pictures or a load failure shows the friendly picture screen (like Listen & Pick); a missing picture shows a placeholder; no English voice means no spoken word; leaving the page cancels timers and speech; the level's pictures are preloaded; reduced motion keeps only fades. No timer, no score, no counter on screen. |

## 4. Admin requirements
| ID | Requirement |
|---|---|
| A32 | Super Admin page `/admin/puzzle` ("Puzzle Pairs pictures"), in the Super Admin group (parents get the no-permission screen, like the other Super Admin pages) and in the sidebar. A table: picture, English word (1-40 characters), sound (optional, Sound Library; play button; empty = "Kid voice reads the word"), On switch, remove. "Add from Image Library" opens the library pop-up and adds one row per chosen picture with an empty word. Save and discard like the Cards page; Save is disabled when nothing changed or a row is incomplete (no picture or no word). |
| A33 | A status chip shows "N on · ready" (green) when at least 4 pictures with different words are on, else "N on · needs at least 4" (rose). Two rows with the same word get the duplicate warning used on the Cards page (save is still allowed). |
| A34 | Media: `puzzle_pictures.image_path` and `audio_path` count as used. A file used by the list cannot be deleted from the library, renaming it re-points the rows (`MEDIA_SOURCES`, `media_in_use`, `media_used_by_others`). |
| A35 | Seed: four active rows, `fish`/`seed/fish.svg`, `triangle`/`seed/triangle.svg`, `house`/`seed/house.svg`, `apple`/`seed/apple.svg`, no sound; the migration skips a row whose `image_path` already exists. |

## 5. Data model
New table `public.puzzle_pictures` (migration `supabase/migrations/20261108000000_puzzle_pictures.sql`):

| Column | Type |
|---|---|
| `id` | `uuid` primary key, default `gen_random_uuid()` |
| `word` | `text not null`, `char_length(btrim(word)) between 1 and 40` |
| `image_path` | `text not null` |
| `audio_path` | `text` null |
| `active` | `boolean not null default true` |
| `sort_order` | `int not null default 0` |
| `owner_id` | `uuid` null, references `profiles(user_id)` on delete set null, default `auth.uid()` (null for the seed rows) |
| `created_at` | `timestamptz not null default now()` |

RLS: `select` for `anon, authenticated` using `active or public.current_role() = 'super_admin'`; `insert`, `update`, `delete` for `authenticated` only when `public.current_role() = 'super_admin'`. No other role can write. `media_in_use(text)` and `media_used_by_others(text)` gain the two columns.

## 6. Child screen (1920 x 1080 stage)
- Top row: Back and Music buttons on the left (as in every game), the help badge on the right, and the shelf in the middle: 4 places of 168 x 168 at y 60, 36 apart, centered.
- Board: slots of 300 x 354, 45 apart across and 24 apart down, grid left edge at x 292, top at y 294. A whole picture card is 336 x 336 (picture 300 x 300 with an 18 px white border); a half shows x 0-168 plus a tab of radius 33 (left) or x 168-336 with the notch (right).
- Face-down back: peach `#F5D9C4` with soft white dots and a pale "?" circle; face up: white card with half the picture.
- Modal: 1350 x 840 white card centered on a soft dark veil, X 96 px top right, speaker 150 px, answers 330 px with number badges.

## 7. Architecture
- Pure units (unit-tested): `lib/pairs/geometry.ts` (sizes, `slotXY`, `pieceXY`, `slotAt`, `shelfXY`, `wholeXY`), `lib/pairs/board.ts` (`drawLevel`, `dealPieces`, `parsePieceId`, `isPair`, `moveTo`, `removePair`, `dropIntent`), `lib/pairs/questions.ts` (`drawQuestion`, `pickListenQuestion`), `lib/quiz/playable.ts` (the Quiz game's question filter and types, moved out of the quiz page so both games share it).
- Loaders: `lib/pairs/load.ts` (`fetchPuzzlePictures`, `fetchQuestionSources`), `lib/pairs/adminPictures.ts` (admin load/save/validation).
- UI: `app/games/pairs/page.tsx`, `components/pairs/*` (`PairsBoard`, `PairsPiece`, `PairsShelf`, `QuestionModal`, `QuizAsk`, `PairsDone`, `usePairsDrag`), `components/PairsHelp.tsx`, `app/admin/(super)/puzzle/page.tsx`, `components/admin/PuzzlePictures.tsx`.
- Reuses: `ListenQuestion`, `sayWord`/`stopWord`, `fetchActiveCards`, `familyOrGlobal`/`dropOwnCopies`/`playerId`, `yay`/`ohOh`/`chime`/`speakKid`, `SLOT_COLORS`, `ModalClose`, `GameHelp`, `CelebrationScene`, `Stage`, `Hills`, `BackButton`, `MusicButton`, `LoadError`, `LibraryButton`/`MediaLibraryDialog`, the drag math in `lib/sort/drag.ts`.

## 8. Testing
- Unit: geometry round trips, `drawLevel` (fewer than 4, duplicate words, never the same 4 twice in a row when more than 4), `dealPieces` (8 ids, each picture twice, shuffled by the rng), `dropIntent` (join target, make room, own slot, outside), `moveTo`/`removePair`, `drawQuestion` (50/50 by rng, fallback to the other source, both empty, no repeat), `pickListenQuestion` (three different words), `isPlayableQuestion`, admin validation and ready count.
- Component: piece face up/down, modal (auto-say, wrong dims, right calls back after 1.2 s, X/Esc/backdrop close without callback), board drag (join, wrong join slides back, make room), page (level flow, finish, empty pool, load error, help), admin page (add from library, word edit, switch, remove, status chip, save).
- DB (`npm run test:rls`): parent and anon read only active rows, cannot write; Super Admin reads all and writes; `media_in_use` sees both columns.
- E2E: a full level by mouse (questions answered through the modal), close with X keeps the half down, wrong join slides back, finish and new level, empty pool screen, the admin page saves a new picture that the game then uses.

## 9. ADR-037 (to add to `docs/decision.md`)
**Puzzle Pairs halves are joined by mouse drag only.** The keyboard rule (1/2/3, arrows, Enter/Space, Esc) still covers opening a half, answering, closing and leaving, but joining two halves needs a drag. Reason: the PO expects a grown-up to play this game with the child, and a keyboard "pick up and drop" mode would add a second interaction model for little gain. Revisit if a child is expected to play it alone.
