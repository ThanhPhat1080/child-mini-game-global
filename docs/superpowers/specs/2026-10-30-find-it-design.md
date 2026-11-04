# Design: Find It (Phase 2, game 6)

Status: **implemented on branch `claude/phase2/find-it`, awaiting the PO play-test and the migration being applied.** Phase 2 only adds games (ADR-029). Integration branch `claude/phase2/find-it`. The name "Find It" is provisional (the PO decides); it only appears in the game list art alt text and the help badge.

## 1. Goal
Hà My (4-5, cannot read) sees one big picture full of mixed-up everyday objects. The app says the name of one object aloud (and shows the word); she finds it in the picture and clicks it. She finds each object in turn until the picture is done. Secondary goal: learn English words by hearing and seeing them, without pressure.

Success:
1. She plays a full picture from the game list to the celebration with the mouse, nobody reading to her.
2. A parent adds a new picture often: upload it (or pick one already in the library), click each object, type its word, optionally add a sound; done in a few minutes and the number, word and sound of every object always match.
3. The game is one more registry entry (ADR-014).

## 2. Decisions from the brainstorm
| Topic | Decision |
|---|---|
| Content | One level = one picture. The admin uploads pictures often; the child chooses a level from a grid of thumbnails. |
| Picture source | Upload a new file, or pick a file already in the `media` bucket (shared, no second copy). Bundled `seed/` art is not used for this game and no level is seeded. |
| Objects | Per level 2-12 numbered objects. Each = a circle on the picture (`x`, `y`, `r`) + a typed word + an optional sound (upload new or pick an existing one). Number, word and sound live in one record, so they cannot drift apart. |
| Order | Fixed: by number 1, 2, 3, ... (the admin controls difficulty and teaching order). |
| Voice | The recorded sound if the object has one, else the browser voice (`sayWord`-style), always English. |
| Text on screen | The word is shown beside the sound. The word is typed by the admin, never hard-coded. The screen stays playable without reading it (sound + the speaker button). |
| Wrong tap | Soft ripple only, like Spot: no error sound, no counter, no penalty, no timer, no hint. |
| Right tap | `chime`, a ring that stays on the object, then the next object after about 1 s. |
| Progress | None stored. |
| Tech | React + CSS (DOM). No Phaser (ADR-030). |

## 3. Requirement IDs
- **G1** (extended): registry entry `find`. **F1-F10**: child side. **A20-A23**: admin. No change to the existing game IDs.

