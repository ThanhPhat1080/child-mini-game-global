> Note: levels were extended to 12/16/20/24/30 cards later (see the spec); this plan describes the original 12/24/30.

# Memory Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a game registry and the "Memory Match" game (find pairs, hear the English word) with a card-pool admin, JSON import, levels of 12/24/30 cards and a flip count at the end.

**Architecture:** Plain React + CSS like Quiz. Pure units hold the logic (`lib/memory/deck.ts`, `lib/memory/rules.ts`, `lib/memory/import.ts`); pages only render and call them. One new table `memory_cards` in the existing Supabase project and bucket `media`. Admin saving reuses the pending-media (upload on Save) code of the quiz editor.

**Tech Stack:** Next.js 16, React, TypeScript, Supabase, Vitest + Testing Library (jsdom), Playwright (E2E against a stand-in Supabase). No Phaser (ADR-030).

**Spec:** `docs/superpowers/specs/2026-10-29-memory-match-design.md`

## Global Constraints
- Levels: 12, 24, 30 cards = 6, 12, 15 pairs; a level needs that many ACTIVE cards.
- Timings: flip about 0.5 s; mismatch cards stay about 1.2 s then flip back; completion screen about 1 s after the last pair.
- Face-down: light-pink background with one small white/pale-yellow flower (inline SVG), same on every card. Face-up: picture only, never the written word.
- Flip count: only face-down to face-up counts; shown only on the completion screen; never saved.
- Sounds are synthesized in `lib/sfx.ts` (no audio files): soft "tick" for each flip and flip-back, "ting ting" chime for a match. Word voice: recorded file if `audio_path`, else `speakKid`.
- Admin limits: word 1-40 chars; image max 2 MB (PNG/JPG/WebP/SVG); import file max 1 MB and 100 cards; import image = blank, `https://` link or raw SVG; import audio = blank or `https://` link.
- English only. No Vietnamese or other hard-coded child text. Honor `prefers-reduced-motion`. Visible focus ring.
- Schema changes only through a new file in `supabase/migrations/`. Never the service role key in the frontend.
- Checks before every commit: `npm run typecheck`, `npm run lint`, `npm test`; `npm run build` at the end of each task that adds a page.
- **Branches (PO decision 2026-10-29).** Integration branch: `claude/phase2/memory-match`, created from the latest `develop` plus the spec and plan commits. Each task works on its own branch `claude/phase2/mm-t<N>-<topic>` cut from the integration branch and goes in by a PR whose base is the integration branch. Claude may merge those PRs itself once the gate below is green. Nothing is pushed to `develop` or `main`; the PO decides later, after playing it, whether `claude/phase2/memory-match` is merged into `develop`.
- **Gate before every merge into the integration branch:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run e2e` (Playwright) all pass, and a fresh reviewer has checked the task against its spec lines.
- **E2E rules:** Playwright specs live in `e2e/`, run in Chromium against `next start` and the stand-in Supabase from Task 0, never against the real project. A spec must not depend on another spec's data (each starts from `POST /__reset`).

## Review Focus
- Same tile clicked twice quickly (double-click) must not count as a pair with itself and must not add a second flip.
- A third click during the mismatch pause is ignored; leaving the page mid-pause leaves no timer or speech running.
- The pool shrinks between the level screen and the play screen (cards deactivated): show the friendly screen, not a crash or a short deck.
- The recorded audio file fails to load, or the device has no English voice: the card still matches, only the voice is missing.
- Import: wrong types (`"active": "yes"`, word as a number), words with surrounding spaces, the same SVG on several cards (one pending file), more than 100 cards, and a card with a blank image (kept as incomplete, blocks Save).

---

### Task 0: Playwright harness and stand-in Supabase

**Files:**
- Create: `playwright.config.ts`, `e2e/support/standin-supabase.mjs`, `e2e/support/fixtures.ts`, `e2e/smoke.spec.ts`, `.github/workflows/e2e.yml`
- Modify: `package.json` (devDependency `@playwright/test`; `e2e` script stays `playwright test`), `package-lock.json` (run `npm install` so `npm ci` still works), `.gitignore` (`test-results/`, `playwright-report/`), `CLAUDE.md` (the E2E line), `docs/git-workflow.md` (integration-branch note)

**Interfaces:**
- Produces: a Node HTTP server on port 54321 that fakes the parts of Supabase the app uses, in memory: `GET/POST/PATCH/DELETE /rest/v1/<table>` for `memory_cards`, `settings`, `quiz_sets`, `questions`, `answers` (honoring `eq.`/`in.` filters and `order`), `POST /rest/v1/rpc/is_admin`, `POST /auth/v1/token?grant_type=password` (accepts `admin@test.local` / `secret`, anything else 400), `GET /auth/v1/user`, `POST /storage/v1/object/media/<path>`, `DELETE /storage/v1/object/media`, `GET /storage/v1/object/public/media/<path>`, and `POST /__reset` with a JSON body that replaces the whole state (default: 18 sample cards, settings row, no quiz sets). Also `GET /__state` for assertions.
- Produces (`fixtures.ts`): `reset(state?: Partial<StandinState>): Promise<void>`, `getState(): Promise<StandinState>`, `makeCards(n: number, active?: boolean): MemoryCardRow[]` (words `word1..wordN`, images `seed/apple.svg`), `signInAsAdmin(page): Promise<void>`.
- `playwright.config.ts`: Chromium only; `webServer` runs the stand-in and `npm run build && npm start` with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and a dummy anon key; `workers: 1`; traces on first retry; when env `PW_CHROMIUM_PATH` is set it is used as `executablePath` (this cloud image has Chromium at `/opt/pw-browsers/chromium`; do not run `playwright install` there).

- [ ] **Step 1: Failing test** `e2e/smoke.spec.ts`: after `reset()`, open `/games`; the page has the Quiz card; open `/admin/cards` unauthenticated and expect a redirect to `/admin/sign-in`; `signInAsAdmin` then `/admin/sets` loads without redirect.
- [ ] **Step 2: Run** `npm run e2e`; expect FAIL (config and stand-in missing).
- [ ] **Step 3: Implement** the config, stand-in and fixtures. The sign-in goes through the real login form; the stand-in returns a Supabase-shaped session so `@supabase/ssr` stores its cookie and `middleware.ts` passes (`/auth/v1/user` returns the user for the issued token, `is_admin` returns true).
- [ ] **Step 4: Add `.github/workflows/e2e.yml`**: on `pull_request` (any base branch), Node 24, `npm ci`, `npx playwright install --with-deps chromium`, typecheck, `npm test`, `npm run e2e`; upload `playwright-report/` on failure. It needs no secrets.
- [ ] **Step 5: Run** `npm run e2e`, `npm test`, `npm run build`; expect PASS. Update `CLAUDE.md` (E2E is set up: `npm run e2e`) and the integration-branch note in `docs/git-workflow.md`.
- [ ] **Step 6: Commit** `test(e2e): Playwright harness with a stand-in Supabase`.

### Task 1: Game registry (G1)

**Files:**
- Create: `lib/games/registry.ts`, `components/games/GameArt.tsx`
- Modify: `app/games/page.tsx` (replace `N = 3` and the hand-written cards)
- Test: `tests/registry.test.ts`

**Interfaces:**
- Produces: `type Game = { id: 'quiz' | 'memory' | 'spot'; href: string; ready: boolean }`, `GAMES: readonly Game[]` (order: quiz, memory, spot), `GameArt({ id }: { id: Game['id'] })`.

- [ ] **Step 1: Failing tests** in `tests/registry.test.ts`: ids are unique; order is quiz, memory, spot; `quiz` and `memory` are `ready`, `spot` is not; `href` of quiz is `/games/quiz` and of memory `/games/memory`.
- [ ] **Step 2: Run** `npx vitest run tests/registry.test.ts`; expect FAIL (module missing).
- [ ] **Step 3: Implement** `lib/games/registry.ts` as above. Move the three card drawings out of `app/games/page.tsx` into `GameArt` (Quiz and Spot art as they are; Memory art: a few small pastel cards, one showing the flower back). In the page use `GAMES.length` for the carousel size and open `GAMES[idx].href` on Enter/Space/click only when `ready`; a not-ready game shows the existing "Coming in Phase 2" ribbon.
- [ ] **Step 4: Run** the new test and `npm test`; expect PASS. Run `npm run build`.
- [ ] **Step 5: E2E** `e2e/games.spec.ts`: `/games` lists Quiz and Memory Match as playable and Spot the Differences as "coming"; ArrowRight moves to Memory Match and Enter opens `/games/memory`; Spot cannot be opened.
- [ ] **Step 6: Commit** `feat(games): game registry drives the game list (G1)`.

### Task 2: Table, policies and seed cards (A11 storage)

**Files:**
- Create: `supabase/migrations/20261029100000_memory_cards.sql`, new sample drawings `public/seed/*.svg` (enough so at least 15 distinct words exist; 11 already exist: apple, banana, berry, bird, cat, circle, duck, fish, grapes, heart, square — add e.g. ball, sun, star, flower, car, moon in the same simple style)
- Test: `tests/memorySeed.test.ts`

**Interfaces:**
- Produces: table `public.memory_cards(id uuid pk default gen_random_uuid(), word text not null check (char_length(btrim(word)) between 1 and 40), image_path text not null, audio_path text, active boolean not null default true, created_at timestamptz not null default now())`.

- [ ] **Step 1: Failing test** `tests/memorySeed.test.ts`: read the migration text; assert it creates `memory_cards`, enables RLS, has a select policy for `anon` that requires `active`, an admin-all policy using `public.is_admin()`, and at least 15 seed inserts whose `seed/<name>.svg` files all exist in `public/seed/`.
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Write the migration** following the pattern of `20261026000000_init_schema.sql` (policies `memory_cards_read_active` for anon + authenticated where `active`, and `memory_cards_admin_all` for authenticated with `is_admin()`), plus the seed rows with `image_path = 'seed/<name>.svg'`, no audio. Add the missing SVG files.
- [ ] **Step 4: Run** the test; expect PASS.
- [ ] **Step 5: Apply to Supabase only after PO OK** (project `uhpsqaqejizcyzwhwnsl`). Verify read-only: as anon only active rows are readable; an anon insert is denied.
- [ ] **Step 6: Commit** `feat(db): memory_cards table, policies and sample cards (A11)`.

### Task 3: Deck drawing and level availability (M1, pure)

**Files:**
- Create: `lib/memory/types.ts`, `lib/memory/deck.ts`
- Test: `tests/memoryDeck.test.ts`

**Interfaces:**
- Produces (`types.ts`): `type MemoryCard = { id: string; word: string; image_path: string; audio_path: string | null; active: boolean }`.
- Produces (`deck.ts`): `LEVELS = [12, 24, 30] as const`; `type Level = (typeof LEVELS)[number]`; `pairsOf(level: Level): number`; `levelsAvailable(activeCount: number): Record<Level, boolean>`; `type DeckTile = { key: string; card: MemoryCard }`; `drawDeck(cards: readonly MemoryCard[], level: Level, rng?: () => number): DeckTile[]` (throws `Error('not enough cards')`); `parseLevel(v: string): Level | null`.

- [ ] **Step 1: Failing tests:** `levelsAvailable(5)` all false; `(6)` only 12; `(12)` 12 and 24; `(15)` all three. `drawDeck` returns exactly `level` tiles; each chosen card appears exactly twice; keys are unique; with a fixed `rng` the result is deterministic; with 6 cards and level 12 all 6 cards are used; two different `rng` streams give different orders; inactive cards are never drawn; 5 cards and level 12 throws. `parseLevel('24')` is 24, `'25'`/`'abc'`/`''` are null.
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement.** Filter `active`, shuffle with Fisher-Yates using `rng`, take `pairsOf(level)`, double, shuffle again; key = `${card.id}:${0|1}`.
- [ ] **Step 4: Run**, expect PASS.
- [ ] **Step 5: Commit** `feat(memory): deck drawing and level availability (M1)`.

### Task 4: Game rules state machine (M3-M7, pure)

**Files:**
- Create: `lib/memory/rules.ts`
- Test: `tests/memoryRules.test.ts`

**Interfaces:**
- Consumes: `DeckTile` (Task 3).
- Produces: `MISMATCH_MS = 1200`, `WIN_DELAY_MS = 1000`, `FLIP_MS = 500`; `type GameState = { tiles: DeckTile[]; up: number[]; matched: ReadonlySet<string>; flips: number; pending: boolean }` (`up` = face-up unmatched tile indexes, `matched` = card ids, `pending` = a mismatch is waiting to be resolved); `type GameEvent = { type: 'flipped'; index: number } | { type: 'matched'; cardId: string; indexes: [number, number] } | { type: 'mismatch'; indexes: [number, number] } | { type: 'replay'; cardId: string } | { type: 'won'; flips: number } | { type: 'ignored' }`; `startGame(tiles: DeckTile[]): GameState`; `flip(s: GameState, index: number): { state: GameState; events: GameEvent[] }`; `resolveMismatch(s: GameState): { state: GameState; events: GameEvent[] }` (turns the pending pair back: `up` empties and `pending` becomes false; `events` is empty because the UI reads `state.up`).

- [ ] **Step 1: Failing tests** (build tiles by hand): first flip → `flipped`, `flips` 1; second flip of a different card with the same card id → `matched` (both indexes), those stay face-up, `up` empty, card id in `matched`; second flip with another card id → `mismatch`, `pending` true, `flips` 2; any flip while `pending` → `ignored`, state unchanged (third click); `resolveMismatch` clears `up` and `pending` and does not change `flips`; flipping an index already in `up` (double-click on the same tile) → `ignored` and `flips` unchanged; flipping a matched tile → `replay` with its card id and `flips` unchanged; the last matched pair adds a `won` event with the final `flips`; a full perfect game of 6 pairs ends with `flips === 12`; out-of-range index → `ignored`.
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement** as a pure reducer-style module (never mutate the input state).
- [ ] **Step 4: Run**, expect PASS.
- [ ] **Step 5: Commit** `feat(memory): pure flip/match rules and flip count (M3-M7)`.

### Task 5: Sounds and 2D keyboard (M3, M4, M8)

**Files:**
- Modify: `lib/sfx.ts` (add `flipTick`, `chime`), `lib/keynav.ts` (add `gridStep`)
- Test: `tests/memorySfx.test.ts`, extend `tests/keynav.test.ts`

**Interfaces:**
- Produces: `flipTick(): void` (one short quiet tone); `chime(): void` (two short high soft notes, "ting ting"); `gridStep(items: HTMLElement[], cols: number, e: { key: string; preventDefault(): void }): boolean` — ArrowLeft/Right move by 1, Up/Down by `cols`, stop at the edges, focus the first item when none is focused, return true when the key was used.

- [ ] **Step 1: Failing tests:** with a stubbed `AudioContext` (counts `createOscillator` and `start` calls) `flipTick()` starts exactly 1 oscillator and `chime()` starts 2; both do nothing (no throw) when `window.AudioContext` is missing. `gridStep` on 6 items with `cols = 3`: Down from item 1 focuses item 4; Up from item 1 stays; Right from item 6 stays; Left from item 4 focuses item 3; no focus yet + ArrowRight focuses item 1; other keys return false.
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement** using the existing `ac()`, `tone()` and `makeBus()` helpers in `lib/sfx.ts`; gains low (about 0.12).
- [ ] **Step 4: Run** all tests; expect PASS.
- [ ] **Step 5: Commit** `feat(memory): flip tick, chime and grid keyboard step (M3, M4, M8)`.

### Task 6: Card data access and word voice (M4, M6, M10)

**Files:**
- Create: `lib/memory/cards.ts`
- Test: `tests/memoryCards.test.ts`

**Interfaces:**
- Consumes: `MemoryCard`; `mediaUrl`, `playFile`, `speakKid`.
- Produces: `fetchActiveCards(): Promise<MemoryCard[]>` (reads `memory_cards` where `active`, throws `Error(message)` on failure); `sayWord(card: Pick<MemoryCard, 'word' | 'audio_path'>): void`.

- [ ] **Step 1: Failing tests** (mock the Supabase client and `@/lib/sfx`): `fetchActiveCards` returns the rows and queries only `active = true`; it throws when Supabase returns an error. `sayWord` with an `audio_path` plays that file URL and does not call `speakKid`; without one it calls `speakKid` with the word; when the recorded file errors (`play()` rejects) it falls back to `speakKid` once.
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement.** For the fallback play the file through an `Audio` element and call `speakKid` from its `error` event or a rejected `play()`.
- [ ] **Step 4: Run**, expect PASS.
- [ ] **Step 5: Commit** `feat(memory): load active cards and speak a card's word (M4, M6)`.

### Task 7: Level select screen (M1)

**Files:**
- Create: `app/games/memory/page.tsx`, `components/memory/LevelButton.tsx`
- Test: `tests/MemoryLevels.test.tsx`

**Interfaces:**
- Consumes: `fetchActiveCards`, `levelsAvailable`, `LEVELS`, and `handleChoiceKey` from `lib/keynav.ts` (the buttons form one row).
- Produces: route `/games/memory`; `LevelButton({ level, disabled, href })` renders a link (enabled) or a disabled dimmed button with `aria-label` `${level} cards`.

- [ ] **Step 1: Failing tests** (mock `fetchActiveCards`): 4 active cards → all three levels disabled; 6 → only 12 enabled; 15 → all enabled and each is a link to `/games/memory/12`, `/24`, `/30`; 0 cards or a fetch error → a friendly picture screen (role `status`, no `alert`) and no level buttons; the first enabled level is focused on arrival; Right/Left move focus; Enter on a link is native, Space clicks it; Esc goes to `/games` (`router.push`).
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement** with `Stage`, `Hills`, `BackButton`, `MusicButton`, mini card-grid art on each button (4x3, 6x4, 6x5 small rounded squares using the flower-back colors). No text on the buttons other than `aria-label`.
- [ ] **Step 4: Run** tests and `npm run build`; expect PASS.
- [ ] **Step 5: E2E** `e2e/memory-levels.spec.ts` with `makeCards(8)`: only the 12-card level is enabled; with `makeCards(15)` all three; with no cards the friendly screen shows; a keyboard-only path (Right, Enter) reaches `/games/memory/12`.
- [ ] **Step 6: Commit** `feat(memory): level select screen (M1)`.

### Task 8: Play screen (M2-M6, M8-M10)

**Files:**
- Create: `app/games/memory/[level]/page.tsx`, `components/memory/MemoryTile.tsx`, `components/memory/FlowerBack.tsx`
- Modify: `app/globals.css` (flip, bounce and sparkle classes; reduced-motion overrides)
- Test: `tests/MemoryPlay.test.tsx`

**Interfaces:**
- Consumes: `parseLevel`, `drawDeck`, `startGame`, `flip`, `resolveMismatch`, `MISMATCH_MS`, `fetchActiveCards`, `sayWord`, `flipTick`, `chime`, `gridStep`, `mediaUrl`.
- Produces: route `/games/memory/[level]`; `MemoryTile({ tile, faceUp, matched, onPress, label }: ...)` renders a real `<button>` with `data-tile` and `data-card-id` (the card id, for E2E); `FlowerBack()` the inline-SVG pink back.
- Grid columns: level 12 → 4 columns, 24 → 6, 30 → 6.

- [ ] **Step 1: Failing tests** (mock `fetchActiveCards`, `@/lib/sfx`, `sayWord`; fake timers): invalid level param → redirect to `/games/memory`; fewer cards than needed (Review Focus) → friendly screen, no grid; grid has `level` tile buttons; pressing a tile calls `flipTick` and shows its picture; a matching second press calls `chime` then `sayWord` with that card, once; a mismatching second press shows both for `MISMATCH_MS`, then both go back and `flipTick` is called again for the flip-back; a third press during the pause does nothing; double-pressing the same tile does not count and does not match with itself; pressing a matched tile calls `sayWord` again; no written word is rendered on any face-up tile; arrow keys move focus across the grid (Down moves by the column count), Enter/Space flip; Esc goes back; unmounting during the pause leaves no pending timers (`vi.getTimerCount() === 0`); a failing image shows the placeholder and the tile still works; with `prefers-reduced-motion` the root element carries the reduced-motion class.
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement.** Hold `GameState` in a ref plus a render counter; one `useEffect` loads cards, draws the deck once per mount and preloads its images; events from `flip` drive sounds and animation; `setTimeout(MISMATCH_MS)` calls `resolveMismatch`; clear timers and `speechSynthesis.cancel()` on unmount. Tile size from the column count so 30 cards fit 1920x1080 under the header. CSS flip 0.5 s; under `@media (prefers-reduced-motion: reduce)` swap faces with a fade.
- [ ] **Step 4: Run** tests and `npm run build`; expect PASS.
- [ ] **Step 5: E2E** `e2e/memory-play.spec.ts` (level 12, `makeCards(6)`, fixed tiles are identified by their `data-card-id` attribute): a matching pair stays face-up; a mismatching pair flips back after about 1.2 s; clicking a matched tile again does not change the page; arrow keys + Space finish the whole game using only the keyboard; with `reducedMotion: 'reduce'` the page still completes; no written word is visible on any face-up tile; the browser console shows no errors.
- [ ] **Step 6: Commit** `feat(memory): play screen with flip, match and replay (M2-M6, M8-M10)`.

### Task 9: Completion screen and flip count (M7)

**Files:**
- Create: `components/memory/MemoryDone.tsx`
- Modify: `app/games/memory/[level]/page.tsx` (show it after `WIN_DELAY_MS` on the `won` event)
- Test: `tests/MemoryDone.test.tsx`; extend `tests/MemoryPlay.test.tsx`

**Interfaces:**
- Consumes: `applause`, `speakKid`, `playFile`, settings (`child_name`, `complete_path`) as the Quiz done page does, `Confetti`.
- Produces: `MemoryDone({ flips, childName, completeUrl, onAgain, levelsHref }: ...)`.

- [ ] **Step 1: Failing tests:** shows "You did it, <name>!" (name omitted when empty), the flip count as a number next to a card icon (`aria-label` `${flips} flips`), exactly two picture buttons ("Play again" calls `onAgain`; "Choose level" links to `/games/memory`); with `completeUrl` it plays that file instead of the built-in applause and spoken praise; in the play page the completion screen appears `WIN_DELAY_MS` after the last pair, shows the real flip count, and "Play again" draws a new deck (different tiles, flips reset, no completion screen).
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement** reusing the girl image, denser `Confetti` and the Quiz done page's settings query.
- [ ] **Step 4: Run** tests and `npm run build`; expect PASS.
- [ ] **Step 5: E2E** extend `e2e/memory-play.spec.ts`: solving a 12-card game with no mistakes shows the completion screen with `12 flips`; one deliberate mismatch shows `14 flips`; "Play again" starts a new game at 0 flips; "Choose level" returns to `/games/memory`.
- [ ] **Step 6: Commit** `feat(memory): completion screen with flip count (M7)`.

### Task 10: Admin card pool data layer (A11)

**Files:**
- Create: `lib/memory/adminCards.ts`
- Modify: `lib/media.ts` (extract the upload-and-rollback loop of `commitPendingMedia` into `commitPendingMap`, keep `commitPendingMedia` behavior unchanged)
- Test: `tests/memoryAdminCards.test.ts`; existing `tests/pendingMedia.test.ts` must still pass

**Interfaces:**
- Produces (`media.ts`): `commitPendingMap(wanted: Map<string, string>): Promise<Map<string, string>>` (token → folder in, token → uploaded path out; deletes what was uploaded and rethrows on failure).
- Produces (`adminCards.ts`): `type ECard = { id: string; isNew: boolean; word: string; image: string | null; audio: string | null; active: boolean }`; `newCard(): ECard`; `isCardComplete(c: ECard): boolean` (trimmed word 1-40 chars and an image); `duplicateWords(cards: ECard[]): Set<string>` (lower-cased, trimmed); `cardMediaPaths(c: ECard): string[]` (bucket paths only); `loadCards(): Promise<ECard[]>`; `saveCards(saved: ECard[], draft: ECard[]): Promise<{ error: string | null; warning: string | null }>`.

- [ ] **Step 1: Failing tests:** `isCardComplete` true/false cases (blank word, word of 41 chars, no image, word with spaces only); `duplicateWords([{word:'Apple'},{word:' apple '}])` contains `apple`; `cardMediaPaths` ignores `seed/`, `pending:` and `https://` values; `saveCards` (mock Supabase and media): uploads pending files first, then upserts, then deletes only the files that the saved state used and the draft no longer uses (replaced, removed, deleted card); if an upload fails nothing is written and uploaded files are removed; if the database write fails no file is deleted; if only the file cleanup fails the result has `warning` and no `error`; deleted cards (in `saved`, not in `draft`) are deleted from the table.
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement.** Folders: `cards` for images, `card-voices` for audio. Reuse `pathsToDelete`, `removeMedia`, `uploadPending`.
- [ ] **Step 4: Run** the new tests and `npm test`; expect PASS.
- [ ] **Step 5: Commit** `feat(admin): card pool load/save with upload-on-Save (A11)`.

### Task 11: Admin "Cards" page (A11, A13)

**Files:**
- Create: `app/admin/(panel)/cards/page.tsx`
- Modify: `components/AdminNav.tsx` (add "Cards" link)
- Test: `tests/AdminCards.test.tsx`

**Interfaces:**
- Consumes: `ECard`, `loadCards`, `saveCards`, `isCardComplete`, `duplicateWords`, `levelsAvailable`, `addPending`, `svgToPending`, `clearPending`, `mediaUrl`, `sayWord`, `ConfirmDialog`.
- Produces: route `/admin/cards`.

- [ ] **Step 1: Failing tests** (mock `loadCards`/`saveCards`): lists cards with picture, word and an on/off toggle; "Add card" appends an empty card; Save is disabled until every card is complete and enabled after; Save calls `saveCards(saved, draft)` and reloads; Revert restores the loaded cards; Delete asks for confirmation and Cancel keeps the card; picking a file shows a local preview and never calls upload (only `addPending`); an image over 2 MB shows an immediate message; two cards with the same word show a non-blocking warning; the "play" button calls `sayWord` for that card; the availability line reflects active cards ("6 / 12 / 15 active cards needed": 12 cards on shows the 12 and 24 levels as available, 30 as not).
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement** following `SetEditor.tsx` patterns (sticky header with Save/Revert, `useEffect(() => () => clearPending(), [])`), styles from `admin-ui.module.css`.
- [ ] **Step 4: Run** tests and `npm run build`; expect PASS.
- [ ] **Step 5: E2E** `e2e/admin-cards.spec.ts` (signed in as admin): add a card with a picked image and a word, Save, reload, the card persists (checked through `getState()`); picking an image uploads nothing until Save; Revert discards; toggling a card off lowers the available levels shown; Delete asks for confirmation and removes the row and its file from the stand-in storage only after Save.
- [ ] **Step 6: Commit** `feat(admin): Cards page with add/edit/delete/toggle (A11, A13)`.

### Task 12: JSON import for cards (A12)

**Files:**
- Create: `lib/memory/import.ts`, `components/admin/CardImportDialog.tsx`, `public/memory-cards-template.json`
- Modify: `lib/quizImport.ts` (export `readImage` and keep behavior), `app/admin/(panel)/cards/page.tsx` ("Quick import cards" button)
- Test: `tests/memoryImport.test.ts`, `tests/CardImportDialog.test.tsx`

**Interfaces:**
- Consumes: `readImage`, `isInlineSvg`, `svgToPending`, `ECard`, `newCard`.
- Produces: `CARD_IMPORT_MAX = 100`, `WORD_MAX = 40`, `parseCardImport(text: string): { cards: ECard[]; errors: string[] }`; `CardImportDialog({ onCancel, onImport }: { onCancel: () => void; onImport: (cards: ECard[]) => void })`.

- [ ] **Step 1: Failing tests:** valid file returns the cards (word trimmed, `active` default true, blank image/audio → null); errors name the card number for: invalid JSON, no `cards` list, empty list, more than 100 cards, missing or empty word, word over 40 chars, word not a string, `active` not a boolean, image that is not blank/`https://`/SVG, `http://` image, audio that is not blank or `https://`; any error means `cards` is empty; file over 1 MB is refused by the dialog before parsing; the shipped `public/memory-cards-template.json` parses with no errors; identical SVG on several cards becomes one pending token after import; dialog: shows a short guide and the template download link, Esc/Cancel close it, "N cards ready" then Import appends them as unsaved changes, nothing is added when there are errors.
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement** mirroring `parseQuizImport` and `ImportDialog` (same `SHOW_ERRORS` pattern). Template keys starting with `_` are ignored.
- [ ] **Step 4: Run** all tests and `npm run build`; expect PASS.
- [ ] **Step 5: E2E** extend `e2e/admin-cards.spec.ts`: import `public/memory-cards-template.json` through the dialog, Save, the cards exist in the stand-in; a file with one bad card imports nothing and lists the problem with its card number; then play a game on the imported cards from `/games/memory`.
- [ ] **Step 6: Commit** `feat(admin): quick import of cards from JSON (A12)`.

### Task 13: Docs, ADR and tickets

**Files:**
- Modify: `docs/decision.md` (add ADR-030), `spec.md` (add G1, M1-M10, A11-A13 rows pointing to the design spec), `plan.md` (section 5 → link this plan), `CLAUDE.md` (Phase 2 line: the spec and plan live in `docs/superpowers/`; keep the file under one page)

- [ ] **Step 1:** Write ADR-030 "Phase 2 games use HTML/CSS first; Phaser only as a last resort".
- [ ] **Step 2:** Update the three docs; run `grep -n "spec-phase2" CLAUDE.md plan.md` and replace the stale names with the real paths.
- [ ] **Step 3:** Run `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`; expect all pass.
- [ ] **Step 4: Commit** `docs: ADR-030 and Memory Match requirement IDs`.
- [ ] **Step 5 (PO decides):** create Trello cards for Tasks 1-12 in "To Do" (this writes to an external board; ask first).

---

## Self-review notes
- Spec coverage: E2E (PO request)→T0 and the E2E step of T1, T7-T9, T11, T12; G1→T1; A11 storage→T2; M1→T3,T7; M2,M3,M4,M5,M6,M8,M9,M10→T4,T5,T6,T8; M7 and flip count→T4,T9; A11→T10,T11; A12→T12; A13→T11; ADR-030→T13; sounds→T5.
- Names are consistent across tasks: `DeckTile`, `GameState`, `GameEvent`, `ECard`, `commitPendingMap`, `sayWord`, `fetchActiveCards`, `levelsAvailable`, `gridStep`.
- Manual PO check (not automatable): the feel of the flip, tick/chime sounds and the voice in a real browser; the PO plays `claude/phase2/memory-match` before deciding to merge it into `develop`. The migration (Task 2) is applied to the live project only after the PO's OK.
