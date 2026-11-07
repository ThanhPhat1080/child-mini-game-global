# Puzzle Pairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the game "Puzzle Pairs": 8 face-down picture halves; a right answer to a random Quiz or Listen & Pick question turns a half over; dragging a half onto its other half joins the picture, says its word and puts it on the shelf; 4 pictures end the level. Plus a Super Admin page that picks the pictures.

**Architecture:** Plain React + CSS (ADR-030). Pure units hold the logic (`lib/pairs/geometry.ts`, `lib/pairs/board.ts`, `lib/pairs/questions.ts`); the page renders state and calls them. One new table `puzzle_pictures` (Super Admin writes, everyone reads active rows). Questions reuse existing content: the Quiz question filter moves to `lib/quiz/playable.ts`, Listen questions come from `fetchActiveCards`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (Postgres + RLS), Vitest + Testing Library (jsdom), Vitest against throwaway Postgres (`npm run test:rls`), Playwright against the stand-in Supabase.

**Spec:** `docs/superpowers/specs/2026-11-07-puzzle-pairs-design.md` (requirement IDs H1-H12, A32-A35, ADR-037). Mockup: `docs/superpowers/mockups/2026-11-07-puzzle-pairs.html`.

## Global Constraints
- Stage 1920 x 1080. Sizes (spec section 6): slot 300 x 354, gaps 45 across / 24 down, grid origin (292, 294); whole card 336 x 336 (picture 300, border 18); tab radius 33 centered at x 168, y 168; shelf places 168 x 168 at y 60, 36 apart, centered.
- Answer colors from `SLOT_COLORS` (`lib/tokens.ts`): 1 rose, 2 sky, 3 butter. Keys 1/2/3, Left/Right, Enter/Space, R, Esc.
- Timings: drag starts after `TAP_SLOP_PX` (8); make-room dwell 200 ms; hooray to flip 1200 ms; flip 560 ms; oh-oh popup 1400 ms; join: slide 600 ms, chime, word, fly to shelf after 2000 ms; finish 900 ms after the 4th picture lands.
- Sounds: `yay`/`ohOh` with the child's `hooray_path`/`ohoh_path`, `chime()` on a join, `sayWord` for the word; nothing plays before "tap to enter". No timers or penalties shown to the child. `prefers-reduced-motion`: fades only.
- No hard-coded child text except the English game name, the "How to play" steps and "Oh-oh... try again!"/"Hooray!" as already used by Listen & Pick.
- Schema change only through `supabase/migrations/20261108000000_puzzle_pictures.sql`. Never the service role key in the frontend.
- Checks before every commit: `npm run typecheck`, `npm run lint`, `npm test`. `npm run build` at the end of every task that adds a page. `npm run test:rls` in Task 1 (`PG_BIN=/opt/homebrew/bin LC_ALL=C` locally).
- E2E only for the specs this work touches: `PW_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npx playwright test e2e/pairs-play.spec.ts e2e/admin-puzzle.spec.ts e2e/games.spec.ts`.
- Branch: `claude/phase2/puzzle-pairs` (cut from `develop`, holds the spec, mockup and this plan). One commit per task, citing the IDs. PR into `develop` only after the PO plays it; never push to `develop`/`main`.
- After code changes run `graphify update .` if the `graphify` CLI is installed (it is not on this machine today; skip and say so).

## Review Focus
- A picture whose word appears twice in `puzzle_pictures` (e.g. two "apple" rows): the level must never hold two pictures with the same word, or two left halves would "match" visually but not by id. Test in Task 2 (`drawLevel` dedupes by word).
- A drop while a join is still animating, or a second modal opened by a fast double click: one join, one modal. Tests in Task 4 (`busy` ignores press) and Task 5 (open ignored while a modal is open).
- A quiz set whose questions are all unplayable (no right answer, one answer): it must not be drawn and must not stop Listen questions. Test in Task 2 (`drawQuestion` skips empty sets) and Task 3 (`fetchQuestionSources` drops sets with no playable question).
- Fewer than 3 distinct card words but Quiz content present: every question is a Quiz question, the game still works. Test in Task 2.
- The page left mid-join or mid-question (Back, Esc): no word is said afterwards and no state update after unmount. Test in Task 6 (unmount cancels timers and calls `stopWord`).

