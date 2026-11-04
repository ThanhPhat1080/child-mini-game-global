# Design: Sort It (Phase 2, game 3)

Status: **implemented on branch `claude/phase2/sort-it` (2026-10-30), awaiting the PO play-test and the migration being applied to the real Supabase project before merge into `develop`** (approved by the PO in the brainstorm; groups changed the same day from free text to admin-managed tags, one tag per card). Phase 2 only adds games (ADR-029). Order chosen by the PO: Memory Match and Listen & Pick (built), Sort It, then Spot the Differences (own spec later). Each game has its own spec, plan and integration branch (`claude/phase2/sort-it`).

## 1. Goal
Hà My (4-5, cannot read) drags everyday objects into the basket where they belong (animals with animals, food with food) and hears the English word of every object she picks up. Secondary goal: learn English words by hearing them, without pressure.

Success:
1. She plays a full round from the game list to the end with the mouse, nobody reading to her.
2. A parent creates groups (tags) once in the admin and gives each card its tag in under a minute (a tag picker on the card, or a `group` key in the JSON import); the 29 seeded cards already have tags, so the game works on day one.
3. The game is one more registry entry (ADR-014).

## 2. Decisions from the brainstorm
| Topic | Decision |
|---|---|
| Content | The shared card pool (`memory_cards`) plus **groups**: a list of tags the admin creates first (new table `card_groups`), and one optional tag per card (`memory_cards.group_id`). One tag per card, never several. |
| Mode | One fixed mode: 2 baskets, 6 objects (3 per basket). No level screen. |
| Basket hint | Each basket starts with one example card of its group already in it (tap it to hear the word). No group images. |
| Input | Mouse only (Pointer Events, drag and drop). No keyboard play; Esc still goes back. This is a PO decision and the one exception to the child-keyboard rule in CLAUDE.md. |
| Wrong drop | Like Quiz: "Oh-Oh" sound, sad-face popup, the object slides back; no penalty, no timer. |
| Right drop | "Ting ting" chime, the object stays in the basket, the word is said once. |
| Progress | None stored. The finish screen shows how many wrong drops there were (not kept). |
| Tech | React + CSS (DOM) with Pointer Events written in the repo; no drag-and-drop library, no HTML5 drag-and-drop, no Phaser (ADR-030). |
| Name | "Sort It" (English). |

## 3. Requirement IDs
- **G1** (extended): registry entry. **R1-R10**: child side of Sort It. **A17-A19**: admin (manage groups, tag a card, JSON import). **A13** (extended): pool health.
_IDs renumbered on 2026-10-30 when this branch was merged with Spot the Differences, which already used S1-S10 and A14-A16: Sort It's former S1-S10 are now R1-R10 and its former A14, A15, A16 are now A17, A18, A19._