| ID | Requirement |
|---|---|
| F1 | Entry: `/games/find` shows a grid of picture thumbnails (active levels only, `sort_order` then `created_at`), no text. Mouse, Left/Right (and Up/Down) to move, Enter/Space to open, Esc back, visible focus ring. Empty pool or load failure: friendly picture screen, not an error. A "? Find It" badge opens the "How to play" popup (shell `GameHelp`, `components/FindHelp.tsx`, 3 picture steps), opened only from that badge. |
| F2 | Play, `/games/find/[levelId]`: the picture centered and large (fits 1500x800 px of the 1920x1080 stage, aspect kept), a prompt bar above it with the current word (large, Baloo 2) and a speaker button, a row of progress dots (one per object, no numbers), back and music buttons. Nothing plays before "tap to enter". |
| F3 | Prompt: when the level opens (after a short pause) and after every found object, the app says the current object's word and shows it. Recorded file if the object has one, else the browser voice. The speaker button (and key R) says it again. A newer word cuts the older one. |
| F4 | Right tap: a tap inside the **current** object's circle (hit radius `max(r, 0.04)` of the picture width) plays `chime`, grows a ring (about 0.6 s) that stays on the object, lights its dot, and after about 1 s moves to the next object (prompt says and shows its word). |
| F5 | Wrong tap: any other tap (empty area, or another object) shows a faint ripple at the tap point (about 0.8 s). No sound, no counter. Repeat taps on a found object do nothing. |
| F6 | Completion: after the last object is found (about 1 s) the shared `CelebrationScene` shows (3 stars, both characters, confetti, praise sound) with two picture buttons: play again (same level, from object 1) and choose another level. Nothing is stored. |
| F7 | Keys: Esc goes back to the level grid (from the grid, to `/games`); R repeats the word; on the completion screen Enter/Space activate the focused button. Playing is by mouse. Visible focus ring. |
| F8 | Reduced motion: ring and ripple appear without growing or fading, the prompt changes without sliding. Sounds stay. |
| F9 | Robustness: a missing picture shows a plain placeholder and the level is still leavable; no English voice means no spoken word but the word is still shown; leaving the page cancels timers and speech; both the picture and the level's sounds are preloaded before the first prompt; window resize keeps tap mapping correct (coordinates from the picture's current bounding box); taps during the 1 s pause after a right tap are ignored. |
| F10 | A level whose data fails validation (fewer than 2 objects, a blank word) is skipped in the grid instead of crashing. |
| A20 | Level list `/admin/find`: grid of all levels (thumbnail, number of objects, on/off). Add, edit, delete (always with a confirmation, ADR-022), reorder (up/down buttons). New "Find" item in the admin nav. |
| A21 | Level editor: picture area with two ways to set the picture: "Upload" or "Choose from library" (A23). Click the picture to add an object at that point; each object is drawn as a circle with its **number** on it; click a circle to select it; a slider sets its radius (default 6%, range 3%-15% of picture width); a Delete button removes it. A side list shows one row per object in number order, with the same number, a **word** field (required, 1-40 chars), and a **sound** control: none / upload / choose from library, a play button and a clear button. Selecting a circle highlights its row and selecting a row highlights its circle. Deleting an object renumbers the rest, and the rows move with their circles. The parent can move an object up or down in the order (changes the numbers). Save is disabled until a picture is set, there are 2-12 objects, and every object has a word. A permanent tip: "use a clear picture where every object is big enough to click". A status line warns (never blocks) when a circle is smaller than 4% ("N objects are small and may be hard to click"). |
| A22 | Saving follows T15: picking a file only previews it; Save uploads new files first, then writes the database; Revert discards unsaved edits. Files replaced, removed or deleted are freed only if no other record uses them (A23). "Preview as child" opens the real play screen with the authenticated client, so inactive levels can be tried. |
| A23 | Library: a dialog listing pictures (for the picture) or sounds (for an object sound) already in use somewhere in the app, with a preview or play button. Choosing one stores the same path (no copy). Because files are shared, **before any file is deleted from the bucket** (on this game's save/delete and also on the existing Cards, Quiz sets and Spot saves/deletes) a shared guard checks that no other record still references the path; a referenced path is kept. Seed paths and external links are never listed and never deleted (existing T15 rule). |

## 4. Data
One migration `supabase/migrations/20261030120000_find_levels.sql`, table `find_levels`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | |
| `image_path` | text not null | path in bucket `media` (PNG/JPG/WebP/SVG, max 2 MB) |
| `objects` | jsonb not null | array in play order: `{x, y, r, word, audio_path}`; `x`,`y` centre as fraction 0-1 of picture width/height; `r` radius as fraction of picture width; `word` 1-40 chars trimmed; `audio_path` string or null |
| `active` | boolean not null default true | |
| `sort_order` | int not null default 0 | |
| `created_at` | timestamptz not null default now() | |

- Check constraint: `jsonb_typeof(objects) = 'array'` and `jsonb_array_length(objects)` between 2 and 12. Field-level rules (ranges, word length) are enforced by `lib/find/validate.ts` (the database cannot cheaply check each element); the admin save and the child reader both use it.
- The number shown to the admin is the array index + 1; it is not stored separately, so number, word and sound cannot disagree.
- RLS as `spot_levels`: anon `select` where `active`; only `is_admin()` may insert/update/delete. Storage rules are the existing `media` rules (audio is already allowed for card recordings).
- No seed level (the picture must come from the admin). The game shows the friendly empty screen until the first level exists. Tests use a level in the stand-in Supabase fixtures.
- Other games ignore this table. Migration is additive and idempotent; it must be applied to the shared Supabase project before the admin page or the game is used (only after the PO's OK).

## 5. Hit-testing
- Tap is mapped to picture fractions on the picture's current bounding box (aspect kept). Pure function `hitCurrent(obj, point, aspect)` in `lib/find/hit.ts`: true when the distance (in picture-width units, aspect respected) is at most `max(obj.r, 0.04)`.
- Only the current object counts. A tap inside another object's circle is a wrong tap (ripple only).

## 6. Child screens
- **Grid** `/games/find`: like Spot's level grid (reuse `lib/keynav.ts` 2D step and the tile pattern).
- **Play** `/games/find/[levelId]`: state in a small pure module `lib/find/rules.ts` (`{ index, done }`, `next`, completion). Timings as constants at the top of the page (PROMPT_DELAY_MS 600, ADVANCE_MS 1000, FINISH_DELAY_MS 1000, RING_MS 600, RIPPLE_MS 800). The prompt shows the word in a rounded pastel bar with the speaker button; a changing word fades (slides under reduced motion: just changes).
- **Colors:** peach/apricot to differ from rose (Quiz), sage (Memory), lavender (Listen), gold (Sort) and sky (Spot): card border `#F2C9A8`, title and icon ring `#B5703A`, icon circle `#FCEFE2`; ring on found objects uses the same `#B5703A`. The PO confirms from a screenshot at the end.
- **Game list art:** a decorative icon (`aria-hidden`, not a button): a magnifier over a small picture frame.
- Sounds: `chime` for a right tap, voice via recorded file or `speakKid`; the finish uses the shared praise sound. No new audio files. Background music keeps playing (ADR-016).

## 7. Admin
- One page `app/admin/(panel)/find/page.tsx` with level panels like Spot (not a per-id `[id]` route), `components/admin/FindLevelPanel.tsx`, `FindMarkerEditor.tsx` (reuses the click-to-add and slider mechanics of `SpotMarkerEditor` where they fit, but adds numbers, the row list and object ordering; a shared piece is extracted only if the copy would be near-identical), `MediaLibraryDialog.tsx`.
- `lib/find/adminLevels.ts`: load, save (uploads first, DB second, frees files after), delete, reorder; `lib/find/types.ts`, `lib/find/validate.ts`, `lib/find/levels.ts` (child reads).
- `lib/media/library.ts`: collects distinct bucket paths in use (pictures: `memory_cards.image_path`, `spot_levels.image_*`, `find_levels.image_path`, set covers and question images; sounds: `memory_cards.audio_path`, `find_levels.objects[].audio_path`, question voices), and `lib/media/refs.ts`: `isReferenced(path, exceptRecord?)` used by every delete path (A23). Exact table and column list is confirmed from the schema in the plan; the unit tests cover each source.

## 8. Architecture notes
- New units: `lib/games/registry.ts` (add `find`, ready, last in the list: `quiz, memory, listen, sort, spot, find`), `components/games/GameArt.tsx` (icon), `app/games/page.tsx` (card colors).
- Reuses: `Stage`, `Hills`, `BackButton`, `MusicButton`, `Confetti`, `CelebrationScene`, `GameHelp`, `ConfirmDialog`, `chime`, `speakKid`, `sayWord`/`stopWord` (the existing helper that plays a recording else the browser voice; if it is tied to `MemoryCard`, take a plain `{word, audioPath}`), `preloadImages`, the pending-media/T15 save code in `lib/media.ts`, `isBucketPath`, `pathsToDelete`.
- Existing games keep working; the guard in A23 only makes deletes safer.

## 9. Testing
- Unit: `validate` (2-12 objects, ranges, blank word, over 40, bad audio path), `hitCurrent` (hit, miss, min radius, aspect, other object's circle is a miss), `rules` (advance, completion, ignore during pause), renumbering and move up/down on the editor model (word and sound travel with the circle), library collection and `isReferenced` for every source table, `pathsToDelete` with shared files, sfx calls, template-free.
- Component: level grid (empty state, keyboard, invalid level skipped), play screen (prompt words and order, speaker replay, right tap advances, wrong tap ripple with no counter, tap during pause ignored, completion buttons, Esc, reduced motion), editor (add/select/delete, row <-> circle highlight, renumber, Save-disabled rules, confirm on delete, library choose).
- Database: migration applies on top of existing ones; anon reads only active levels; anon writes denied; the 2-12 check rejects bad data.
- E2E (Playwright, stand-in Supabase): `/games` lists Find and opens `/games/find`; play a level in order to the celebration; a wrong tap leaves it unfinished; admin creates a level by uploading a picture and marking two objects; admin creates a second level choosing the same picture from the library, then deletes the first level and the shared picture still loads; empty pool screen.
- By hand (PO): how the voice, word display, ring and pacing feel.

## 10. Out of scope
Random order, levels with fewer than 2 objects, timers, scores or stars, saved progress, hints, wrong-tap counters, auto-detection of objects, multiple-choice questions, touch or TV work (ADR-028), Phaser, other languages, a seed level.

## 11. ADR
No new ADR. ADR-030 applies. The shared-file delete guard (A23) is recorded in `docs/decision.md` as a short ADR when the plan is written.
