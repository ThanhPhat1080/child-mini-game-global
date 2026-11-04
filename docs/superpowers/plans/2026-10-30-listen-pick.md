# Listen & Pick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the game "Listen & Pick": the child hears an English word and taps the matching picture out of three, 10 questions per round, with a parent-only list of wrong picks on the finish screen.

**Architecture:** Plain React + CSS like Quiz and Memory Match. Two pure units hold the logic (`lib/listen/rounds.ts`, `lib/listen/wrongLog.ts`); the page only renders and calls them. It reads the existing `memory_cards` pool through `fetchActiveCards` and speaks with `sayWord`. No migration, no admin change.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (read only), Vitest + Testing Library (jsdom), Playwright (E2E against the stand-in Supabase). No Phaser (ADR-030).

**Spec:** `docs/superpowers/specs/2026-10-30-listen-pick-design.md`

## Global Constraints
- Round: 10 questions, 3 pictures each; with 3 to 9 usable cards the round has one question per card; fewer than 3 usable cards shows the friendly picture screen.
- Answer slots: number + fixed color (1 rose, 2 sky, 3 butter) from `SLOT_COLORS` in `lib/tokens.ts`, keys 1/2/3, same look and sizes as the Quiz answers.
- Keys: 1/2/3 pick, Left/Right move focus, Enter/Space pick the focused one, R replays the word, Esc goes to `/games`. Visible focus ring.
- Sounds: `ohOh` on a wrong pick, `yay` on a right pick (custom `hooray_path`/`ohoh_path` from `settings` as in Quiz, fetch errors ignored). Word voice: `sayWord` (recording, else `speakKid`). Nothing plays before "tap to enter".
- Wrong-picks log: localStorage key `hamy.listen.wrong`, entries `{id, word, count}`; cleared when a round starts, on play again and when the page is left.
- Game list colors: lavender, border `#C9BFE4`, title and icon ring `#7B6BAE`, icon circle `#F0ECF8` (final values confirmed by the PO from screenshots in Task 1).
- Name "Listen & Pick" (English). No hard-coded Vietnamese or other child text. No timers or penalties. Honor `prefers-reduced-motion` (no bounce or slide, fade only). Fonts as the other child pages.
- Schema changes: none. Never the service role key in the frontend.
- Checks before every commit: `npm run typecheck`, `npm run lint`, `npm test`; `npm run build` at the end of each task that adds or changes a page.
- **Branches.** Integration branch: `claude/phase2/listen-pick` (cut from `develop`, already holds the spec and this plan). Each task works on `claude/phase2/lp-t<N>-<topic>` cut from the integration branch and goes in by a PR whose base is the integration branch. Claude may merge those PRs itself once the gate is green. Nothing is pushed to `develop` or `main`; the PO decides after playing it whether the integration branch is merged into `develop`.
- **Gate before every merge into the integration branch:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run e2e` (set `PW_CHROMIUM_PATH` on the cloud image) all pass, and a fresh reviewer has checked the task against its spec lines. The controller also takes 1920x1080 screenshots of any new screen and checks them (no overlap, nothing clipped).
- **E2E rules:** specs live in `e2e/`, run against `next start` and the stand-in Supabase, and each starts from `reset(...)` (`e2e/support/fixtures.ts`). Console errors fail a test, as in `e2e/memory-play.spec.ts`.

## Review Focus
- Two cards with the same word (the admin only gets a warning): a question never shows both, so the child never faces two right answers; fewer than 3 distinct words counts as an empty pool.
- Double-click, or keys 1/2/3 hit quickly, during the hooray pause: one advance, one spoken word, no skipped question.
- Exactly 3 cards, and 4 to 9 cards: shorter round, each question still has three distinct pictures, finish screen works.
- localStorage blocked, throwing, or holding junk (not JSON, wrong shape, negative or fractional counts): the game still works and the junk is ignored and replaced.
- Leaving mid-question, during the hooray or the voice (Back, Esc, route change): timers and speech stop, the log is cleared, nothing is said on the next screen; missing picture shows a placeholder, no English voice leaves the game playable.

---

### Task 1: Game list entry (G1)

**Files:**
- Modify: `lib/games/registry.ts`, `components/games/GameArt.tsx`, `app/games/page.tsx` (TITLE, BORDER and the icon condition), `tests/registry.test.ts`, `tests/GamesPage.test.tsx`, `e2e/games.spec.ts`
- Create: none

**Interfaces:**
- Produces: `Game['id']` becomes `'quiz' | 'memory' | 'listen' | 'spot'`; `GAMES` order is quiz, memory, listen, spot; `{ id: 'listen', href: '/games/listen', ready: true }`; `LISTEN_PURPLE = '#7B6BAE'` exported from `components/games/GameArt.tsx`; `GameArt` and `GameIcon` accept `id: 'listen'`.

- [ ] **Step 1: Failing tests.** `tests/registry.test.ts`: order is `['quiz','memory','listen','spot']`, readiness is `{quiz:true, memory:true, listen:true, spot:false}`, `href.listen === '/games/listen'`. `tests/GamesPage.test.tsx`: the "Play Listen & Pick" frame has border `#C9BFE4` (rgb(201, 191, 228)) and its title text "Listen & Pick" has color `#7B6BAE` (rgb(123, 107, 174)), differing from Quiz, Memory and Spot; the listen icon (`[data-game-icon="listen"]`) is a decorative `aria-hidden` 130 px element at the same left/top as the Quiz icon, contains a circle with stroke `#7B6BAE` and fill `#F0ECF8`; update the existing "only those two have an icon" assertions to three.
- [ ] **Step 2: Run** `npx vitest run tests/registry.test.ts tests/GamesPage.test.tsx`; expect FAIL.
- [ ] **Step 3: Implement.** Add the registry entry before `spot`. In `GameArt` draw the listen card: a large speaker with sound waves above three small picture cards in the Quiz colors (rose, sky, butter), title "Listen & Pick" in `LISTEN_PURPLE`, keeping the same vertical rhythm as the Memory art (picture, 110 px spacer for the icon, title). In `GameIcon` add a speaker-with-waves icon in a circle (fill `#F0ECF8`, stroke `LISTEN_PURPLE`, width 2, same 110 px / 24-unit viewBox). In the page add `listen` to `TITLE` and `BORDER`, show the icon for it, and let Enter/Space/click open its `href` like the others.
- [ ] **Step 4: Run** the two tests and `npm test`; expect PASS. `npm run build`.
- [ ] **Step 5: E2E** in `e2e/games.spec.ts`: Listen & Pick is listed as playable (no "coming" ribbon); from the first game, ArrowRight twice reaches it and Enter opens `/games/listen` (the route may still 404 until Task 5; assert the URL only).
- [ ] **Step 6: Visual check (controller).** Screenshots of `/games` at 1920x1080 on the Listen & Pick card; the PO confirms the lavender values before this task merges.
- [ ] **Step 7: Commit** `feat(games): Listen & Pick card in the game list (G1)`.