| ID | Requirement |
|---|---|
| R1 | Entry: `/games/sort` plays directly (no level screen). Registry entry `sort`, ready, between Listen & Pick and Spot. A "? Sort It" badge opens a "How to play Sort It" popup (opened only from that badge). |
| R2 | Round: two random usable groups (a group is usable when it has at least 4 active cards with different words); from each, 4 random cards: 1 is the example already in the basket, 3 are objects to sort. The 6 objects are shuffled in one row; which basket is left or right is random. No usable pair of groups: friendly picture screen, not an error. |
| R3 | Drag: pressing an object (primary button) lifts it (slightly larger, soft shadow), it follows the pointer, and the word is said (recorded file if the card has one, else `speakKid`). Releasing over a basket counts as a drop on that basket (the basket area, not only its slots). A press without movement is a tap: the word is said again and the object stays. Only one object is dragged at a time. |
| R4 | Right drop: "ting ting" (`chime`), the object settles into the next free slot of that basket, then the word is said once. |
| R5 | Wrong drop: `ohOh` sound, a non-blocking "Oh-oh… try again!" popup with the sad face (the same look as Quiz, 1.4 s), the object slides back to its place in the row. The wrong count goes up by one. Releasing outside both baskets: the object slides back, no sound, no count. |
| R6 | Voice: picking an object up, tapping an example or an object, and a right drop each say the word through `sayWord`; a newer word cuts the older one. |
| R7 | Finish: after the 6th right drop and its word (about 1 s pause) the shared celebration scene shows (3 stars, both characters, confetti, "You did it, <child name>!" with the same praise sound as the other games), the line "Wrong N times" with N highlighted (N may be 0), and two picture buttons: play again (a new round) and back to games. Nothing is stored. |
| R8 | Reduced motion: no lift animation, no slide or bounce; the object jumps back and the popup just appears. Sounds stay. |
| R9 | Robustness: a missing picture shows a plain placeholder and the object is still draggable; no English voice means no spoken word, the game still works; leaving the page cancels timers and speech and drops any drag in progress; with pointer capture the drag continues outside the window, and the object slides back when the pointer is released outside the baskets or the browser cancels the pointer (`pointercancel`); a second press during a slide-back or a right-drop settle is ignored; the round's pictures are preloaded. |
| R10 | Keys and focus: Esc goes to `/games`; every object, example and button is a real element with a visible focus ring, but dragging needs the mouse (see the decision above). |
| A17 | Manage groups: on `/admin/cards` a "Groups" area above the cards shows every group as a tag chip. Add a group by typing its name (1-40 characters, unique ignoring case and surrounding spaces), rename it, delete it (always with a confirmation, ADR-022; its cards become "no group"). Group edits are unsaved changes like card edits: Save writes groups first, then cards; Revert discards both. |
| A18 | Tag a card: each card has a "Group" picker listing the groups plus "No group" (no free typing). A warning (not a block) shows on a card whose group has fewer than 4 cards with different words ("Sort It needs at least 4"). |
| A19 | JSON import: each card may have `group` (optional string); blank or missing means no group; a name must match an existing group (ignoring case and spaces), otherwise an error with the card number tells the parent to create the group first (nothing is created by the import, nothing is imported on any error, same rules as A12). Wrong type or over 40 characters is an error too. `public/memory-cards-template.json` shows the key. |
| A13 | (extended) Pool health also says how many groups can be played in Sort It, for example "Sort It: 6 groups can be played (2 are needed, each with 4 cards)." |

## 4. Data
One new migration `supabase/migrations/20261030110000_card_groups.sql`:
- Table `card_groups`: `id uuid primary key default gen_random_uuid()`, `name text not null` (1-40 characters after trim), `created_at timestamptz not null default now()`, and a unique index on `lower(btrim(name))`.
- `alter table memory_cards add column group_id uuid null references card_groups(id) on delete set null`.
- RLS on `card_groups`: only the admin (`is_admin()`) may select, insert, update or delete; anon has no access (the game only needs `memory_cards.group_id`, never the group names). `memory_cards` policies do not change.
- Seed (idempotent, by name and by `image_path`): the six groups below, and `memory_cards.group_id` set for the seeded cards (only where it is still null):

| Group | Cards |
|---|---|
| `food` | apple, banana, berry, grapes, cookie |
| `animals` | bird, cat, duck, fish |
| `shapes` | circle, heart, square, star, triangle |
| `school` | ruler, pencil, pen, eraser, book, scissors, backpack |
| `home` | cup, chair, clock, house |
| `nature` | flower, moon, sun, tree |
| (none) | ball, car |

- Other games ignore the column. Group names are for the parent only; the child never sees them.
- A group is **usable** when it has at least 4 active cards with different words (same-word cards count once, as in Listen & Pick). Cards without a group are ignored by this game. The game needs at least 2 usable groups.

## 5. Child screen, `/games/sort`
Layout on the 1920x1080 stage: header with back button and the "? Sort It" badge; two large baskets left and right (each a rounded tray with its example already inside and three empty slots); the row of 6 objects at the bottom centre. Music button as in the other games.