---

### Task 1: Table, RLS, seed, media references, stand-in

**Files:**
- Create: `supabase/migrations/20261108000000_puzzle_pictures.sql`
- Create: `tests/db/puzzle-pictures.test.ts`
- Create: `tests/pairsSeed.test.ts`
- Modify: `lib/media/refs.ts` (`MEDIA_SOURCES`)
- Modify: `e2e/support/standin-supabase.mjs` (`TABLES`, seed state), `e2e/support/fixtures.ts` (state type)
- Modify: `tests/mediaRefs.test.ts`
- Modify: `spec.md` (new sections 3e Puzzle Pairs child H1-H12, 4i Puzzle Pairs admin A32-A35, data model line), `docs/decision.md` (ADR-037, text from spec section 9), `CLAUDE.md` (Phase 2 line: Puzzle Pairs H1-H12, A32-A35 on `claude/phase2/puzzle-pairs`)

**Interfaces:**
- Produces: table `public.puzzle_pictures(id, word, image_path, audio_path, active, sort_order, owner_id, created_at)` exactly as spec section 5; `MEDIA_SOURCES` entries `{ table: 'puzzle_pictures', column: 'image_path', kind: 'image' }` and `{ table: 'puzzle_pictures', column: 'audio_path', kind: 'audio' }`; stand-in table `puzzle_pictures` seeded with the four A35 rows.

- [ ] **Step 1: Write the failing DB tests** in `tests/db/puzzle-pictures.test.ts`, using `tests/db/harness.ts` like `tests/db/content-rls.test.ts`:
  - `seed rows exist`: select as anon returns words `['apple','fish','house','triangle']` (sorted) with `image_path` `seed/<word>.svg`, `audio_path` null.
  - `anon and parent read only active rows`: Super Admin sets `fish` inactive; anon and a parent see 3 rows; Super Admin sees 4.
  - `parent cannot write`: parent insert, update and delete each fail (error or 0 rows changed).
  - `super admin writes`: insert `{word:'star', image_path:'<sa-id>/library/star-x.svg'}` succeeds and `owner_id` equals the Super Admin's id; update and delete succeed.
  - `word length`: insert with word `'   '` and with 41 characters fails.
  - `media_in_use sees both columns`: after the insert above with `audio_path '<sa-id>/library/star-y.mp3'`, `media_in_use` is true for both paths, false for an unused path.
- [ ] **Step 2: Run them to see them fail**: `PG_BIN=/opt/homebrew/bin LC_ALL=C npm run test:rls -- tests/db/puzzle-pictures.test.ts` → FAIL (relation does not exist).
- [ ] **Step 3: Write the migration.** Table, check, `enable row level security`, the four policies from spec section 5 (`public.current_role() = 'super_admin'`), grants matching `memory_cards`, the idempotent seed (`insert ... select ... where not exists (select 1 from public.puzzle_pictures p where p.image_path = v.image_path)`, `sort_order` 0-3, `owner_id` null). Redefine `public.media_in_use(text)` and `public.media_used_by_others(text)` by copying their newest definitions (`grep -l "function public.media_in_use" supabase/migrations/*.sql | tail -1`, same for the other) and adding `or exists (select 1 from public.puzzle_pictures z where p_path in (z.image_path, z.audio_path))` (for `media_used_by_others` with `and z.owner_id::text is distinct from (storage.foldername(p_path))[1]`). Keep their `security definer`, `search_path` and grants.
- [ ] **Step 4: Run the DB tests**: same command → PASS; then the whole `npm run test:rls` → PASS.
- [ ] **Step 5: Seed test** `tests/pairsSeed.test.ts` (pattern `tests/memorySeed.test.ts`): the migration text seeds exactly the four A35 words with `seed/<word>.svg`, and each seed file exists in `public/seed`. Add the two `puzzle_pictures` columns to the expectations in `tests/mediaRefs.test.ts`. Implement the `MEDIA_SOURCES` lines. Run `npx vitest run tests/pairsSeed.test.ts tests/mediaRefs.test.ts` → PASS.
- [ ] **Step 6: Stand-in.** Add `'puzzle_pictures'` to `TABLES` in `e2e/support/standin-supabase.mjs` with the four seed rows (`active: true`, ids `pp-fish` etc.) in the initial state, and `puzzle_pictures: Row[]` to the state type in `e2e/support/fixtures.ts`. No new e2e test yet.
- [ ] **Step 7: Docs.** Add spec.md sections and ADR-037; update the CLAUDE.md Phase 2 line (keep the file under one page).
- [ ] **Step 8: Checks and commit**: `npm run typecheck && npm run lint && npm test`, then
  `git commit -m "feat(pairs): puzzle_pictures table, RLS, seed and media refs (A34, A35)"`.