### Task 2: Round building (L2, pure)

**Files:**
- Create: `lib/listen/rounds.ts`
- Test: `tests/listenRounds.test.ts`

**Interfaces:**
- Consumes: `MemoryCard` from `lib/memory/types.ts`.
- Produces: `ROUND_SIZE = 10`; `type Question = { answer: MemoryCard; options: [MemoryCard, MemoryCard, MemoryCard]; answerIndex: 0 | 1 | 2 }`; `buildRounds(cards: readonly MemoryCard[], rng?: () => number, max?: number): Question[] | null` (`rng` defaults to `Math.random`, `max` to `ROUND_SIZE`). Returns `null` when fewer than 3 usable cards.

- [ ] **Step 1: Failing tests** (`rng` is a seeded function in the tests):
  - 31 cards give exactly 10 questions; `answer` ids are all different; each `options` has 3 different card ids and different normalized words; `options[answerIndex]` is `answer`; the other two are never the answer.
  - 7 active cards give 7 questions; exactly 3 cards give 3 questions whose options are all three cards; 2 cards, 0 cards and 5 cards that share only 2 distinct words give `null`.
  - Inactive cards are ignored (`active: false`); two cards with the same word in different case/spacing ("Apple", " apple ") count as one word (the first one is kept) and never appear in one question.
  - Over 200 runs with different seeds `answerIndex` takes all of 0, 1, 2; the input array is not mutated; `max` below the pool size limits the questions.
