# Design: Spot the Differences (Phase 2, game 3)

Status: **implemented on branch claude/kind-babbage-gd9qpd; migration not yet applied to the real Supabase project**. Phase 2 only adds games (ADR-029). The game plugs into the registry created for Memory Match (ADR-014). **ADR-032 (2026-10-31) supersedes the 4:3 and landscape rules here:** pictures are cropped to squares on upload, the board and level tiles are square, picture B uses picture A's crop, and the landscape tip and tall-picture warning are removed.

## 1. Goal
Hà My (4-5, cannot read) looks at two almost identical pictures and taps the places where they differ, without anyone reading to her.

Success:
1. She plays a full level from the level grid to the end using only the mouse and pictures.
2. A parent builds a new level in the admin in a few minutes: upload two pictures, click on each difference.
3. The game list shows Spot the Differences as playable by changing one registry flag.

## 2. Decisions from the brainstorm
| Topic | Decision |
|---|---|
| Authoring | Parent uploads picture A (original) and picture B (changed), then clicks on picture A to mark each difference. No layer system, no built-in pictures only. |
| Level select | A grid of picture thumbnails (picture A), no text. |
| Wrong tap | Only a soft ripple at the tap point. No error sound, no error count, no automatic hint. |
| Progress | None saved. No stars, scores, timers or best times. |
| Tech | React + CSS (DOM). Phaser is not needed (ADR-030). |
| Name | "Spot the Differences" (English, on the game card). |
| Language | No child-facing text is hard-coded. |

## 3. Requirement IDs
- **S1-S10** child side of Spot the Differences. **A14-A16** admin. **G1** (registry) already exists; this spec flips `spot` to `ready: true`.

## 4. Data
New migration, table `spot_levels`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `image_a_path` | text not null | in bucket `media` (PNG/JPG/WebP/SVG, max 2 MB) |
| `image_b_path` | text not null | same rules; same aspect ratio as A (checked in the admin) |
| `differences` | jsonb not null | array of `{x, y, r}`; x and y are the centre as a fraction 0-1 of the picture width and height; r is the radius as a fraction of the picture width |
| `active` | boolean not null default true | |
| `sort_order` | int not null default 0 | order in the level grid |
| `created_at` | timestamptz | |

- Check constraint: `jsonb_array_length(differences)` between 3 and 10.
- RLS: anon may `select` where `active`; only the admin may insert/update/delete (as `memory_cards`). Storage rules are the existing `media` rules.
- Seed: 3 sample levels built from SVG pairs in `public/seed/spot/`. Seeded paths start with `seed/` and are never deleted from storage (T15 rule).
- Pure type and validator in `lib/spot/types.ts` and `lib/spot/validate.ts`; the database check and the validator use the same limits.