### Task 2: Pure game logic

**Files:**
- Create: `lib/pairs/types.ts`, `lib/pairs/geometry.ts`, `lib/pairs/board.ts`, `lib/pairs/questions.ts`, `lib/quiz/playable.ts`
- Modify: `app/games/quiz/[setId]/page.tsx` (import the type and filter from `lib/quiz/playable.ts` instead of its own copy; no behavior change)
- Test: `tests/pairsGeometry.test.ts`, `tests/pairsBoard.test.ts`, `tests/pairsQuestions.test.ts`, `tests/quizPlayable.test.ts`

**Interfaces:**
- Produces (`lib/pairs/types.ts`):
  ```ts
  export type PuzzlePicture = { id: string; word: string; image_path: string; audio_path: string | null };
  export type Side = 'L' | 'R';
  export type Pt = { x: number; y: number };
  ```
- Produces (`lib/quiz/playable.ts`), moved verbatim from the quiz page:
  ```ts
  export type QuizAnswer = { slot: number; image_path: string | null; text: string | null; is_correct: boolean };
  export type QuizQuestion = { id: string; position: number; prompt_text: string | null; prompt_image_path: string | null; prompt_audio_path: string | null; read_answers: boolean; hide_answer_text: boolean; answers: QuizAnswer[] };
  export function sortAnswers(q: QuizQuestion): QuizQuestion;            // answers by slot
  export function isPlayableQuestion(q: QuizQuestion): boolean;          // the existing filter
  ```
- Produces (`lib/pairs/geometry.ts`): constants `SLOT_W=300, SLOT_H=354, GAP_X=45, GAP_Y=24, GRID_X=292, GRID_Y=294, CARD=336, HALF=168, TAB_R=33, SHELF_SIZE=168, SHELF_GAP=36, SHELF_Y=60, COLS=4`;
  `slotXY(i: number): Pt` (top-left of slot i), `pieceXY(side: Side, i: number): Pt` (top-left of the 336-wide piece box so its visible half is centered in slot i), `wholeXY(i: number): Pt` (whole card centered in slot i), `slotAt(p: Pt): number` (-1 outside the 2 x 4 grid; the gap belongs to the nearer slot), `shelfXY(k: number): Pt`.
- Produces (`lib/pairs/board.ts`):
  ```ts
  export const pieceId = (pictureId: string, side: Side): string => `${pictureId}:${side}`;
  export function parsePieceId(id: string): { pictureId: string; side: Side };
  export function drawLevel(pool: readonly PuzzlePicture[], rng: () => number, previous: readonly string[]): PuzzlePicture[] | null;
  export function dealPieces(pictures: readonly PuzzlePicture[], rng: () => number): string[];
  export function isPair(a: string, b: string): boolean;
  export function moveTo(order: readonly string[], id: string, index: number): string[];
  export function removePair(order: readonly string[], a: string, b: string): string[];
  export type DropIntent = { kind: 'join'; targetId: string } | { kind: 'room'; index: number } | { kind: 'none' };
  export function dropIntent(order: readonly string[], up: ReadonlySet<string>, dragId: string, p: Pt): DropIntent;
  ```