- [ ] **Step 2: Run** `npx vitest run tests/listenRounds.test.ts`; expect FAIL.
- [ ] **Step 3: Implement** in `lib/listen/rounds.ts`: filter active, dedupe by `word.trim().toLowerCase()`, return `null` below 3; Fisher-Yates shuffle with `rng` for the answers (take `min(max, n)`), per question shuffle the remaining cards and take two, then place the answer at a random index.
- [ ] **Step 4: Run** the test; expect PASS.
- [ ] **Step 5: Commit** `feat(listen): round building (L2)`.

### Task 3: Wrong-picks log (L7, pure)

**Files:**
- Create: `lib/listen/wrongLog.ts`
- Test: `tests/listenWrongLog.test.ts`

**Interfaces:**
- Produces: `WRONG_KEY = 'hamy.listen.wrong'`; `type WrongEntry = { id: string; word: string; count: number }`; `recordWrong(card: { id: string; word: string }): void`; `readWrong(): WrongEntry[]` (in first-wrong order); `clearWrong(): void`; `totalWrong(entries: readonly WrongEntry[]): number`. None of them throws.

- [ ] **Step 1: Failing tests** (jsdom `localStorage`):
  - `recordWrong` twice for card A and once for B gives `[{A, count 2}, {B, count 1}]` and `totalWrong` 3; the data is stored under `hamy.listen.wrong`; `clearWrong` empties both the storage and the result.
  - Junk in the key (`"not json"`, `"{}"`, `"[1,2]"`, entries with `count: -1`, `1.5`, a missing `id`) reads as `[]`, and the next `recordWrong` replaces it with a valid list.
  - With `localStorage.getItem`/`setItem` throwing (spy), `recordWrong` does not throw and `readWrong` still returns the entries recorded in this page session (memory copy); `clearWrong` clears that copy too.
- [ ] **Step 2: Run** `npx vitest run tests/listenWrongLog.test.ts`; expect FAIL.
- [ ] **Step 3: Implement.** A module-level memory copy is the fallback: every write updates the copy, then tries storage inside try/catch; `readWrong` prefers a valid stored list, else the copy. Validate shape strictly (array of `{id: string, word: string, count: positive integer}`).
- [ ] **Step 4: Run** the test; expect PASS.
- [ ] **Step 5: Commit** `feat(listen): wrong-picks log in localStorage (L7)`.

### Task 4: Question view (L1, L3 button, L8, L9, L10 picture)

**Files:**
- Create: `components/listen/ListenQuestion.tsx`, `components/ListenHelp.tsx`
- Modify: `app/globals.css` (only classes this component needs, namespaced `hm-ls-`)
- Test: `tests/ListenQuestion.test.tsx`, `tests/ListenHelp.test.tsx`

**Interfaces:**
- Consumes: `Question` (Task 2), `SLOT_COLORS` (`lib/tokens.ts`), `mediaUrl` (`lib/media.ts`), `GameHelp` shell (`components/GameHelp.tsx`).
- Produces: `ListenQuestion({ question, wrong, locked, speaking, onPick, onReplay }: { question: Question; wrong: ReadonlySet<number>; locked: boolean; speaking: boolean; onPick: (i: 0 | 1 | 2) => void; onReplay: () => void })` rendering a centered big speaker button (`aria-label="Hear the word again"`, `data-replay`) above a row of three answer buttons (`data-answer`, `aria-label="Answer N"`, `data-card-id`, `data-wrong`), and `ListenHelp({ onClose, playHref }: { onClose: () => void; playHref?: string | null })`.

