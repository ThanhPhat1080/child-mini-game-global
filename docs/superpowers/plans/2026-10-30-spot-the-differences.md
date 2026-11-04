# Spot the Differences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Spot the Differences" game (tap the differences between two pictures) and an admin to build levels from two uploaded pictures plus clicked difference points.

**Architecture:** Plain React + CSS like Quiz and Memory Match. Pure units hold the logic (`lib/spot/validate.ts`, `lib/spot/hit.ts`, `lib/spot/rules.ts`); pages only render and call them. One new table `spot_levels` in the existing Supabase project and bucket `media`. Admin saving reuses the pending-media (upload on Save) code of the card pool (`lib/memory/adminCards.ts`).

**Tech Stack:** Next.js 16, React, TypeScript, Supabase, Vitest + Testing Library (jsdom), Playwright (E2E against the stand-in Supabase). No Phaser (ADR-030).

**Spec:** `docs/superpowers/specs/2026-10-30-spot-the-differences-design.md`

## Global Constraints
- Differences per level: 3 to 10. A difference is `{x, y, r}`: x, y = centre as a fraction 0-1 of the picture width / height; r = radius as a fraction of picture width.
- Radius: default 0.06, admin slider range 0.04 to 0.12; hit-testing uses `max(r, 0.05)`; distances are measured in picture-width units (the picture's aspect ratio is respected).
- A tap within several differences picks the nearest NOT-yet-found one; a tap that only touches found differences does nothing (no ripple); anything else is a miss.
- Correct tap: circle grows slowly (about 0.6 s) on both pictures and stays; soft "ting"; dot lights. Wrong tap: faint ripple about 0.8 s, no sound, no counter, no hint, no timeout. Completion screen about 1 s after the last difference.
- Admin: pictures PNG/JPG/WebP/SVG, max 2 MB each; warn (not block) when the two aspect ratios differ by more than 2%; Save needs both pictures and 3-10 differences; every delete asks for confirmation (ADR-022); saving follows T15 (files upload on Save, freed files deleted only after the database write succeeds).
- Child side: no hard-coded child-facing text, no timers, no scores, nothing saved; honor `prefers-reduced-motion`; visible focus ring; desktop Chromium only. Sounds come from `lib/sfx.ts` (Web Audio), never before "tap to enter".
- Schema changes only through a new file in `supabase/migrations/`. Never the service role key in the frontend.
- Checks before every commit: `npm run typecheck`, `npm run lint`, `npm test`; `npm run build` and `npm run e2e` at the end of each task that adds a page or an e2e spec (on the cloud image run e2e with `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`; never `playwright install`).
- **Branch.** All work is committed on the session branch `claude/kind-babbage-gd9qpd` and pushed after each task (`git push -u origin claude/kind-babbage-gd9qpd`). No pull request unless the PO asks; nothing goes to `develop` or `main`. Commit messages cite requirement IDs (S1-S10, A14-A16, G1) and end with the attribution lines from the session instructions.
- E2E specs start from `POST /__reset` (`reset()` in `e2e/support/fixtures.ts`) and never depend on another spec's data.

## Review Focus
- The window is resized (or the page zoomed) after the level opens: a tap must still map to the right picture point, because coordinates come from the picture's current bounding box, not from a cached size.
- Double-click on the same difference: it counts once, plays one "ting" and adds one circle.
- The level is deactivated or deleted after the level grid loaded: opening it shows the friendly screen and a way back, not a crash.
- One picture fails to load, or the two pictures have different aspect ratios: a plain placeholder, the level can still be left with Esc/Back, and taps never throw.
- Taps exactly on the picture edge or just outside it are a miss; two differences whose circles overlap pick the nearest unfound one; in the admin an 11th marker is refused and deleting down to 2 markers disables Save.

---

### Task 1: Pure core (types, validation, hit-testing, rules)

**Files:**
- Create: `lib/spot/types.ts`, `lib/spot/validate.ts`, `lib/spot/hit.ts`, `lib/spot/rules.ts`
- Test: `tests/spotValidate.test.ts`, `tests/spotHit.test.ts`, `tests/spotRules.test.ts`

**Interfaces:**
- Produces (`lib/spot/types.ts`):
  - `type Difference = { x: number; y: number; r: number }`
  - `type SpotLevel = { id: string; image_a_path: string; image_b_path: string; differences: Difference[]; active: boolean; sort_order: number }`
- Produces (`lib/spot/validate.ts`): constants `MIN_DIFFS = 3`, `MAX_DIFFS = 10`, `DEFAULT_R = 0.06`, `MIN_R = 0.04`, `MAX_R = 0.12`, `MIN_HIT_R = 0.05`, `ASPECT_TOLERANCE = 0.02`; `checkDifferences(list: unknown): string | null` (error message, or null when valid); `aspectsClose(a: number, b: number): boolean` (a and b are width/height; true when they differ by at most 2% of the larger).
- Produces (`lib/spot/hit.ts`): `type HitResult = { kind: 'found'; index: number } | { kind: 'repeat'; index: number } | { kind: 'miss' }`; `hitTest(differences: Difference[], found: ReadonlySet<number>, point: { x: number; y: number }, aspect: number): HitResult` (`aspect` = picture width / height).
- Produces (`lib/spot/rules.ts`): `type SpotState = { total: number; found: readonly number[] }`; `startSpot(total: number): SpotState`; `markFound(s: SpotState, index: number): SpotState` (ignores an index already found or out of range); `isWon(s: SpotState): boolean`.

- [ ] **Step 1: Write the failing tests.**
  - `spotValidate.test.ts`: `checkDifferences` returns null for 3 and for 10 valid items; an error for 2 items, 11 items, non-array, an item with x or y outside 0-1, r outside 0.04-0.12, a missing field, a string number; `aspectsClose(1.333, 1.35)` true and `aspectsClose(1.333, 1.5)` false.
  - `spotHit.test.ts` (aspect 4/3, differences `[{x:.25,y:.5,r:.06},{x:.75,y:.5,r:.06}]`): centre of first → `{kind:'found', index:0}`; a point 0.045 picture-widths away is found for `r = .04` because of the 0.05 minimum; a point far from both → `miss`; point on the first once `found = {0}` → `repeat`; two overlapping differences, nearest unfound wins even when a found one is closer; a point that is within `r` horizontally but outside it vertically (the vertical offset in fraction units is `dy`, so width-units offset is `dy / aspect`) → miss; points at x = 0 / 1 / outside the unit square → miss, no throw.
  - `spotRules.test.ts`: `startSpot(3)` not won; `markFound` three times is won; the same index twice counts once; out-of-range index ignored; state objects are not mutated.
- [ ] **Step 2: Run** `npx vitest run tests/spotValidate.test.ts tests/spotHit.test.ts tests/spotRules.test.ts`; expect FAIL (modules missing).
- [ ] **Step 3: Implement** the four files with the signatures above. In `hitTest`, measure the distance in picture-width units (`dx = p.x - d.x`, `dy = (p.y - d.y) / aspect`), hit radius `max(d.r, MIN_HIT_R)`; collect unfound candidates inside their radius and return the nearest as `found`; else if any found difference contains the point return `repeat` for the nearest; else `miss`.
- [ ] **Step 4: Run** the same command; expect PASS. Run `npm run typecheck` and `npm run lint`.
- [ ] **Step 5: Commit** `feat(spot): pure core - validation, hit-testing, rules (S3-S5)`.

### Task 2: Database, seed levels and stand-in support (S1, A14)

**Files:**
- Create: `supabase/migrations/20261030100000_spot_levels.sql`, `public/seed/spot/garden-a.svg`, `garden-b.svg`, `farm-a.svg`, `farm-b.svg`, `sea-a.svg`, `sea-b.svg`
- Modify: `e2e/support/standin-supabase.mjs` (add `spot_levels` to `TABLES`, default `[]`, default `active: true` and `sort_order: 0` in `withDefaults`), `e2e/support/fixtures.ts` (state type and `makeSpotLevels`)
- Test: `tests/spotSeed.test.ts`

**Interfaces:**
- Consumes: `checkDifferences` (Task 1).
- Produces (`fixtures.ts`): `StandinState.spot_levels: Row[]`; `makeSpotLevels(n: number, active?: boolean): SpotLevelRow[]` where `SpotLevelRow = { id; image_a_path; image_b_path; differences; active; sort_order; created_at }`, ids `00000000-0000-4000-a000-00000000000N`, both paths `seed/spot/garden-a.svg` / `garden-b.svg`, and 3 valid differences `[{x:.25,y:.3,r:.06},{x:.5,y:.6,r:.06},{x:.75,y:.4,r:.06}]`.

- [ ] **Step 1: Write the failing test** `tests/spotSeed.test.ts`: read the migration file as text; assert it creates `public.spot_levels` with the columns and the `differences` length check (3 to 10), enables RLS, has an anon/authenticated read policy `using (active)` and an admin-all policy using `public.is_admin()`; extract every seed `differences` JSON literal (written as `'[...]'::jsonb`) and assert each passes `checkDifferences`; assert every `seed/spot/*.svg` path named in the migration exists under `public/` and that each pair's A and B files differ.
- [ ] **Step 2: Run** `npx vitest run tests/spotSeed.test.ts`; expect FAIL.
- [ ] **Step 3: Write the migration** mirroring `20261029100000_memory_cards.sql` (idempotent seed: skip a row whose `image_a_path` already exists): columns `id`, `image_a_path`, `image_b_path`, `differences jsonb not null check (jsonb_typeof(differences) = 'array' and jsonb_array_length(differences) between 3 and 10)`, `active`, `sort_order int not null default 0`, `created_at`. Seed 3 levels (garden, farm, sea).
- [ ] **Step 4: Draw the six SVGs** (400x300 viewBox, flat pastel shapes in the Calm palette, no text, plain shapes only so `checkSvg` rules are not needed). Each B copies its A with 4 deliberate differences (a missing object, a changed colour, a moved shape, an extra shape); put each difference centre and a radius of 0.07 in the migration's `differences` for that level so the circles sit on the changes.
- [ ] **Step 5: Update the stand-in and fixtures** as listed. Run `npx vitest run tests/spotSeed.test.ts`; expect PASS. Run `npm run typecheck`.
- [ ] **Step 6: Commit** `feat(db): spot_levels table and three seed levels (A14)`. Note in the final report that applying the migration to the real Supabase project needs the PO's OK.

### Task 3: Registry and game list (G1)

**Files:**
- Modify: `lib/games/registry.ts` (`spot` → `ready: true`), `components/games/GameArt.tsx` (Spot art and `GameIcon` for `spot`), `app/games/page.tsx` (show the decorative icon for `spot` too; the "coming soon" branch stays for any future not-ready game), `tests/registry.test.ts`, `tests/GamesPage.test.tsx`, `e2e/games.spec.ts`
- Test: the three files above

**Interfaces:**
- Consumes: `Game` type (`id: 'quiz' | 'memory' | 'spot'`).
- Produces: `GameIcon({ id: 'spot' })` and a `SPOT_BLUE = '#5F86A8'` export from `GameArt.tsx`, used for the Spot title and icon ring (same pattern as `MEMORY_GREEN`).

- [ ] **Step 1: Update the tests first.**
  - `registry.test.ts`: `ready` equals `{ quiz: true, memory: true, spot: true }`; `href.spot === '/games/spot'`.
  - `GamesPage.test.tsx`: a link named `Play Spot the Differences` exists; no "coming soon" image; the Spot card has a decorative `[data-game-icon="spot"]` that is `aria-hidden` and has no focusable child.
  - `e2e/games.spec.ts`: replace the "coming" assertions with a playable link; replace the "cannot be opened" test with "Enter on the third game opens `/games/spot`" (two ArrowRight presses, then Enter); the three-colour border test now expects Spot to have the sky border `rgb(169, 198, 222)` and the same three distinct borders; the Tab-order test continues to the Spot link after the Memory link.
- [ ] **Step 2: Run** `npx vitest run tests/registry.test.ts tests/GamesPage.test.tsx`; expect FAIL.
- [ ] **Step 3: Implement.** Flip the flag. In `GameArt`, replace the "Coming in Phase 2" badge: Spot shows two small pastel scene tiles with a different shape each, the magnifier, and the title "Spot the Differences" in `SPOT_BLUE`; `GameIcon` for `spot` is a round sky-blue icon (circle `#EEF3F7`, ring `SPOT_BLUE`, a magnifier). In `page.tsx` widen the icon condition from quiz/memory to all three ids.
- [ ] **Step 4: Run** `npx vitest run tests/registry.test.ts tests/GamesPage.test.tsx`, then `npm run e2e -- e2e/games.spec.ts`; expect PASS (the Spot link opens a 404 until Task 4; the e2e only asserts the URL).
- [ ] **Step 5: Commit** `feat(games): Spot the Differences is ready in the registry (G1)`.

### Task 4: Level select, help and data access (S1)

**Files:**
- Create: `lib/spot/levels.ts`, `app/games/spot/page.tsx`, `components/SpotHelp.tsx`, `components/spot/SpotLevelTile.tsx`
- Test: `tests/spotLevels.test.ts`, `tests/SpotLevels.test.tsx`, `tests/SpotHelp.test.tsx`, `e2e/spot-levels.spec.ts`

**Interfaces:**
- Consumes: `SpotLevel` (Task 1), `GameHelp`/`Slide` (`components/GameHelp.tsx`), `mediaUrl`, `gridStep`/`isPressKey` (`lib/keynav.ts`), `createSupabaseBrowserClient`, `makeSpotLevels` (Task 2).
- Produces (`lib/spot/levels.ts`): `fetchActiveLevels(): Promise<SpotLevel[]>` (active only, ordered by `sort_order` then `created_at`; throws `Error(message)` on a Supabase error); `fetchLevel(id: string): Promise<SpotLevel | null>` (no `active` filter, so a signed-in admin can preview drafts, A16; RLS hides drafts from anon; null when no row or an error).
- Produces: `SpotHelp({ onClose, playHref })` with the same props as `MemoryHelp`; three picture slides built on `GameHelp`.

- [ ] **Step 1: Write the failing tests.**
  - `spotLevels.test.ts` (mock the Supabase client like `tests/memoryCards.test.ts`): `fetchActiveLevels` selects `spot_levels`, filters `active = true`, orders by `sort_order` then `created_at`, returns rows; throws the error message on failure; `fetchLevel` returns the row, null for no row, null on error, and applies no `active` filter.
  - `SpotLevels.test.tsx` (mirror `tests/MemoryLevels.test.tsx`): renders one link per level with an `<img>` of picture A (alt empty) and `aria-label="Play level N"`; empty list and load failure both show `role="status"` with `aria-label="New levels are coming soon"` and no links; the first link is focused; ArrowRight/ArrowLeft/ArrowDown/ArrowUp move focus in a 4-column grid; the "? Spot the Differences" badge opens the dialog (`aria-label` "What is Spot the Differences? Show how to play"); while it is open arrows do not move focus and Esc closes it and returns focus to the badge.
  - `SpotHelp.test.tsx`: 3 slides, last button closes when `playHref` is null.
- [ ] **Step 2: Run** `npx vitest run tests/spotLevels.test.ts tests/SpotLevels.test.tsx tests/SpotHelp.test.tsx`; expect FAIL.
- [ ] **Step 3: Implement** `lib/spot/levels.ts`; `SpotLevelTile` (a `Link` to `/games/spot/<id>` with `data-level-link`, picture A in a rounded pastel frame, about 360 px wide); the page mirrors `app/games/memory/page.tsx` (Stage, Hills, BackButton to `/games`, badge with the same style but sky colours, MusicButton, tiles in a centered wrapping grid of 4 columns, `gridStep` on arrows, Esc → `/games`); `SpotHelp` slides: look at two pictures, tap a difference, find them all (picture art only; short parent-facing titles as in `MemoryHelp`).
- [ ] **Step 4: E2E** `e2e/spot-levels.spec.ts`: with `reset({ spot_levels: makeSpotLevels(5) })` the grid shows 5 level links; ArrowRight then Enter opens `/games/spot/<id>`; with an inactive level only active ones are listed; with no levels the friendly status shows; Esc returns to `/games`; the badge opens and Esc closes the dialog without leaving the page.
- [ ] **Step 5: Run** the unit tests, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run e2e -- e2e/spot-levels.spec.ts`; expect PASS.
- [ ] **Step 6: Commit** `feat(spot): level select, help and level data access (S1)`.

### Task 5: Play screen (S2-S10)

**Files:**
- Create: `app/games/spot/[levelId]/page.tsx`, `components/spot/SpotBoard.tsx`, `components/spot/SpotDots.tsx`, `components/spot/SpotDone.tsx`
- Modify: `lib/sfx.ts` (add `ting()`), `app/globals.css` only if a keyframe is needed (prefer CSS modules next to the components)
- Test: `tests/spotSfx.test.ts`, `tests/SpotBoard.test.tsx`, `tests/SpotPlay.test.tsx`, `e2e/spot-play.spec.ts`

**Interfaces:**
- Consumes: `hitTest`, `startSpot`/`markFound`/`isWon` (Task 1), `fetchLevel` (Task 4), `preloadImages` (`lib/memory/preload.ts`), `chime`-style sfx helpers, `CelebrationScene`, `mediaUrl`.
- Produces (`lib/sfx.ts`): `ting(): void`, a single soft sine note (about 1568 Hz, short, quiet); silent when there is no AudioContext.
- Produces (`SpotBoard.tsx`): `SpotBoard({ level, urlA, urlB, found, onTap }: { level: SpotLevel; urlA: string | null; urlB: string | null; found: readonly number[]; onTap: (point: { x: number; y: number }, aspect: number) => void })`. It renders two equal pictures side by side in the same pastel frame, draws a ring for every found difference on both pictures (`data-spot-found`), draws a ripple (`data-spot-ripple`) where a miss happened (the page tells it through a `ripple` prop `{ side: 'a' | 'b'; x: number; y: number; key: number } | null`), converts a pointer position into fractions of the tapped picture's CURRENT bounding rect, and reports the picture's aspect (natural width / height of A; 4/3 until loaded). Pictures carry `data-spot-pic="a"` / `"b"`.
- Produces (`SpotDots.tsx`): `SpotDots({ total, found }: { total: number; found: number })` with `role="img"`, `aria-label` like "Found 2 of 5", one `data-spot-dot` per difference, `data-lit` on the first `found` of them.
- Produces (`SpotDone.tsx`): `SpotDone({ childName, completeUrl, onAgain, levelsHref })`, the same as `MemoryDone` without the "Total N times" line.

- [ ] **Step 1: Write the failing tests.**
  - `spotSfx.test.ts` (mirror `tests/memorySfx.test.ts`): `ting()` creates one oscillator and does not throw without an AudioContext.
  - `SpotBoard.test.tsx` (mock `getBoundingClientRect` on the pictures): a click at 25% / 50% of picture A calls `onTap({x:.25,y:.5}, aspect)`; the same relative point on B gives the same coordinates; after the mocked rect changes size the same click gives coordinates from the NEW rect; a ring is drawn on both pictures for each found index; a missing picture (`urlA = null`) shows a placeholder and clicks do not throw.
  - `SpotDots.test.tsx` cases inside `SpotBoard.test.tsx` file or a separate small test: lit count equals `found`, no text content.
  - `SpotPlay.test.tsx` (mock `fetchLevel`, sfx, `preloadImages`, `next/navigation`, like `tests/MemoryPlay.test.tsx`): a tap on a difference calls `ting` once, lights one dot and adds rings on both pictures; a double tap on the same difference still gives one ting and one dot; a tap on empty space adds one ripple, no ting, no dot change; with reduced motion the ring has no grow animation class; finding every difference shows the celebration after about 1 s (fake timers) with "play again" and "choose level" buttons; "play again" resets dots and rings; Esc navigates to `/games/spot`; `fetchLevel` returning null shows the friendly status (`aria-label="This picture is not available"`) and Esc/Back still work; leaving the page cancels timers (no state update after unmount).
- [ ] **Step 2: Run** `npx vitest run tests/spotSfx.test.ts tests/SpotBoard.test.tsx tests/SpotPlay.test.tsx`; expect FAIL.
- [ ] **Step 3: Implement.** Layout on the 1920x1080 stage: header band with BackButton and MusicButton, `SpotDots` centered above the board, pictures each at most 880 px wide and 700 px high keeping A's aspect, 48 px gap, board top about 230 px. The page loads the level with `fetchLevel(params.levelId)`, preloads both pictures with `preloadImages` before enabling taps, keeps `SpotState` in a ref plus a render counter (as `MemoryPlay` does), calls `hitTest` with the reported point and aspect, plays `ting()` and `markFound` on `found`, bumps the ripple on `miss`, ignores `repeat`, and on `isWon` waits `WIN_DELAY_MS = 1000` (use `later()` timers cleared on unmount) before showing `SpotDone`. Load the child name and optional completion sound for the praise the same way `MemoryPlay` does (its `praise` state). Ring growth about 0.6 s and ripple about 0.8 s via CSS; both are static under `prefers-reduced-motion`.
- [ ] **Step 4: E2E** `e2e/spot-play.spec.ts` with `reset({ spot_levels: makeSpotLevels(1) })`; helper `tapAt(page, 'a' | 'b', x, y)` clicks at the fraction of the picture's bounding box. Tests: tapping the three known points (one on A, one on B, one on A) lights three dots and shows the celebration; a tap on empty space leaves dots unlit and shows a ripple, then a correct tap still works (no penalty); a repeated tap on a found point does not change the dots; a small edge-of-radius tap just inside 0.05 of a point counts; Esc returns to the level grid; an unknown level id shows the friendly status; `page.emulateMedia({ reducedMotion: 'reduce' })` still completes a level.
- [ ] **Step 5: Run** unit tests, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run e2e -- e2e/spot-play.spec.ts`; expect PASS.
- [ ] **Step 6: Commit** `feat(spot): play screen with taps, rings, ripple and celebration (S2-S10)`.

### Task 6: Admin level builder (A14-A16)

**Files:**
- Create: `lib/spot/adminLevels.ts`, `app/admin/(panel)/spot/page.tsx`, `components/admin/SpotLevelPanel.tsx`, `components/admin/SpotMarkerEditor.tsx`
- Modify: `components/AdminNav.tsx` (a "Spot" link to `/admin/spot` after "Cards", with an icon in the same style)
- Test: `tests/spotAdminLevels.test.ts`, `tests/SpotMarkerEditor.test.tsx`, `tests/AdminSpot.test.tsx`, `e2e/admin-spot.spec.ts`

**Interfaces:**
- Consumes: `Difference`, `checkDifferences`, `aspectsClose`, `DEFAULT_R`, `MIN_R`, `MAX_R`, `MAX_DIFFS`, `MIN_DIFFS` (Task 1); `addPending`, `svgToPending`, `clearPending`, `commitPendingMap`, `removeMedia`, `isPending`, `mediaUrl` (`lib/media.ts`); `pathsToDelete`, `isBucketPath` (`lib/mediaPaths.ts`); `checkSvg` (`lib/quizImport.ts`); `ConfirmDialog`; the card page (`app/admin/(panel)/cards/page.tsx`) as the pattern for state, Save/Revert, beforeunload and status text.
- Produces (`lib/spot/adminLevels.ts`): `type ELevel = { id: string; isNew: boolean; a: string | null; b: string | null; differences: Difference[]; active: boolean }`; `newLevel(): ELevel`; `isLevelComplete(l: ELevel): boolean` (both pictures set and `checkDifferences` null); `loadLevels(): Promise<ELevel[]>` (all levels, active or not, by `sort_order` then `created_at`); `saveLevels(saved: ELevel[], draft: ELevel[]): Promise<{ error: string | null; warning: string | null }>` (uploads pending files into folder `spot`, deletes removed rows, upserts every level with `sort_order = index in draft`, then frees files no longer used, exactly like `saveCards`); `moveLevel(list: ELevel[], index: number, dir: -1 | 1): ELevel[]`.
- Produces (`SpotMarkerEditor.tsx`): `SpotMarkerEditor({ srcA, srcB, differences, onChange })`. Shows picture A large with a toggle to preview picture B; a click on empty space adds `{x, y, r: DEFAULT_R}` (refused past `MAX_DIFFS`, with a visible message); a click on a marker selects it; a range input (`aria-label="Radius"`, `min` 4, `max` 12, step 1, in percent) edits the selected marker's `r`; a "Delete spot" button removes it; markers are numbered circles drawn at their stored radius.

- [ ] **Step 1: Write the failing tests.**
  - `spotAdminLevels.test.ts` (mock Supabase and `lib/media` like `tests/memoryAdminCards.test.ts`): `isLevelComplete` false without B, false with 2 differences, true with 3; `loadLevels` maps rows; `saveLevels` uploads pending A and B into folder `spot` before writing, writes `sort_order` by index, deletes removed rows, removes freed bucket files only after the write succeeds, removes this attempt's uploads and returns the error when the write fails, never deletes `seed/` paths; `moveLevel` swaps neighbours and ignores out-of-range moves.
  - `SpotMarkerEditor.test.tsx`: clicking picture A at (0.3, 0.4) calls `onChange` with a marker `{x:.3,y:.4,r:.06}`; clicking an existing marker selects it and does not add another; the slider changes only that marker's `r` and clamps to 0.04-0.12; Delete removes it; an 11th click is refused with the message and no `onChange`; toggling to B shows picture B with the same markers.
  - `AdminSpot.test.tsx` (mirror `tests/AdminCards.test.tsx`): Save is disabled until both pictures and 3 differences exist; removing a marker down to 2 disables it again; an aspect mismatch above 2% shows a warning and does not block Save; deleting a level asks for confirmation; Revert restores the loaded state; "Preview as child" is a link to `/games/spot/<id>` and is hidden for an unsaved (new) level.
- [ ] **Step 2: Run** `npx vitest run tests/spotAdminLevels.test.ts tests/SpotMarkerEditor.test.tsx tests/AdminSpot.test.tsx`; expect FAIL.
- [ ] **Step 3: Implement** the library, the editor, the panel and the page. Read the natural size of each picked picture with an `Image` object (SVG with a `viewBox` works) to compare aspect ratios; the file pickers, type checks (PNG/JPG/WebP/SVG, 2 MB) and SVG-code option follow `pick()` / `applySvg()` in the cards page. The page header uses the same sticky bar, Revert/Save buttons and status text as the cards page; each level panel shows both pictures' pick buttons, the active toggle, up/down buttons, "Preview as child" and a delete button. Add the nav link.
- [ ] **Step 4: E2E** `e2e/admin-spot.spec.ts` (use `signInAsAdmin`, `reset({ spot_levels: [] })`): add a level, pick `public/seed/spot/garden-a.svg` and `garden-b.svg` with `setInputFiles`, click picture A three times, Save is enabled only then; after Save the stand-in state holds one `spot_levels` row with 3 differences and two uploaded paths; the new level appears in `/games/spot`; deleting it (confirm) empties the list; a draft (inactive) level opened through "Preview as child" is playable while signed in.
- [ ] **Step 5: Run** unit tests, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run e2e -- e2e/admin-spot.spec.ts`; expect PASS.
- [ ] **Step 6: Commit** `feat(admin): Spot the Differences level builder (A14-A16)`.

### Task 7: Docs and full gate

**Files:**
- Modify: `spec.md` (add S1-S10 and A14-A16 rows in the same table style as G1 and M1-M10, each pointing to the design spec), `plan.md` (section 5: link this plan, mark Spot the Differences as built on the session branch, keep the "left to do" list: apply the migration with the PO's OK, PO play-test), `CLAUDE.md` (Phase 2 line: Spot the Differences now has its spec and plan under `docs/superpowers/`; keep the file under one page), `docs/superpowers/specs/2026-10-30-spot-the-differences-design.md` (status line: implemented on the session branch)

- [ ] **Step 1: Make the doc edits above.** Do not touch `docs/decision.md` (no new ADR).
- [ ] **Step 2: Run the full gate:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e`; expect all PASS.
- [ ] **Step 3: Commit** `docs: Spot the Differences requirement IDs and plan status`, then push the branch.
- [ ] **Step 4: Report** to the PO: what was built, the gate output, that the migration `20261030100000_spot_levels.sql` is not applied to the real Supabase project yet, and that the feel of taps, ring growth and ripple needs a hand play-test.

---

## Self-review notes
- Spec coverage: data and RLS, seed → T2; hit-testing and minimum radius → T1; S1 → T4; S2-S10 → T5; A14-A16 → T6; registry/G1 and e2e replacement → T3; docs → T7. The spec's `lib/spot/rules.ts` is T1; `SpotHelp` is T4.
- Types used across tasks (`Difference`, `SpotLevel`, `HitResult`, `SpotState`, `ELevel`, `fetchLevel`, `ting`) are defined once in the task that produces them.
- Out-of-scope items (timers, scores, hints, AI detection, layers, Phaser) have no task.