- Produces (`lib/pairs/questions.ts`):
  ```ts
  import type { Question as ListenQ } from '@/lib/listen/rounds';
  export type QuestionSources = { quiz: { setId: string; questions: QuizQuestion[] }[]; cards: MemoryCard[] };
  export type DrawnQuestion = { kind: 'quiz'; key: string; question: QuizQuestion } | { kind: 'listen'; key: string; question: ListenQ };
  export function pickListenQuestion(cards: readonly MemoryCard[], rng: () => number): ListenQ | null;
  export function drawQuestion(src: QuestionSources, rng: () => number, lastKey: string | null): DrawnQuestion | null;
  ```

- [ ] **Step 1: Write the failing tests.**
  - `tests/pairsGeometry.test.ts`: `slotXY(0)` is `{x:292,y:294}`, `slotXY(5)` is `{x:292+345,y:294+378}`; `slotAt` of the center of every slot returns that slot; `slotAt({x:100,y:400})` is -1; `pieceXY('L',i).x + 84` and `pieceXY('R',i).x + 168 + 84` both equal `slotXY(i).x + 150` (visible half centered); `wholeXY(i).x + 168 === slotXY(i).x + 150`; the shelf is centered: `(shelfXY(0).x + shelfXY(3).x + SHELF_SIZE) / 2 === 960` and `shelfXY(0).x === 570`.
  - `tests/pairsBoard.test.ts`: `drawLevel` returns null for 3 pictures and for 5 pictures with only 3 distinct words; with exactly 4 it returns all 4; with 6 pictures and `previous` = the ids drawn last time it never returns the same set (run 50 seeded rngs); duplicates by word (`' Apple '` and `'apple'`) are never both drawn. `dealPieces` returns 8 ids, each picture once with `L` and once with `R`, order depends on the rng. `isPair('a:L','a:R')` true, `isPair('a:L','b:R')` false, `isPair('a:L','a:L')` false. `moveTo(['a','b','c','d'],'a',2)` is `['b','c','a','d']`. `removePair` keeps the others in order. `dropIntent`: pointer on a face-up other half → `join`; on a face-down half → `room` with that index; on the dragged half's own slot → `none`; on an empty slot past the end → `room` with `order.length - 1`; outside the grid → `none`.
  - `tests/pairsQuestions.test.ts`: with both sources, `rng` < 0.5 gives `quiz` and ≥ 0.5 gives `listen`; with no quiz sets every draw is `listen`; with fewer than 3 distinct card words every draw is `quiz`; both empty → null; a set with zero questions is never chosen; a draw never returns `key === lastKey` when another question exists (keys: `quiz:<questionId>`, `listen:<cardId>`); `pickListenQuestion` gives 3 different words and `options[answerIndex] === answer`.
  - `tests/quizPlayable.test.ts`: the existing rule (prompt text or prompt audio, ≥ 2 answers, each with image or text, exactly one right).
- [ ] **Step 2: Run them**: `npx vitest run tests/pairsGeometry.test.ts tests/pairsBoard.test.ts tests/pairsQuestions.test.ts tests/quizPlayable.test.ts` → FAIL (modules missing).
- [ ] **Step 3: Implement** the four modules. `drawLevel`: dedupe by `word.trim().toLowerCase()` (first row wins), shuffle with `rng`, take 4; if the pool has more than 4 and the drawn ids equal `previous` as a set, swap one drawn picture for a random undrawn one. `drawQuestion`: decide the kind with one `rng()` call (< 0.5 quiz) among the kinds that have content, then retry up to 5 times to avoid `lastKey`. Change the quiz page to import from `lib/quiz/playable.ts`.
- [ ] **Step 4: Run** the same command → PASS, then `npx vitest run tests/QuizQuestionFrame.test.tsx tests/QuizSets.test.tsx` → PASS (quiz unchanged).
- [ ] **Step 5: Commit**: `git commit -m "feat(pairs): board, geometry and question draw logic (H2, H4, H8, H9)"`.