- [ ] **Step 1: Failing tests.**
  - `ListenQuestion`: renders three `[data-answer]` with the numbers 1, 2, 3 in the Quiz colors; none shows the card's word (no text equals any word); a click calls `onPick` with its index; a button in `wrong` has `data-wrong="true"`, `aria-disabled="true"`, reduced opacity, stays focusable, and clicking it does not call `onPick`; with `locked` no click calls `onPick`; the speaker click calls `onReplay`; a missing picture (`onError` on the img) shows a plain placeholder block and the button still works.
  - `ListenHelp`: has a dialog named "How to play Listen & Pick", 3 slides, the last button "Play Listen & Pick" only closes it when `playHref` is `null`; Esc closes it.
- [ ] **Step 2: Run** `npx vitest run tests/ListenQuestion.test.tsx tests/ListenHelp.test.tsx`; expect FAIL.
- [ ] **Step 3: Implement `ListenQuestion`.** Copy the Quiz answer button look (see `app/games/quiz/[setId]/page.tsx`: 14 px ring in the slot color, shadow, number badge) with the picture filling the button; hover/focus lift as `.hm-ans`; a wrong button is dimmed and does not lift; `speaking` makes the speaker pulse softly (a calm scale/opacity loop, none under `prefers-reduced-motion`). Picture from `mediaUrl(card.image_path)`. Implement `ListenHelp` on `GameHelp` with three steps drawn like `MemoryHelp`: hear the word (speaker), tap the matching picture, hooray and the next one.
- [ ] **Step 4: Run** the two tests and `npm test`; expect PASS.
- [ ] **Step 5: Visual check (controller).** Render the component with three seed pictures in a throwaway page or Playwright, screenshot at 1920x1080; PO decides at this point whether the optional row of 10 progress dots (spec 5.1) is added; if yes it is a decoration inside `ListenQuestion` fed by new props `index` and `total`, with its own test.
- [ ] **Step 6: Commit** `feat(listen): question view and how-to-play popup (L1, L3, L8-L10)`.

### Task 5: Play page (L1-L5, L8, L10)

**Files:**
- Create: `app/games/listen/page.tsx`
- Test: `tests/ListenPlay.test.tsx`, `e2e/listen-play.spec.ts`

**Interfaces:**
- Consumes: `fetchActiveCards`, `sayWord`, `stopWord` (`lib/memory/cards.ts`), `preloadImages` (`lib/memory/preload.ts`), `buildRounds`, `Question` (Task 2), `recordWrong`, `clearWrong` (Task 3), `ListenQuestion`, `ListenHelp` (Task 4), `ohOh`, `yay` (`lib/sfx.ts`), `handleChoiceKey` (`lib/keynav.ts`), `Stage`, `Hills`, `BackButton`, `MusicButton`.
- Produces: page default export; exported constants `SAY_AFTER_SHOW_MS = 600`, `SAY_AFTER_WRONG_MS = 700`, `HOORAY_CAP_MS = 1800`, `NEXT_PAUSE_MS = 400`, `FINISH_DELAY_MS = 1000`, `STEP_CAP_MS = 4000`; the page marks its root `data-listen-play`, the current question `data-question-index`, the right card `data-answer-id`; on completion it calls `onFinish` state (rendered by Task 6) and sets `data-done="true"` on the root.