- Pointer handling: the page converts pointer positions to stage coordinates using the stage scale, so dragging and the drop test work at any window size. The drop test uses the basket's rectangle on screen.
- Right drops lock the object in its slot (it is no longer draggable). Wrong drops and outside drops return the object to its place in the row (about 0.35 s, none under reduced motion).
- Colors: baskets use a warm butter tone so the game differs from Quiz (rose), Memory Match (sage), Listen & Pick (lavender) and Spot (sky). Proposed values: card border `#EAD9A0`, title and icon ring `#A8842F`, icon circle `#FBF3D9`; the PO confirms from a screenshot at the end.
- The game list card shows a decorative icon (not a button, `aria-hidden`) like the other games: two small baskets with a star and a heart.
- The help popup (`SortHelp`, shell `GameHelp`) has 3 steps: pick up an object and hear it, drag it to the basket with the same kind of things, a happy sound when it fits.

## 6. Admin
- A "Groups" area at the top of `/admin/cards`: tag chips with rename and delete, an input to add a group. New and renamed groups are validated as in A17 (empty, over 40 characters and duplicates ignoring case are refused with a short message).
- `components/admin/CardPanel` gets the Group picker (a `select` with "No group" and the groups); a card whose group was deleted in the draft shows "No group".
- `lib/memory/adminCards.ts`: `ECard` gets `groupId: string | null`; new `EGroup = { id: string; isNew: boolean; name: string }`, `loadGroups()`, and `saveCards` also writes `group_id`; `saveGroups` runs first (upsert new and renamed groups), then cards, then groups removed from the draft are deleted (the database sets their cards' `group_id` to null).
- `lib/memory/import.ts` parses and validates `group` as in A19 against the draft's groups.
- Pool health (A13) uses a pure helper `sortHealth(cards)` shared with the game's round builder.

## 7. Architecture notes
- New pure units: `lib/sort/groups.ts` (`usableGroups(cards)`, keyed by `group_id`) and `lib/sort/rounds.ts` (`buildSortRound(cards, rng?)`); `lib/sort/drag.ts` (pure helpers: stage-coordinate conversion, point-in-rect hit test).
- UI: `app/games/sort/page.tsx`, `components/sort/*` (basket, draggable object, finish content), `components/SortHelp.tsx`.
- Reuses: `fetchActiveCards` is NOT changed (Memory Match and Listen & Pick keep their query); Sort It has its own `fetchSortCards` that also selects `group_id`; `MemoryCard` gets an optional `group_id`, `sayWord`/`stopWord`, `chime`, `ohOh`, `Stage`, `Hills`, `BackButton`, `MusicButton`, `CelebrationScene`, `GameHelp`, `preloadImages`, the sad-face popup markup of Quiz.
- The other games and their tests must keep passing (the extra column and table are additive). The admin page does need the migration: it must be applied to the shared Supabase project before the admin or the game is used there.

## 8. Testing
- Unit: `usableGroups` and `buildSortRound` (counts, no repeated cards, two different groups, 1 example + 3 objects each, shuffles, same-word cards count once, fewer than 2 usable groups gives `null`); drag helpers (scale conversion, hit test); import (`group` matching, matching ignoring case, unknown group, wrong type, over 40, blank); the template file; admin group management (add, rename, delete, duplicates) and saving `group_id`; sfx calls.
- Component: round start, pointer drag with right drop (chime, word, slot filled), wrong drop (ohOh, popup, slide back, count), drop outside, tap without movement, `pointercancel`, a second press during a slide-back, finish with 0 and some wrong drops, empty screen, help popup, reduced motion, unmount cleanup (no timers left).
- Database: the migration applies on top of the existing ones; seeded cards have the groups of the table above; anon cannot read `card_groups` and still reads only active cards.
- E2E (Playwright, real mouse with `page.mouse` on the stand-in Supabase): a full round with right drops; a wrong drop then the right one; a drop outside; the finish count; play again; empty pool screen; admin: create a group, tag a card, save, reload; import a file with `group` (known and unknown name).
- By hand (PO): how the drag, sounds and voice feel.

## 9. Out of scope
Keyboard play, per-group pictures, levels or more than 2 baskets, stored progress or a list of mixed-up words, several tags on one card, group colors or pictures, Phaser, Spot the Differences (its own spec).