### Task 3: Loaders

**Files:**
- Create: `lib/pairs/load.ts`
- Test: `tests/pairsLoad.test.ts` (mock `@/lib/supabase/client` the way `tests/memoryCards.test.ts` does)

**Interfaces:**
- Consumes: `PuzzlePicture`, `QuestionSources`, `isPlayableQuestion`, `sortAnswers` (Task 2); `fetchActiveCards`, `familyOrGlobal`, `dropOwnCopies`, `playerId`.
- Produces:
  ```ts
  export async function fetchPuzzlePictures(): Promise<PuzzlePicture[]>;  // active, by sort_order then created_at; throws Error(message) on failure
  export async function fetchQuestionSources(): Promise<QuestionSources>;  // throws only when both sources fail
  ```

- [ ] **Step 1: Failing tests**: `fetchPuzzlePictures` queries `puzzle_pictures` with `active = true`, orders by `sort_order` then `created_at`, maps rows to `PuzzlePicture`, throws on a Supabase error. `fetchQuestionSources`: reads `quiz_sets` with `status = 'published'` through `familyOrGlobal`, drops own copies, reads `questions` with `.in('set_id', ids)` and the select string the quiz page uses, keeps only playable questions, drops sets with none; cards come from `fetchActiveCards`; a failing quiz query still returns cards (and the reverse); both failing throws.
- [ ] **Step 2: Run**: `npx vitest run tests/pairsLoad.test.ts` → FAIL.
- [ ] **Step 3: Implement** `lib/pairs/load.ts`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat(pairs): load puzzle pictures and question sources (H2, H4)"`.

### Task 4: Board, pieces, shelf and drag

**Files:**
- Create: `components/pairs/PairsPiece.tsx`, `components/pairs/PairsShelf.tsx`, `components/pairs/PairsBoard.tsx`, `components/pairs/usePairsDrag.ts`, `components/pairs/pairs.module.css`
- Test: `tests/PairsBoard.test.tsx`

**Interfaces:**
- Consumes: geometry and board functions (Task 2); `stageScale`, `TAP_SLOP_PX` from `lib/sort/drag.ts`; `mediaUrl`, `Pic`.
- Produces:
  ```ts
  // PairsBoard.tsx
  export type BoardProps = {
    pictures: ReadonlyMap<string, PuzzlePicture>;
    order: readonly string[];
    up: ReadonlySet<string>;
    flipping: string | null;          // piece id playing the flip animation
    busy: boolean;                    // join animating or modal open: presses ignored
    stageRef: React.RefObject<HTMLElement | null>;
    onOpen: (pieceId: string) => void;                 // tap/Enter on a face-down half
    onMove: (order: string[]) => void;                 // make-room result on drop
    onJoin: (dragId: string, targetId: string) => void; // only called when isPair
  };
  export function PairsBoard(props: BoardProps): JSX.Element;
  // PairsShelf.tsx
  export function PairsShelf(props: { done: readonly PuzzlePicture[] }): JSX.Element;
  ```
  The join animation (slide to `wholeXY`, fly to `shelfXY`) is driven by the page through a `joining: { a: string; b: string; phase: 'slide' | 'fly'; shelfIndex: number } | null` prop added to `BoardProps`.

- [ ] **Step 1: Failing tests** in `tests/PairsBoard.test.tsx` (pointer events with `fireEvent.pointerDown/Move/Up`, stage width mocked to 1920 so the scale is 1):
  - face-down halves render the back and no picture; face-up halves render the picture `img` with `alt=""`.
  - a click on a face-down half calls `onOpen(id)`; Enter and Space on it call `onOpen`; a click on a face-up half does not.
  - pressing a face-down half and moving 50 px does not start a drag (no `data-dragging`).
  - dragging `a:L` (up) onto `a:R` (up) and releasing calls `onJoin('a:L','a:R')`; onto `b:R` (up) calls neither `onJoin` nor `onMove` and the half returns to its slot transform.
  - dragging onto a face-down half, advancing fake timers 200 ms, then releasing calls `onMove` with the `moveTo` result; releasing before 200 ms calls nothing.
  - `busy` true: press and click do nothing.
  - Left/Right move focus between halves in `order`.