- [ ] **Step 1: Failing tests** (mock `lib/memory/cards`, `lib/sfx`, the Supabase client; fake timers):
  - Loading 31 cards shows question 1 after the preload; `sayWord` is called with the answer card once, `SAY_AFTER_SHOW_MS` after it appears; the speaker button and key R say it again.
  - A wrong pick (click or key) calls `ohOh` once, marks that button wrong, calls `recordWrong` with the answer card, says the word again after `SAY_AFTER_WRONG_MS`, and the question stays; picking the same wrong button again does nothing; the other wrong one is also recorded.
  - A right pick calls `yay` once, says the word once after the hooray (at most `HOORAY_CAP_MS`), then moves to question 2 after the word ends plus `NEXT_PAUSE_MS` (or `STEP_CAP_MS` at the latest); picks during that pause are ignored (a second click and keys 1/2/3 cause one advance and one `yay`).
  - Keys: 1/2/3 pick, ArrowLeft/ArrowRight move focus among answers, Esc navigates to `/games`; while the help popup is open none of these act and the popup's Esc closes only the popup; the first answer is focused when a question appears.
  - Empty states: fewer than 3 usable cards, a load failure, and two cards with the same word only each show `role="status"` named "New cards are coming soon" and no answers.
  - 5 usable cards give 5 questions then `data-done="true"`; unmounting cancels timers and calls `stopWord`, `window.speechSynthesis.cancel` and `clearWrong`; starting a round calls `clearWrong` first.
  - Reduced motion: the root gets class `hm-reduced` when `prefers-reduced-motion` matches.
- [ ] **Step 2: Run** `npx vitest run tests/ListenPlay.test.tsx`; expect FAIL.
- [ ] **Step 3: Implement the page** following the structure of `app/games/memory/[level]/page.tsx` (refs for timers with a `later` helper, an `alive` ref, a sequence counter so only the newest word's end counts, `preloadImages` of the first questions' pictures before the first question). "? Listen & Pick" badge top right like the Memory one (same size and shape, lavender ring) opens `ListenHelp` with `playHref={null}`. Round state: `questions`, `index`, `wrong: Set<number>` for the current question, `locked` while a right pick is resolving. Fetch `hooray_path, ohoh_path` from `settings` once; ignore errors.
- [ ] **Step 4: Run** the test and `npm test`; expect PASS. `npm run build`.
- [ ] **Step 5: E2E** `e2e/listen-play.spec.ts` with `reset({ memory_cards: makeCards(12) })`: a full 10-question round by mouse (read `data-answer-id`, click the button whose `data-card-id` matches) reaching `data-done="true"`; a round by keys 1/2/3 (compute the right number from the DOM); a wrong pick marks the button `data-wrong="true"`, leaves the question index unchanged and the right pick then advances it; Esc returns to `/games`; `reset({ memory_cards: makeCards(2) })` shows the friendly screen; `makeCards(5)` gives a 5-question round. No console errors.
- [ ] **Step 6: Visual check (controller).** Screenshots of a question, a dimmed wrong pick, the empty screen and the help popup at 1920x1080.
- [ ] **Step 7: Commit** `feat(listen): play page (L1-L5, L8, L10)`.

### Task 6: Finish screen and wrong-picks list (L6, L7)

**Files:**
- Create: `components/listen/ListenDone.tsx`
- Modify: `app/games/listen/page.tsx` (render it after the last question, fetch `child_name, complete_path` like the Memory page, wire play again)
- Test: `tests/ListenDone.test.tsx`, extend `tests/ListenPlay.test.tsx`, `e2e/listen-play.spec.ts`

**Interfaces:**
- Consumes: `CelebrationScene`, `WrongEntry`, `readWrong`, `totalWrong`, `clearWrong` (Task 3), `sayWord`, `applause`, `playFile`, `speakKid`, `handleChoiceKey`, `mediaUrl`.
- Produces: `ListenDone({ wrong, cards, childName, completeUrl, onAgain, gamesHref }: { wrong: readonly WrongEntry[]; cards: ReadonlyMap<string, MemoryCard>; childName: string; completeUrl: string | null; onAgain: () => void; gamesHref: string })` with root `data-listen-done`, the count in `<strong data-wrong-total>` inside "Wrong N times", the row `data-wrong-list` with one `data-wrong-item` per entry, and buttons `data-done-btn` "Play again" and "Back to games" (a link).