## 5. Hit-testing
- A tap is mapped to picture coordinates (fraction of width/height) on whichever picture was tapped; A and B share one coordinate system.
- Hit radius used for testing: `max(r, 0.05)` of picture width, so even a small difference is easy to hit with a mouse. Distance is measured in picture-width units (the picture's real aspect ratio is respected).
- A tap that hits an already found difference does nothing. If a tap is within several differences, the nearest not-yet-found one wins.
- Pure function `hitTest(differences, found, point, aspect)` in `lib/spot/hit.ts`, unit-tested; the UI does not re-implement it.

## 6. Child screens
### 6.1 Level select, `/games/spot` (S1)
- A centered grid of thumbnails of picture A (active levels only, `sort_order` then `created_at`). Mouse click, Left/Right (and Up/Down in the grid) to move, Enter/Space to open, Esc to go back. Visible focus ring.
- Empty pool or load failure: a friendly picture screen, not an error (as C11).
- A "? Spot the Differences" badge (top right) opens the "How to play" popup built on `GameHelp` (`components/SpotHelp.tsx`, 3 picture steps). It is the only way to open the popup; while it is open, Esc/Back/Close/backdrop close it and arrows do not move level focus.
- Back button, music button.

### 6.2 Play, `/games/spot/[levelId]` (S2-S9)
Layout: 1920x1080 stage, two pictures side by side, equal size, pastel rounded border, centered. Each picture is up to 880x860 px (a 4:3 picture shows 880x660, a portrait picture of aspect 0.73 about 628x860), so the differences are easy to see. The header band holds the back button and, on the same row, the progress dots centered; the board starts at y=190, leaving clear space below the dots, and its 8 px shadow stays inside the 1080 px stage.

- **S2 Progress.** A row of dots above the pictures, one per difference. A dot lights up when its difference is found. No numbers, no text.
- **S3 Correct tap.** Tapping a not-yet-found difference on A or B shows a circle (the difference's radius) that grows slowly (about 0.6 s) on both pictures and stays until the level ends. The soft "ting ting" chime (the same `chime()` as a Memory Match pair) plays; the matching dot lights up.
- **S4 Wrong tap.** A faint ripple at the tap point (about 0.8 s). No sound, no counter, no penalty, no hint, no timeout.
- **S5 Repeat tap.** Tapping an already found difference does nothing.
- **S6 Completion.** When all differences are found, after about 1 s the shared `CelebrationScene` shows (confetti, praise sound, 3 stars, both characters, as in the Quiz set-done page) with two picture buttons: "play again" and "choose level". Nothing is saved.
- **S7 Keyboard.** The game is mouse-driven. Esc goes back to the level grid; Enter/Space activate the focused button on the completion screen. Visible focus ring.
- **S8 Reduced motion.** With `prefers-reduced-motion`: the circle and ripple appear without growing or fading; confetti follows the shared setting. Sounds stay.
- **S9 Robustness.** A missing or failed picture shows a plain placeholder and the game remains leavable (Esc/Back). Leaving the page cancels timers and sounds. Both pictures are preloaded before play starts. Window resize keeps tap mapping correct (coordinates are computed from the picture's current bounding box).

### 6.3 Sounds (S10)
- The correct tap plays `chime()` ("ting ting", synthesized with Web Audio in `lib/sfx.ts`, shared with Memory Match); no audio files. Background music keeps playing (ADR-016). Nothing plays before "tap to enter". The wrong tap has no sound.

## 7. Admin (A14-A16)
New "Spot" item in the admin nav, `/admin/spot`.

- **A14 Level list.** A grid of all levels (thumbnail of A, number of differences, on/off). Add, edit, delete (always with a confirmation, ADR-022), reorder (up/down buttons, no drag needed).
- **A15 Level editor.** Upload picture A and picture B (or SVG code, as for cards). The editor warns (does not block) if the aspect ratios differ by more than 2%. It also shows a permanent tip ("use landscape pictures (4:3 or 3:2) and make every difference big and clear, so a young child can see it from the chair"), warns when either picture is portrait (tall pictures are shown smaller on the play screen; one warning per level), and shows a status line when spots are small (radius below 6%, e.g. "2 spots are small and may be hard for a young child to see"). None of these warnings blocks Save. The marking tool shows picture A large: click picture A or picture B to add a difference at that point (one position is stored for both pictures), click an existing marker to select it, a slider sets its radius (default 6%, range 4%-12% of picture width), a Delete button removes it. A toggle switches the view to picture B so the parent can check the spots against it. Save is disabled until both pictures are set and there are 3-10 differences.
- **A15 Saving** follows T15: picking a file only previews it; Save uploads new files first, then writes the database; replaced, removed or deleted files are freed after a successful save; Revert discards unsaved edits.
- **A16 Preview as child.** A "Preview as child" button opens the real play screen using the authenticated client, so drafts (inactive levels) can be tried before publishing (as T12).

## 8. Architecture notes
- New units: `lib/games/registry.ts` (flip `spot` to ready), `lib/spot/types.ts`, `lib/spot/validate.ts`, `lib/spot/hit.ts`, `lib/spot/levels.ts` (Supabase reads), `lib/spot/adminLevels.ts`; UI under `app/games/spot/` and `app/admin/spot/`; components `components/spot/` (`SpotBoard`, `SpotDots`, `SpotMarker`), `components/SpotHelp.tsx`, and a Spot icon in `components/games/GameArt.tsx`.
- `SpotBoard` owns tap-to-point mapping and rendering; rules (found set, completion) live in a small pure state module `lib/spot/rules.ts`.
- `lib/keynav.ts` already has the 2D grid step from Memory Match; reuse it for the level grid.
- Reuses: `Stage`, `Hills`, `BackButton`, `MusicButton`, `Confetti`, `CelebrationScene`, `GameHelp`, the pending-media/T15 save code, `ConfirmDialog`.

## 9. Testing
- Unit: `hitTest` (hit, miss, minimum radius, found difference ignored, nearest wins, non-square aspect), `rules` (progress, completion, repeat tap), `validate` (3-10 differences, ranges, paths), sfx call.
- Component: level grid (empty state, keyboard), play screen (correct tap on A and on B, wrong tap ripple with no counter, completion buttons, Esc, reduced motion), admin editor (add/move/delete marker, radius slider, Save disabled rules, confirm on delete).
- Database: migration applies to an empty project; anon reads only active levels; every write by anon is denied; the 3-10 check rejects bad data.
- E2E (Playwright): `/games` shows Spot as playable and opens `/games/spot` (replaces the "cannot be opened" test); play a seed level to the celebration; wrong tap leaves the level unfinished; admin creates a level.
- By hand (PO): how the tap, circle growth and ripple feel with a real mouse.

## 10. Out of scope
Timers, stars or scores, saved progress, automatic or timed hints, wrong-tap counters, automatic difference detection (AI), layer-based authoring, touch or TV work (ADR-028), Phaser, other languages.

## 11. ADR
No new ADR. ADR-030 applies (DOM/CSS; Phaser not justified here).

## 12. Confirmed by the PO (2026-10-30)
- Authoring by two uploaded pictures plus clicked difference points.
- Wrong tap: only a soft ripple, no automatic hint.
- Level select is a grid of picture thumbnails.
- Hit areas are generous for mouse use: default radius 6%, minimum hit radius 5% of picture width.