- [ ] **Step 2: Run**: `npx vitest run tests/PairsBoard.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Each piece is a 336 x 336 absolutely positioned box with `transform: translate(x, y)` and `transform-origin: 0 0`, `pointer-events: none`; its inner shape has the `clip-path` (left: `path('M27,0 H168 V135 A33,33 0 0 1 168,201 V336 H27 Q0,336 0,309 V27 Q0,0 27,0 Z')`, right: `path('M168,0 H309 Q336,0 336,27 V309 Q336,336 309,336 H168 V201 A33,33 0 0 0 168,135 Z')`), `pointer-events: auto`, `tabIndex 0`, `role="button"`, and is the focus target. The shadow and the join glow are `filter: drop-shadow(...)` on the outer box (a clip-path cuts box-shadow). Transitions: `transform .6s cubic-bezier(.3,.75,.3,1)`, none while dragging. Flip: `scaleX` keyframes 1 → 0 → 1 over 560 ms, the face swaps at 280 ms, origin at the visible half's center (84 px or 252 px). `usePairsDrag` follows `useSortDrag` (pointer capture, primary button, slop, cancel on unmount) and calls `dropIntent` on each move; the dwell timer handles `room`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat(pairs): board with face-down halves, drag to join and make room (H3, H8, H9, H11)"`.

### Task 5: Question modal

**Files:**
- Create: `components/pairs/QuestionModal.tsx`, `components/pairs/QuizAsk.tsx`
- Test: `tests/PairsQuestionModal.test.tsx`

**Interfaces:**
- Consumes: `DrawnQuestion` (Task 2); `ListenQuestion` (`components/listen/ListenQuestion.tsx`, props `{question, wrong, picked, locked, speaking, onPick, onReplay}`); `ModalClose size="child"`; `yay`, `ohOh`, `speakKid`, `sayWord`, `stopWord`; `SLOT_COLORS`; `mediaUrl`.
- Produces:
  ```ts
  export function QuestionModal(props: {
    drawn: DrawnQuestion;
    sounds: { hooray: string | null; ohoh: string | null };
    onRight: () => void;   // called once, 1200 ms after the right pick
    onClose: () => void;   // X, Esc, backdrop
  }): JSX.Element;
  export function QuizAsk(props: { question: QuizQuestion; wrong: ReadonlySet<number>; picked: number | null; locked: boolean; speaking: boolean; onPick: (i: number) => void; onReplay: () => void }): JSX.Element;
  ```

- [ ] **Step 1: Failing tests** (fake timers, `sfx` and `cards` modules mocked):
  - listen: renders three pictures, says the word after the open pause; a wrong pick calls `ohOh(ohoh)` once, marks that answer disabled and shows the oh-oh popup, which is gone after 1400 ms; the right pick calls `yay(hooray)` and `onRight` exactly once after 1200 ms; further clicks during that time do nothing.
  - quiz: renders the prompt picture and text and 3 answers with badges 1/2/3; says `prompt_text` (or plays `prompt_audio_path`); key `2` picks the second answer; R replays; a 2-answer question renders 2 answers and key `3` does nothing.
  - X, Esc and a click on the backdrop call `onClose` and never `onRight`; a click inside the card does not close.
  - unmount stops speech (`stopWord` called) and pending timers do not call `onRight`.
- [ ] **Step 2: Run**: `npx vitest run tests/PairsQuestionModal.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** `QuizAsk` copies the Quiz answer look (number badge, `SLOT_COLORS` ring and background, text answers and `read_answers` read aloud like the quiz page) at the modal's size; the modal is `role="dialog" aria-modal="true"` with focus on the first answer and a focus trap (`lib/trapTab.ts`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat(pairs): question modal for Quiz and Listen & Pick questions (H4-H7)"`.