- [ ] **Step 1: Failing tests.**
  - `ListenDone`: greeting "You did it, Hà My!" (child name from props; without a name "You did it!"), same praise sound as `MemoryDone` (custom file when `completeUrl`, else applause and speech, once); "Wrong 3 times" with 3 in `data-wrong-total` for entries counts 2 and 1; the list shows each word and "x2" only when the count is above 1, each item is a button whose click calls `sayWord` for that card (picture from `cards`, a plain placeholder when the card is missing); with no entries "Wrong 0 times" shows and `data-wrong-list` is absent; Play again calls `onAgain`; Esc goes to `gamesHref`; arrows move between the two buttons.
  - Page: after the last right pick plus `FINISH_DELAY_MS` the finish shows, built from `readWrong()` and the loaded cards; Play again clears the log (`clearWrong`), draws a new round and shows question 1; a reload-free run where storage throws still shows the correct count and list (memory fallback of Task 3).
- [ ] **Step 2: Run** the two test files; expect FAIL.
- [ ] **Step 3: Implement `ListenDone`** by following `components/memory/MemoryDone.tsx` (same buttons, sizes and focus handling), the count line styled like its "Total N times" line, and the list as a compact centered row of round pictures (about 96 px) with the word and count underneath in small text. Place it so it overlaps neither the two characters nor the buttons with up to 10 entries at 1920x1080 (wrap to two rows if needed). In the page, keep a `Map` of the round's cards for the list.
- [ ] **Step 4: Run** the tests and `npm test`; expect PASS. `npm run build`.
- [ ] **Step 5: E2E** (add to `e2e/listen-play.spec.ts`): a round with two wrong picks on one question and one on another ends with "Wrong 3 times" and two list items with "x2" on the first; a perfect round shows "Wrong 0 times" and no list; Play again starts a new round and the next finish starts from 0; leaving to `/games` and coming back also starts from 0 (read `localStorage['hamy.listen.wrong']` is null after leaving).
- [ ] **Step 6: Visual check (controller).** Screenshots of the finish screen with 0, 2 and 10 entries at 1920x1080.
- [ ] **Step 7: Commit** `feat(listen): finish screen with wrong-picks list (L6, L7)`.

### Task 7: Docs and tickets

**Files:**
- Modify: `spec.md` (IDs G1 extended and L1-L10 in a new subsection next to the Memory Match ones; header status line), `plan.md` (add the Listen & Pick tickets and criteria), `CLAUDE.md` (IDs list `G1, M1-M10, L1-L10`, Phase 2 integration branch name; keep it under one page), `docs/git-workflow.md` (integration branch example if it names `claude/phase2/memory-match`), `docs/superpowers/specs/2026-10-30-listen-pick-design.md` (status line: implemented)
- Test: `tests/registry.test.ts` already covers the registry; run the full gate.

- [ ] **Step 1: Update the docs** as listed; every L-ID in `spec.md` matches the spec's table one to one.
- [ ] **Step 2: Gate.** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run e2e` all pass.
- [ ] **Step 3: Commit** `docs: Listen & Pick requirements and workflow (G1, L1-L10)`.
- [ ] **Step 4: Controller final pass.** Whole-branch review against the spec; PO plays the integration build before deciding to merge into `develop`.

---

## Self-review notes
- Spec coverage: L1 Tasks 1, 5; L2 Task 2; L3 Tasks 4, 5; L4 and L5 Task 5; L6 Task 6; L7 Tasks 3, 5, 6; L8 Tasks 4, 5; L9 Tasks 4, 5; L10 Tasks 2, 4, 5; G1 Task 1; section 9 test list is spread over the tasks above.
- One spec line changes with this plan: L7 said the log "survives a reload mid-round", but a reload starts a new random round and the round start clears the log, so nothing could survive. The spec is corrected: the log is written at every wrong pick (so a crash loses nothing) and cleared when a round starts.
- One small improvement over the spec: if localStorage is blocked, the finish screen still shows the correct count and list (memory fallback in `wrongLog`) instead of an empty list.
- Types are consistent across tasks: `Question`, `buildRounds`, `WrongEntry`, `recordWrong`/`readWrong`/`clearWrong`/`totalWrong`, `ListenQuestion` props, `ListenDone` props.