### Task 6: Game page, finish, help, game list

**Files:**
- Create: `app/games/pairs/page.tsx`, `components/pairs/PairsDone.tsx`, `components/PairsHelp.tsx`
- Modify: `lib/games/registry.ts` (`'pairs'` in the id union and the list), `app/games/page.tsx` (`TITLE.pairs = 'Puzzle Pairs'`, `BORDER.pairs`, the id check on line 101), `components/games/GameArt.tsx` (`pairs` icon: two halves of a rounded square with a tab, in a round pale circle, `aria-hidden`)
- Test: `tests/PairsPlay.test.tsx`, `tests/PairsDone.test.tsx`, `tests/PairsHelp.test.tsx`, `tests/GamesPage.test.tsx` (expects the new card)

**Interfaces:**
- Consumes: everything above; `fetchPuzzlePictures`, `fetchQuestionSources`; `getMyChildSettings` (sounds, as the quiz page); `CelebrationScene`, `Stage`, `Hills`, `BackButton`, `MusicButton`, `LoadError`, `GameHelp`, `chime`, `sayWord`, `stopWord`.
- Produces: route `/games/pairs`; `PairsDone({ pictures, onAgain, onHome })`.

- [ ] **Step 1: Failing tests** in `tests/PairsPlay.test.tsx` (loaders mocked with the four seed pictures and one quiz + four cards; `Math.random` seeded through a mocked rng module or `vi.spyOn(Math, 'random')`):
  - loading shows the friendly screen until data arrives; then 8 face-down halves and 4 empty shelf places.
  - click a half → modal; answer right → after 1200 ms the modal is gone and that half is face up.
  - close with X → half still face down; open again → a different question key than the closed one.
  - when both question sources are empty, a click turns the half over at once.
  - join `fish:L` and `fish:R` through the board's `onJoin` → `chime` called, `sayWord` called with the fish picture, after the fly the shelf shows 1 picture and the board 6 halves.
  - four joins → after 900 ms `PairsDone` shows the 4 pictures; "new level" deals 8 new face-down halves and an empty shelf.
  - 3 pictures → the friendly empty screen with a back button; a loader error → `LoadError`, retry reloads.
  - Esc with no modal open navigates to `/games`; unmount during a join calls `stopWord` and no later `sayWord`.
  - `PairsDone` and `PairsHelp` tests follow `tests/ListenDone.test.tsx` and `tests/ListenHelp.test.tsx`.
- [ ] **Step 2: Run**: `npx vitest run tests/PairsPlay.test.tsx tests/PairsDone.test.tsx tests/PairsHelp.test.tsx tests/GamesPage.test.tsx` → FAIL.
- [ ] **Step 3: Implement** the page as a reducer over `{ pictures, order, up, done, modal, joining, flipping, lastKey, previousLevel }`, with every timer in one ref cleared on unmount. Preload the 4 level pictures (`new Image()`) before showing the board.
- [ ] **Step 4: Run** → PASS; `npm run build` → success.
- [ ] **Step 5: Screenshots for the PO**: `npm run dev`, open `/games` and `/games/pairs` at 1920 x 1080 (board, modal, a join, the finish screen); check nothing overlaps or is clipped; send them to the PO to confirm the game-list colors.
- [ ] **Step 6: Commit**: `git commit -m "feat(pairs): Puzzle Pairs game page, finish and help (H1-H12)"`.

### Task 7: Super Admin picture page

**Files:**
- Create: `lib/pairs/adminPictures.ts`, `components/admin/PuzzlePictures.tsx`, `app/admin/(super)/puzzle/page.tsx`
- Modify: `components/AdminNav.tsx` (Super Admin list: `{ href: '/admin/puzzle', text: 'Puzzle', glyph: <puzzle-piece path> }`)
- Test: `tests/pairsAdminPictures.test.ts`, `tests/AdminPuzzle.test.tsx`, `tests/AdminNav.test.tsx` (Super Admin sees "Puzzle", a parent does not)

**Interfaces:**
- Consumes: table from Task 1; `LibraryButton`/`MediaLibraryDialog` (`kind: 'image' | 'audio'`, `onChoose(path)`); `randomId`; `sayWord`.
- Produces:
  ```ts
  export type EPicture = { id: string; isNew: boolean; image: string | null; word: string; audio: string | null; active: boolean };
  export const isPictureComplete = (p: EPicture): boolean;            // image set, word trimmed 1-40
  export function duplicateWords(rows: readonly EPicture[]): Set<string>;
  export function readyCount(rows: readonly EPicture[]): number;     // active rows with distinct words
  export async function loadPictures(): Promise<EPicture[]>;
  export async function savePictures(saved: EPicture[], draft: EPicture[]): Promise<{ error: string | null }>; // insert new, update changed, delete removed; sort_order = row index
  ```

- [ ] **Step 1: Failing tests**: `pairsAdminPictures.test.ts` covers the four helpers (complete/incomplete, duplicate words ignoring case and spaces, ready count with an inactive and a duplicate row, save issues one insert, one update, one delete for a mixed diff and reports a Supabase error). `AdminPuzzle.test.tsx`: rows render with picture, word, sound label "Kid voice reads the word" when empty, switch, remove; "Add from Image Library" adds a row per chosen path with an empty word and Save disabled until the word is typed; the chip reads "4 on · ready", then "3 on · needs at least 4" after switching one off; Save calls `savePictures` and shows the success toast; a save error shows the error toast and keeps the draft.
- [ ] **Step 2: Run**: `npx vitest run tests/pairsAdminPictures.test.ts tests/AdminPuzzle.test.tsx tests/AdminNav.test.tsx` → FAIL.
- [ ] **Step 3: Implement**, following the Cards page for the save/discard bar and toasts (Nunito, admin styles).
- [ ] **Step 4: Run** → PASS; `npm run build` → success.
- [ ] **Step 5: Commit**: `git commit -m "feat(pairs): Super Admin page for Puzzle Pairs pictures (A32, A33)"`.

### Task 8: End-to-end tests and wrap-up

**Files:**
- Create: `e2e/pairs-play.spec.ts`, `e2e/admin-puzzle.spec.ts`
- Modify: `e2e/games.spec.ts` (the list has the Puzzle Pairs card and it opens `/games/pairs`)

**Interfaces:**
- Consumes: stand-in table from Task 1; `reset(...)` from `e2e/support/fixtures.ts`; a seeded quiz set and cards (already in the stand-in).

- [ ] **Step 1: Write the specs.** `pairs-play`: open `/games/pairs` as a child; for each half, click it and answer the modal by trying answers 1, 2, 3 in turn until the modal closes (a wrong pick only dims, so this always ends on the right one; no test-only attribute in the UI); close one modal with X and check the half is still face down; drag one wrong pair (slides back) and the four right pairs with `page.mouse` (move in 10 steps); the finish screen shows; "new level" deals 8 face-down halves. Empty pool: `reset` with 3 active pictures → friendly screen. Console errors fail the test (as `e2e/memory-play.spec.ts`). `admin-puzzle`: the Super Admin adds a library picture with the word "star", saves, switches "fish" off, saves; a parent opening `/admin/puzzle` gets the no-permission screen.
- [ ] **Step 2: Run**: `PW_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npx playwright test e2e/pairs-play.spec.ts e2e/admin-puzzle.spec.ts e2e/games.spec.ts` → PASS.
- [ ] **Step 3: Full checks**: `npm run typecheck && npm run lint && npm test && npm run build`, and `PG_BIN=/opt/homebrew/bin LC_ALL=C npm run test:rls` → all pass.
- [ ] **Step 4: Commit and push**: `git commit -m "test(pairs): e2e for play and the Super Admin page (H1-H12, A32-A35)"`, `git push -u origin claude/phase2/puzzle-pairs`. Tell the PO the branch (`git fetch origin && git checkout claude/phase2/puzzle-pairs`, `npm ci && npm run dev`) and wait for the play-test before opening the PR into `develop`.
