# Spec: childPlayer (Phase 1 Quiz + admin, Phase 2 games)

Source: `docs/intent.md`, `docs/decision.md` (ADR numbers below), prototype https://claude.ai/artifact/L1YRtj4NVFe6NewZ3w2s4E
Status: **Phase 1 CLOSED 2026-10-28 by the PO.** Phase 2 game 1 (Memory Match) is built on the integration branch `claude/phase2/memory-match`, not yet released; its IDs G1, M1-M10 and A11-A13 are in sections 3b and 4b. Game 2 (Listen & Pick) is implemented on the integration branch `claude/phase2/listen-pick`, awaiting the PO play-test before merge into `develop`; its IDs L1-L10 are in section 3b. Game 3 (Spot the Differences) is built on branch `claude/kind-babbage-gd9qpd` and merged into `develop`, its migration is applied to the real Supabase project; its IDs S1-S10 and A14-A16 are in sections 3c and 4c. Game 4 (Sort It, listed before Spot in the game list) is implemented on the integration branch `claude/phase2/sort-it`, awaiting the PO play-test before merge into `develop`; its migration `20261030110000_card_groups.sql` is reported applied to the real Supabase project (check still open, plan ST-T14); its IDs R1-R10 are in section 3b and A17-A19 in section 4b (renumbered from S1-S10 and A14-A16 on 2026-10-30, because Spot already used those IDs). Platform is a computer browser (ADR-028); casting the screen to a TV works but is not a requirement. Game 5 (Find It) is implemented on the integration branch `claude/phase2/find-it`, awaiting the PO play-test and the migration `20261030120000_find_levels.sql` being applied to the real Supabase project (not yet applied); its IDs F1-F10 are in section 3d and A20-A23 in section 4d. Leftovers and known gaps (including the device-dependent voice) are listed in `plan.md` section 4.

## 1. Goal and scope
A child (4-5, cannot read) finishes a full quiz set by pictures, color and sound only, on a computer (keyboard + mouse, may be cast to a TV). Parents manage all content in the app. Same code is reused per child (one Supabase project + one deployment, ADR-009).
Out of scope for Phase 1: everything in Phase 2. Phase 2 is only "more games" (see `plan.md` section 5); the play limit, rest screen and PIN were dropped (ADR-029).

## 2. Users
- **Child:** no sign-in, read-only access to published content.
- **Parent/admin:** signs in with Supabase Auth email + password (ADR-015), the only writer.

## 3. Child flow (computer browser; layout designed on a 1920x1080 canvas scaled to the window, ADR-012, ADR-028)
| ID | Requirement |
|----|-------------|
| C1 | Welcome: large "tap to enter" button. On press: greeting audio plays, background music starts (looping), then "Start game" appears (ADR-016). Princess illustration at the left. Shows the child's name from settings. |
| C2 | Game list: carousel with only "Quiz". Moves with Left/Right keys, click-and-hold drag, arrow buttons, dots. A drag never triggers the card click (ADR-018). Enter/click opens the game. Registry-based so more games can be added later (ADR-014). |
| C3 | Quiz set selection: cards of published sets: cover, name in heading color, optional sub-title, question-count pill, star if finished (ADR-020). Select with click, or by keyboard: Left/Right arrows move between sets, Enter or Space opens one. |
| C4 | Question: shows prompt image/text and plays prompt audio if present. 2-3 answers, each a number + fixed color (1 rose, 2 sky, 3 butter, ADR-019) plus an image, a text, or both; an answer with neither is invalid (the question is incomplete and hidden from the child). A text-only answer shows its text large on the card. Choose by click, keys 1/2/3 (ADR-007), or Left/Right arrows to move between the answers and Enter or Space to pick the focused one. No timer. |
| C5 | Wrong answer: soft "Oh-oh", the wrong card dims gently, child tries again. No penalty, no lives. |
| C6 | Correct answer: "Hooray!" with slow pastel confetti, then a 3 s "Continue in 3s" countdown moves to the next question (ADR-021). |
| C7 | Set completed screen with praise and a way back to set selection. The set is marked finished (star). |
| C8 | Navigation back (Esc/Back key and a picture button) from set selection to game list and from a question to set selection. |
| C9 | No screen requires reading. Any text is decorative or admin-written. Vietnamese diacritics render correctly (ADR-017). |
| C10 | Motion is slow; `prefers-reduced-motion` disables or reduces confetti and transitions (ADR-006, ADR-021). |
| C11 | Empty state: if there are no published sets, show a friendly picture screen, not an error. |
| C12 | Question screen has three bands (header, question row with image + replay-voice + text, answers) with no overlap (ADR-025). Set-completed screen shows the girl image and a light confetti burst with applause and a spoken "You did it" (ADR-026). |
| C13 | Game list: the "? Quiz" badge on set selection opens a "How to play" popup (the game list card only shows a decorative "?" icon, since the PO decision: the child only chooses a game there and watches the tutorial inside the game) (4-step carousel); the large avatar shows a "Hi I'm <name>. Let's play together!" bubble (blue for a boy, pink for a girl) when tapped. Added after the first draft (plan T8, T9). |
| C14 | Question reading: the question is read aloud, then each answer (unless the question's "Read the answers aloud" is off); the picked answer is always read before the Hooray / Oh-oh popup; Hooray / Oh-oh / You did it can use custom sounds from Settings. Added after the first draft (plan T3, T10, T11). |
| C15 | Progress: a question is finished only when its right answer is picked; finished questions are kept per set in localStorage and cleared when the set is completed (the star stays). Added after the first draft (plan T10, T11). |

## 3b. Phase 2: game registry, Memory Match, Listen & Pick and Sort It (child)
Details for G1 and M1-M10: `docs/superpowers/specs/2026-10-29-memory-match-design.md`; for L1-L10: `docs/superpowers/specs/2026-10-30-listen-pick-design.md`; for R1-R10 (Sort It): `docs/superpowers/specs/2026-10-30-sort-it-design.md`; Spot the Differences is in section 3c.
| ID | Requirement |
|----|-------------|
| G1 | Game registry: the game list reads a typed registry (in order: quiz, memory, listen, sort, spot; all five are playable, `ready: true`); extends C2 and ADR-014. Every card shows a purely decorative icon (Quiz: round "?"; Memory Match: two overlapping flower cards with white petals in a round pale-green circle, a green icon matching the title: circle `#EAF3EC` / ring `#5E8F69`, cards `#C9DFCE`; Listen & Pick: a speaker with sound waves in a round pale-lavender circle, a purple icon matching the title: circle `#F0ECF8` / ring and strokes `#7B6BAE`; Sort It: a round pale-butter circle with two tiny baskets (circle `#FBF3D9`, ring `#A8842F`); Spot the Differences: a magnifier in a round pale-blue circle, a blue icon matching the title: circle `#EEF3F7` / ring and strokes `#5F86A8`; not buttons, not focusable, `aria-hidden`, clicks go to the card link); the Listen & Pick card art is a purple speaker with sound waves above three small rose, sky and butter picture squares; the Sort It card art is two small baskets with a star and a heart above them; the help popups are opened only from the in-game badges (see M1). Card colors: Quiz rose border and title, Memory Match sage (border `#A9CDB1`, title `#5E8F69`), Listen & Pick lavender (border `#C9BFE4`, title and icon ring `#7B6BAE`, icon circle `#F0ECF8`), Sort It butter-gold (border `#EAD9A0`, title and icon ring `#A8842F`, icon circle `#FBF3D9`), Spot sky blue (border `#A9C6DE`, title and icon ring `#5F86A8`, icon circle `#EEF3F7`). |
| M1 | Level select at `/games/memory`: five levels in one centered row: 12 cards (4x3 grid, needs 6 active cards), 16 (4x4, needs 8), 20 (5x4, needs 10), 24 (6x4, needs 12), 30 (6x5, needs 15); each level button is a mini grid of those small pink flower-back squares and shows its label "12 cards" / "16 cards" / "20 cards" / "24 cards" / "30 cards" under the picture (decorative, the child need not read it); a level without enough active cards is dimmed (label included); an empty pool shows a friendly picture screen. Help popup: a "? Memory Match" badge on this screen (the only way to open it; the game list card has a decorative icon only) opens the "How to play Memory Match" popup (4 steps: what it is, flip two cards, find the pair, hear the word); it shares its shell with the Quiz popup (`GameHelp`), and from this screen its last button (Play) only closes it. |
| M2 | Card faces: back is light pink with one small white/pale-yellow flower; face-up is the picture only, no written word (the word is only heard). |
| M3 | Flip (about 0.5 s) by click or Enter/Space, with a soft tick on every flip and flip-back. |
| M4 | Match: both cards stay up with a gentle bounce/sparkle, a "ting ting" chime, then the English word is spoken once. |
| M5 | No match: both visible about 1.2 s, then flip back; no penalty sound, no timer, no counter on screen; new flips are ignored meanwhile. |
| M6 | Replay: clicking a matched card plays its word again; the single face-up unmatched card does nothing. |
| M7 | Completion: the shared celebration scene (also used by the Quiz set-done page: hills, confetti, the child's character (see 4h), 3 stars), "You did it, <name>!", and "Total N times" with N highlighted instead of a card icon, shown ONLY at the end (face-down to face-up turns only; the fewest possible flips equal the number of cards: 12, 16, 20, 24, 30; not saved, no best score), play again / choose level. |
| M8 | Keyboard: all four arrows move over the grid, Enter or Space flips or replays, Esc goes back (`lib/keynav.ts`). |
| M9 | Reduced motion: no 3D flip and no bounce, the face just fades; sounds stay. |
| M10 | Robustness: missing picture shows a placeholder; no English voice means no spoken word; leaving the page cancels timers and speech; a third quick click is ignored; deck images are preloaded. |
| L1 | Entry: `/games/listen` plays directly (no level select). Registry entry `listen`, ready. |
| L2 | Round: 10 questions, each with a different answer card; two distractors are random other cards; the answer position (1/2/3) is random. |
| L3 | Voice: the word is said automatically when a question appears and again on speaker button / key R. Recorded file if the card has one, else `speakKid`. |
| L4 | Wrong pick: "Oh-Oh", the picture dims, wobbles and is disabled (wobble + Oh-oh popup), the word is said again after a short pause. |
| L5 | Right pick: "Hooray" (grow + ring + Hooray popup with confetti), the word is said once, then the next question. After question 10 the finish screen shows. |
| L6 | Finish screen: shared celebration scene (3 stars, the child's character (see 4h), confetti), "Wrong N times" with N highlighted, and two picture buttons: play again (new 10 questions), back to games. If any picks were wrong, a row of small round pictures with the English word and count ("apple x2"); tapping one says the word. No row when there were none. |
| L7 | Wrong-picks log in localStorage under one key (`childPlayer.listen.wrong`), entries `{id, word, count}`. It is written at every wrong pick. Cleared when a round starts (also after a reload, which starts a new round), on play again and on leaving to the game list. Blocked or failing storage: the game works and the list still shows from memory for that page visit. |
| L8 | Keyboard: 1/2/3 pick, Left/Right move, Enter/Space pick, R replays the word, Esc goes back. Visible focus ring. |
| L9 | Reduced motion: no bounce or slide, pictures just fade. Sounds stay. |
| L10 | Robustness: missing picture shows a placeholder; no English voice means no spoken word, game still works; leaving the page cancels timers and speech; clicks on a disabled picture or during the hooray pause are ignored; the question's images are preloaded. |
| R1 | Entry: `/games/sort` plays directly (no level screen). Registry entry `sort`, ready, between Listen & Pick and Spot. A "? Sort It" badge opens a "How to play Sort It" popup (opened only from that badge). |
| R2 | Round: two random usable groups (a group is usable when it has at least 4 active cards with different words); from each, 4 random cards: 1 is the example already in the basket, 3 are objects to sort. The 6 objects are shuffled in one row; which basket is left or right is random. No usable pair of groups: friendly picture screen, not an error. |
| R3 | Drag: pressing an object (primary button) lifts it (slightly larger, soft shadow), it follows the pointer, and the word is said (recorded file if the card has one, else `speakKid`). Releasing over a basket counts as a drop on that basket (the basket area, not only its slots). A press without movement is a tap: the word is said again and the object stays. Only one object is dragged at a time. |
| R4 | Right drop: "ting ting" (`chime`), the object settles into the next free slot of that basket, then the word is said once. |
| R5 | Wrong drop: `ohOh` sound, a non-blocking "Oh-oh… try again!" popup with the sad face (the same look as Quiz, 1.4 s), the object slides back to its place in the row. The wrong count goes up by one. Releasing outside both baskets: the object slides back, no sound, no count. |
| R6 | Voice: picking an object up, tapping an example or an object, and a right drop each say the word through `sayWord`; a newer word cuts the older one. |
| R7 | Finish: after the 6th right drop and its word (about 1 s pause) the shared celebration scene shows (3 stars, the child's character (see 4h), confetti, "You did it, <child name>!" with the same praise sound as the other games), the line "Wrong N times" with N highlighted (N may be 0), and two picture buttons: play again (a new round) and back to games. Nothing is stored. |
| R8 | Reduced motion: no lift animation, no slide or bounce; the object jumps back and the popup just appears. Sounds stay. |
| R9 | Robustness: a missing picture shows a plain placeholder and the object is still draggable; no English voice means no spoken word, the game still works; leaving the page cancels timers and speech and drops any drag in progress; with pointer capture the drag continues outside the window, and the object slides back when the pointer is released outside the baskets or the browser cancels the pointer (`pointercancel`); a second press during a slide-back or a right-drop settle is ignored; the round's pictures are preloaded. |
| R10 | Keys and focus: Esc goes to `/games`; every object, example and button is a real element with a visible focus ring, but dragging needs the mouse (see the decision below). |

Listen & Pick decisions: the round is fixed at 10 questions x 3 pictures; with 3-9 usable cards there is one question per card (7 cards = 7 questions), fewer than 3 shows a friendly picture screen; no migration, the game reuses `memory_cards` and the Cards admin page; wrong picks are stored only in localStorage key `childPlayer.listen.wrong` (never sent to the server), cleared on round start, play again and leaving; the finish screen shows "Wrong N times" and the wrong words.

Sort It decisions: the round is fixed (2 baskets, 6 objects = 3 per basket, plus an example card already in each basket); groups are admin-managed tags in the table `card_groups`, with one optional tag per card in `memory_cards.group_id` (never several); anon cannot read `card_groups` (the game needs only `group_id`); a group is usable with at least 4 active cards with different words; play is mouse-only with Pointer Events (no keyboard play, the one PO exception to the child-keyboard rule; Esc still goes back); only a sort into the wrong basket counts as a wrong drop (a drop outside counts nothing); nothing is stored (not even in localStorage). The game fetches cards with its own `fetchSortCards` (`lib/sort/cards.ts`), so Memory Match and Listen & Pick never select the new column.

## 3c. Phase 2: Spot the Differences (child)
Details for every row: `docs/superpowers/specs/2026-10-30-spot-the-differences-design.md`.
| ID | Requirement |
|----|-------------|
| S1 | Level select at `/games/spot`: a centered grid of picture-A thumbnails (active levels only, ordered by `sort_order` then `created_at`); click, Left/Right (and Up/Down) to move, Enter/Space to open, Esc back; visible focus ring; an empty pool or load failure shows a friendly picture screen. A "? Spot the Differences" badge (the only way to open it) opens the 3-step picture help popup (`SpotHelp`, built on `GameHelp`). |
| S2 | Progress: a row of dots above the pictures, one per difference, lit when found; no numbers, no text. |
| S3 | Correct tap on A or B: a circle grows slowly (about 0.6 s) on both pictures and stays until the level ends, the soft "ting ting" chime of Memory Match plays, the matching dot lights up. Hit radius is at least 5% of the picture width; the nearest not-yet-found difference wins; a tap on or outside the picture border is a miss. |
| S4 | Wrong tap: a faint ripple at the tap point (about 0.8 s); no sound, no counter, no penalty, no hint, no timeout. Hit radius is at least 5% of the picture width; the nearest not-yet-found difference wins; a tap on or outside the picture border is a miss. |
| S5 | Tapping an already found difference does nothing. Hit radius is at least 5% of the picture width; the nearest not-yet-found difference wins; a tap on or outside the picture border is a miss. |
| S6 | Completion: about 1 s after the last difference, the shared `CelebrationScene` with two picture buttons (play again, choose level); nothing is saved. |
| S7 | Keyboard: the game is mouse-driven; Esc goes back to the level grid; Enter/Space activate the focused button on the completion screen; visible focus ring. |
| S8 | Reduced motion: the circle and ripple appear without growing or fading; confetti follows the shared setting; sounds stay. |
| S9 | Robustness: a missing or failed picture shows a placeholder and the game stays leavable; leaving the page cancels timers and sounds; both pictures are preloaded before play; tap mapping stays correct after a window resize. |
| S10 | Sounds: the correct-tap "ting ting" is `chime()` from `lib/sfx.ts`, synthesized with Web Audio and shared with Memory Match (no audio files); music keeps playing; nothing plays before "tap to enter"; the wrong tap is silent. |

## 3d. Phase 2: Find It (child)
Details for every row: `docs/superpowers/specs/2026-10-30-find-it-design.md`.
| ID | Requirement |
|----|-------------|
| F1 | Entry: `/games/find` shows a grid of picture thumbnails (active levels only, `sort_order` then `created_at`), no text. Mouse, Left/Right (and Up/Down) to move, Enter/Space to open, Esc back, visible focus ring. Empty pool or load failure: friendly picture screen, not an error. A "? Find It" badge opens the "How to play" popup (shell `GameHelp`, `components/FindHelp.tsx`, 3 picture steps), opened only from that badge. |
| F2 | Play, `/games/find/[levelId]`: the picture centered and large (fits 1500x800 px of the 1920x1080 stage, aspect kept), a prompt bar above it with the current word (large, Baloo 2) and a speaker button, a row of progress dots (one per object, no numbers), back and music buttons. Nothing plays before "tap to enter". |
| F3 | Prompt: when the level opens (after a short pause) and after every found object, the app says the current object's word and shows it. Recorded file if the object has one, else the browser voice. The speaker button (and key R) says it again. A newer word cuts the older one. |
| F4 | Right tap: a tap inside the **current** object's circle (hit radius `max(r, 0.04)` of the picture width) plays `chime`, grows a ring (about 0.6 s) that stays on the object, lights its dot, and after about 1 s moves to the next object (prompt says and shows its word). |
| F5 | Wrong tap: any other tap (empty area, or another object) shows a faint ripple at the tap point (about 0.8 s). No sound, no counter. Repeat taps on a found object do nothing. |
| F6 | Completion: after the last object is found (about 1 s) the shared `CelebrationScene` shows (3 stars, the child's character (see 4h), confetti, praise sound) with two picture buttons: play again (same level, from object 1) and choose another level. Nothing is stored. |
| F7 | Keys: Esc goes back to the level grid (from the grid, to `/games`); R repeats the word; on the completion screen Enter/Space activate the focused button. Playing is by mouse. Visible focus ring. |
| F8 | Reduced motion: ring and ripple appear without growing or fading, the prompt changes without sliding. Sounds stay. |
| F9 | Robustness: a missing picture shows a plain placeholder and the level is still leavable; no English voice means no spoken word but the word is still shown; leaving the page cancels timers and speech; both the picture and the level's sounds are preloaded before the first prompt; window resize keeps tap mapping correct (coordinates from the picture's current bounding box); taps during the 1 s pause after a right tap are ignored. |
| F10 | A level whose data fails validation (fewer than 2 objects, a blank word) is skipped in the grid instead of crashing. |

## 4. Admin flow (desktop, Nunito)
| ID | Requirement |
|----|-------------|
| A1 | Sign-in with email + password. Wrong credentials show an inline error. Unauthenticated users cannot open admin routes. |
| A2 | Settings: child's name, upload greeting audio, optional own background music (with play-to-check; the built-in `public/seed/sounds/background-track.mp3` plays when none is set), optional custom sounds for Hooray, Oh-oh and You did it, save. |
| A3 | Set list: table of sets (name, question count, status draft/published) and a front-page preview strip that mirrors C3 using the same card component (ADR-023). Actions: new set, edit, delete. |
| A4 | Set editor: name, optional sub-title, heading color (6 presets + custom color picker + hex input, low-contrast warning), cover upload with live preview, status, question list. |
| A5 | Add/edit question: prompt text and/or prompt audio, prompt image (optional; PNG/JPG/WebP, max 2 MB, cropped to a square in the admin (A24), shown in a 300x300 frame, fitted not stretched, ADR-032); prompt audio is upload only (no recording); Save has a Revert button next to it; answer image button says "Upload image", 2-3 answers each with an image upload, exactly one marked correct; each question has a "Read the answers aloud" checkbox (default on) that controls only reading all answers after the question; the picked answer is always read; each answer may have a text that is read aloud when the child picks it (the Hooray / Oh-oh popup follows the reading); "Preview as child" opens in a new tab; the editor header with Save / Revert stays visible while scrolling. Completeness checklist shows what is missing; Save is disabled until complete (ADR-023). |
| A6 | Delete set and delete question always ask for confirmation. Questions are deleted only from the editor panel (ADR-022). |
| A7 | "Preview as child" is enabled after the set is saved; it plays the set as the child sees it, including drafts, without publishing (ADR-022). |
| A8 | Reorder questions with simple up/down buttons. |
| A9 | Quick import of questions from a JSON file (images blank, https URLs or raw SVG code), validated before anything changes (plan T16). Added after the first draft. |
| A10 | Storage hygiene: files are uploaded only on Save; replaced, removed or deleted media is freed from the bucket after a successful save (plan T15). Added after the first draft. |

## 4b. Phase 2: Cards admin (Memory Match, Sort It)
Details for A11-A13: `docs/superpowers/specs/2026-10-29-memory-match-design.md`; for A17-A19 and the A13 extension: `docs/superpowers/specs/2026-10-30-sort-it-design.md`.
| ID | Requirement |
|----|-------------|
| A11 | Card pool at `/admin/cards`: add, edit, delete (with confirmation), active toggle, picture + word + optional pronunciation; saved like A10. |
| A12 | Quick import of cards from a JSON file with a downloadable template, validated before anything changes (same rules as A9). The "Quick import cards" text button sits in the page header next to Revert and Save. |
| A13 | Pool health: shows which levels are available now and how many active cards each needs. Extended for Sort It: it also says how many groups can be played, for example "Sort It: 6 groups can be played (2 are needed, each with 4 cards)." |
| A17 | Manage groups: on `/admin/cards` a "Groups" area above the cards shows every group as a tag chip. Add a group by typing its name (1-40 characters, unique ignoring case and surrounding spaces), rename it, delete it (always with a confirmation, ADR-022; its cards become "no group"). Group edits are unsaved changes like card edits: Save writes groups first, then cards; Revert discards both. |
| A18 | Tag a card: each card has a "Group" picker listing the groups plus "No group" (no free typing). A warning (not a block) shows on a card whose group has fewer than 4 cards with different words ("Sort It needs at least 4"). |
| A19 | JSON import: each card may have `group` (optional string); blank or missing means no group; a name must match an existing group (ignoring case and spaces), otherwise an error with the card number tells the parent to create the group first (nothing is created by the import, nothing is imported on any error, same rules as A12). Wrong type or over 40 characters is an error too. `public/memory-cards-template.json` shows the key. |

## 4c. Phase 2: Spot admin (Spot the Differences)
Details for every row: `docs/superpowers/specs/2026-10-30-spot-the-differences-design.md`.
| ID | Requirement |
|----|-------------|
| A14 | Level list at `/admin/spot`: grid of all levels (thumbnail of A, number of differences, on/off); add, edit, delete (always with a confirmation, ADR-022). Order, collapsing and the Level number follow A27 (no reorder buttons). |
| A15 | Level editor: upload picture A and B (or SVG code); warns, does not block, when aspect ratios differ by more than 2% or when spots are small (radius below 6%), plus a permanent tip to make every difference big and clear (ADR-032: pictures are squares, so the landscape tip and the tall-picture warning are removed); marking tool on pictures A and B (click either picture to add a spot at that point, so both share one position; click a marker to select, radius slider 4%-12% of picture width, default 6%, Delete button), toggle to view picture B; Save disabled until both pictures are set and there are 3-10 differences; saved like A10 (T15: files uploaded first, database second, freed files after success, Revert discards edits). |
| A16 | "Preview as child" opens the real play screen with the authenticated client, so inactive levels can be tried (as T12). |

## 4d. Phase 2: Find admin (Find It)
Details for every row: `docs/superpowers/specs/2026-10-30-find-it-design.md`.
| ID | Requirement |
|----|-------------|
| A20 | Level list `/admin/find`: grid of all levels (thumbnail, number of objects, on/off). Add, edit, delete (always with a confirmation, ADR-022). Order, collapsing and the Level number follow A27 (no reorder buttons). New "Find" item in the admin nav. |
| A21 | Level editor: picture area with two ways to set the picture: "Upload" or "Choose from library" (A23). Click the picture to add an object at that point; each object is drawn as a circle with its **number** on it; click a circle to select it; a slider sets its radius (default 6%, range 3%-15% of picture width); a Delete button removes it. A side list shows one row per object in number order, with the same number, a **word** field (required, 1-40 chars), and a **sound** control: none / upload / choose from library, a play button and a clear button. Selecting a circle highlights its row and selecting a row highlights its circle. Deleting an object renumbers the rest, and the rows move with their circles. The parent can move an object up or down in the order (changes the numbers). Save is disabled until a picture is set, there are 2-12 objects, and every object has a word. A permanent tip: "use a clear picture where every object is big enough to click". A status line warns (never blocks) when a circle is smaller than 4% ("N objects are small and may be hard to click"). |
| A22 | Saving follows T15: picking a file only previews it; Save uploads new files first, then writes the database; Revert discards unsaved edits. Files replaced, removed or deleted are freed only if no other record uses them (A23). "Preview as child" opens the real play screen with the authenticated client, so inactive levels can be tried. |
| A23 | Library: a dialog listing every picture (for the picture) or sound (for an object sound) in the media bucket, used or not (A29), with a preview or play button. Choosing one stores the same path (no copy). Because files are shared, **before any file is deleted from the bucket** (on this game's save/delete and also on the existing Cards, Quiz sets and Spot saves/deletes) a shared guard checks that no other record still references the path; a referenced path is kept. Seed paths and external links are never listed and never deleted (existing T15 rule). |
| A24 | Crop before upload (ADR-032): every bitmap picture (PNG, JPG, WebP) the admin uploads opens a crop window (a square the parent moves and resizes, with Save and Cancel; Esc cancels). The picture is saved as a square WebP, at most 1024 px per side. Cancel uploads nothing. SVG files are not cropped. |
| A25 | Spot the Differences: picture B starts from the square chosen for picture A in the same editing session, so both pictures show the same region. A picture chosen from the library is not cropped and gives no starting square. |
| A26 | Pictures uploaded before ADR-032 are not re-cropped. They are shown fitted inside the square frame (`object-fit: contain`), so nothing overflows. |
| A24 | Every admin upload of a picture or sound (Cards, Spot, Question and its answers, Set cover, Settings avatar, greeting, background music and feedback sounds) also has "Choose from library", which opens the library dialog (A23) and points the field at the chosen path. Nothing is uploaded and no file is copied. The Upload button stays. |
| A25 | In the library's sound list (and the Find It object sound), each sound has a play / pause toggle. One preview plays at a time: starting another stops the first; pause keeps the position; closing the dialog or leaving the page stops it. |
| A26 | Reuse keeps files safe: choosing a library file deletes nothing. Replacing or removing a picture or sound still goes through the A23 reference guard, so a file that another record still uses is kept. |
| A27 | Find and Spot level lists: each level is collapsed to its header (title, on/off, Preview as child, Delete) and small picture(s); the editor controls (choose/paste picture, markers, tip) show when it is opened. A new level starts open. A level missing data shows an "Incomplete" badge. Levels are listed by **creation date**, newest first by default, with a sort icon button that reverses it; a level's number is its creation order, so a new level is "Level <last>". There are no up/down buttons; Save writes `sort_order` in creation order. |
| A28 | Library dialog actions: **Sort by** select ("Created (newest)" default, by the upload id in the name, or "Name (A to Z)"); **rename** by double click on the name (text box, name selected, only the name part is editable, the upload id and extension stay); Enter or leaving the box saves, Esc cancels, an unchanged name does nothing; success or error shows a toast. Rename is optimistic (the list changes at once and is put back on error), each file independently. It moves the file in the bucket, points every record at the new path, and open admin pages replace the old path in their unsaved edits. A renamed file keeps its place in "Created" order. |
| A29 | The library dialog and the Media page (A31) list **every** file in the media bucket (pictures: png, jpg, webp, svg; sounds: mp3, m4a, wav), used or not. Bundled `seed/` art and external links are not in the bucket and are not listed. |
| A30 | Library **delete**: a trash button per file. Click shows the toast "Validating before delete.", and the file turns inert and dimmed with "Validating..." beside the button (play, choose, rename and view are off). If any record uses it, a warning toast says so and the file is kept; otherwise a confirmation is asked and then the file is deleted ("Deleting..." while it runs). Delete is never optimistic. Files are independent: starting or finishing a delete on one never changes another. **View:** one click on a picture opens it at full size (Esc, close button or click outside closes only the viewer). Loading shows the bundled fish over soft water ripples, with no visible words (a screen reader hears "Loading…"); the same wait is used on every admin screen (A36). Still when reduced motion is on. |
| A31 | Media page `/admin/media` (nav item below Settings): two tabs, "Image library" and "Sound library", each with an icon, showing the same list and actions as the dialog (A28-A30, A24 crop for bitmap uploads; a sound uploads directly) without choosing or OK. |
| A32 | Celebration pictures (Child form, "Celebration pictures" A and B) are the exception to the square crop (A24): an upload is cropped to the celebration frame, 340 x 600 px (width : height about 3 : 5, tall), the same frame the scene shows (`CELEBRATION_FRAME`, `lib/celebration.ts`), so nothing is left empty or cut on screen. The form tells the parent to use a picture with a transparent background (PNG or WebP); the transparent area stays transparent after the crop. A JPG has no transparency. Choosing from the library gives no crop (A25). |

## 5. Data model (Supabase / Postgres)
Column names are as built in `supabase/migrations/*.sql`.
- `settings` (single row): `child_name`, `greeting_path`, `music_path`, `music_volume`, `avatar_path`, `hooray_path`, `ohoh_path`, `complete_path`.
- `quiz_sets`: `id uuid pk`, `title text not null`, `subtitle text null`, `heading_color text not null default '#5A4038'`, `cover_path text null`, `status text check in ('draft','published') default 'draft'`, `position int`, `created_at`.
- `questions`: `id uuid pk`, `set_id uuid fk on delete cascade`, `position int`, `prompt_text text null`, `prompt_image_path text null`, `prompt_audio_path text null`, `read_answers bool default true`.
- `answers`: `id uuid pk`, `question_id uuid fk on delete cascade`, `slot int check 1..3`, `image_path text not null`, `text text null`, `is_correct bool`. Unique `(question_id, slot)`; exactly one correct per question (enforced in app + constraint/trigger).
- `quiz_sets` also has `updated_at`.
- `memory_cards` (Memory Match, M1-M10, A11-A13): `id uuid pk`, `word text not null` (1-40 chars, English), `image_path text not null`, `audio_path text null` (no recording: the English kid voice says the word), `active bool default true`, `created_at`. Anon reads active cards only; only the admin inserts/updates/deletes (RLS). Pictures and recordings live in the `media` bucket. Seeded sample cards: 31 (`seed/*.svg`, bundled in `public/seed`): 21 everyday and shape cards plus 10 school and home cards (ruler, pencil, pen, eraser, book, scissors, backpack, cup, chair, clock; migration `20261030000000_memory_cards_school_home.sql`).
- `card_groups` (Sort It, R1-R10, A17-A19; migration `supabase/migrations/20261030110000_card_groups.sql`): `id uuid pk`, `name text not null` (1-40 chars after trim), `created_at`; unique index on `lower(btrim(name))`. Only the admin may select, insert, update or delete (RLS); anon has no access. New column `memory_cards.group_id uuid null references card_groups(id) on delete set null` (one tag per card). The migration is additive and idempotent and seeds six groups (food, animals, shapes, school, home, nature) and tags 29 seeded cards; `ball` and `car` stay untagged. It is reported applied to the real Supabase project (plan ST-T14).
- `spot_levels` (Spot the Differences, S1-S10, A14-A16): `id uuid pk`, `image_a_path text not null`, `image_b_path text not null` (both in the `media` bucket), `differences jsonb not null` (array of `{x, y, r}`; `x`, `y` are fractions of picture width/height and `r` is a fraction of picture width; 3-10 entries, check constraint), `active bool default true`, `sort_order int default 0`, `created_at`. Anon reads active levels only; only the admin inserts/updates/deletes (RLS). Seeded sample levels: 3 (garden, farm, sea; `seed/spot/*.svg`, bundled in `public/seed`; migration `20261030100000_spot_levels.sql`).
- `find_levels` (Find It, F1-F10, A20-A23; migration `supabase/migrations/20261030120000_find_levels.sql`, not yet applied to the real Supabase project): `id uuid pk`, `image_path text not null` (in the `media` bucket), `objects jsonb not null` (array in play order of `{x, y, r, word, audio_path}`; `x`, `y` are fractions of picture width/height and `r` is a fraction of picture width; 2-12 entries, check constraint; `audio_path` string or null), `active bool default true`, `sort_order int default 0`, `created_at`. Anon reads active levels only; only the admin inserts/updates/deletes (RLS). No seed level. The number shown to the admin is the array index + 1, not stored.
- `puzzle_pictures` (Puzzle Pairs, H1-H12, A32-A35; migration `supabase/migrations/20261108000000_puzzle_pictures.sql`, not yet applied to the real Supabase project): `id uuid pk`, `word text not null` (1-40 characters trimmed), `image_path text not null`, `audio_path text` null, `active bool default true`, `sort_order int default 0`, `owner_id uuid` null (default `auth.uid()`, null for the seed rows), `created_at`. Everyone reads active rows; only a Super Admin reads inactive rows and writes (RLS). Seed: fish, triangle, house, apple (`seed/<word>.svg`). Both paths count as used media (A34).
- Storage bucket `media`: public read, write only by admin; images (PNG/JPG/WebP/SVG) and audio.
- Progress (star and finished-question dots): stored in the browser's localStorage, keyed by set id (decided); no user identification.
- RLS: anon can `select` settings, published sets and their questions/answers; only authenticated admin can insert/update/delete everything, including drafts and storage writes. Service role key never in the frontend (ADR-015). Schema changes only via migrations (ADR-008).

## 6. Design tokens (from prototype)
Ground `#FBF4E9`, ink `#5A4038`, rose `#E59AA1`/`#F8DCDF`, sky `#8FB3D1`/`#DCE8F1`, butter `#E5C979`/`#F7ECCB`, sage `#9CC3A4`, peach `#F5D9C4`. Fonts: Baloo 2 (child), Nunito (admin), self-hosted.

## 7. Non-functional
- Stack: Next.js + React + TypeScript on Vercel, Supabase backend (ADR-027).
- Latest Chromium-based browser on a computer (ADR-012, ADR-028). The laptop keyboard is fully supported for the child: keys 1/2/3, Left/Right arrows to move between choices, Enter or Space to pick, Esc to go back. Mouse works too.
- Large, friendly buttons for a small child and a visible focus ring (kept in the UI, no longer tied to a TV).
- Preload images for the next question and a 3 s start: **not built, parked** (`plan.md` section 4).
- Audio manager shared by music, voice and effects; music keeps playing across screens.
- Setup README: a second child's deployment from README only (env vars: Supabase URL + anon key).

## 8. Definition of done (Phase 1)
1. Child goes from Welcome to the end of a set without anyone reading to her.
2. A parent creates a set with at least 5 questions in under 10 minutes.
3. A second child's deployment is set up from the README with no code changes.

## 9. Decisions on the former open questions (2026-10-28)
- Star progress: localStorage (as built; no identity).
- No greeting/music uploaded: silent (as built).
- Replaying a finished set: fixed order (as built).

## 4e. Phase 4: Super Admin people pages (2026-11-06)
Spec: `docs/superpowers/specs/2026-11-06-super-admin-people-design.md`. Parents list, Parent detail, Children grid, Messages tabs, sidebar dots.
- N10 Parents list: sort (newest or A–Z), search by parent or child name, storage bar (green <70%, orange 70–85%, red >85%), child count.
- N11 Parents list: expand/collapse all, expand to children, red "Ban" tag when banned.
- N12 Parents list: red dot on parents with pending messages; toggle filter.
- N13 Parents list: create parent (dialog), then open its detail page.
- N14 Parent detail (`/admin/parents/[id]`): Ban/Unban, quota, children (add/edit/remove), view-only levels.
- N15 Children page: 2-column grid, parent link with Ban tag, search and sort.
- N16 SA adds/edits children with non-media fields only; media is hidden.
- N17 Messages: Pending and History tabs, search and sort by parent.
- N18 Sidebar: All content removed; "Children" renamed; red dot on Messages.

## 4f. Phase 4: review per game and Super Admin copies (2026-11-06)
Spec: `docs/superpowers/specs/2026-11-06-review-copy-design.md`. Review tab per game, approve creates a Super Admin copy, parents' published tab.
- V8 Approve creates a global copy owned by the Super Admin; the parent's original goes back to private (the parent keeps editing it). The family sees only the original.
- V9 Super Admin tabs per game: Mine, Review queue (red dot with count), Parent published (view only, every parent's published or active row with the owner's name). A family never sees its own original twice (the copy is dropped for that family).
- V10 Super Admin publishes own private rows without review (publish_own) and unpublishes them; a parent's row shows "Global copy" when a copy exists.
- V11 The copy references the parent's media paths and adds 0 bytes to the Super Admin's quota. The owner cannot rename a file a copy uses; delete is refused while a copy uses it.
- V12 A quiz copy is inserted as draft, then its questions and answers are copied, then the status is set (publish gate).
- V13 One-time backfill: null-owner rows go to the first Super Admin; each global row a parent owns becomes a copy and the parent's row goes back to private.
## 4g. Phase 2: Caro X O for two players (2026-11-06)
Spec: `docs/superpowers/specs/2026-11-06-caro-xo-design.md`. A 30x20 board, five in a row wins, two players on one computer. The child is X (boy) or O (girl); the opponent is the parent's initials against a human; the prince or princess against the robot.
- X1 30x20 board of cells (38 px), centred on the stage.
- X2 Turns alternate, X first; an occupied cell or a finished round does nothing.
- X3 Two sides: the child on the left (avatar, then mark), the opponent on the right (against a human, the parent's initials; against the robot, the prince or princess; then the other mark).
- X4 The side whose turn it is bounces and its mark wiggles; reduced motion stops both.
- X5 Five in a row wins; the five cells are highlighted. The sound and screen depend on who won (X11, X12).
- X6 A full board with no five in a row is a draw (no message, no penalty).
- X7 Play again (drawn arrow, no text, top centre) starts a new board after the round ends.
- X8 Keyboard: arrows move between cells, Enter or Space place, Esc goes back.
- X9 Registered on the game registry (ADR-014) with a drawn 3x3 board and the word "Caro" on the card, and the round icon.
- X10 "? Caro" button at the top right opens the how-to-play popup (3 steps).
- X11 The child wins: the win line lights for 1 s, then full-screen Hooray for about 3 s, then the board with the win line and a blue Play again.
- X12 The opponent wins: the win line lights for 1 s, then the Oh-oh toast for about 1.4 s, then the board with the opponent's line lit and a blue Play again. No retry popup.
- X13 The first screen after choosing Caro: a blue button (the child's picture, "vs", the parent's initials; "human" is the two-player game, X1-X12) and a yellow button (the child's picture, "vs", a robot icon). The button names are for screen readers only; the child sees pictures and the robot icon.
- X14 The robot plays the other mark (the child is X or O as before, X starts). It moves after a short think (0.9 s); the board is inert while it is due, so the child cannot place its mark.
- X15 The robot is medium: it always takes a win it can see and always blocks a four (the child's four in a row with the fifth cell open); otherwise it picks one of the three best cells by line scores, at random (`lib/caro/robot.ts`).
- X16 A win or draw against the robot ends the round like X5-X7 (Hooray or Oh-oh by who won); Play again starts a new round against the robot.

## 4h. "You did it" characters (parent feedback, 2026-11-06)
The shared celebration scene (`CelebrationScene`, used by the done screens of Quiz, Memory, Sort It, Spot, Find It and Listen & Pick) shows one or two characters on the left and right, by these rules:
- No upload: one built-in character on the left: the prince for a boy, the princess for a girl. Nothing on the right.
- Only one picture uploaded (A or B): the built-in character stays on the left, the uploaded picture goes on the right.
- Both pictures uploaded: A on the left and B on the right; no built-in character.
- Nothing is shown until the child's pictures and gender have loaded.
Rules in `lib/celebration.ts` (`celebrationSlots`).

## 4j. Parent Profile and Inbox (2026-11-07)
Spec: `docs/superpowers/specs/2026-11-07-parent-profile-inbox-design.md`. Plan: `docs/superpowers/plans/2026-11-07-parent-profile-inbox.md`. A parent's own details (name, phone, picture) and their children, and an Inbox to contact the Super Admin.
- PR1 `profiles.phone`: optional; after trim, 8 to 20 characters of digits, spaces, `+ ( ) . -`, at least 8 digits. No country-code check.
- PR2 `profiles.avatar_path`: the parent's picture (square, A24), counted in the parent's quota. The path must sit in the parent's own folder (checked by the database).
- PR3 `profiles.display_name` is 1 to 40 characters after trim (checked on new writes).
- PR4 A parent may update only `display_name`, `phone` and `avatar_path`. `role`, `banned` and `quota_bytes` stay out of reach.
- PR5 The update policy covers the own row only, and a banned parent cannot update it.
- PR6 Name: required, 1 to 40 characters. PR7 Phone: optional, validated as PR1. PR8 Email: read only, from the sign-in account. PR9 Picture: chosen from the library with a square crop; the initials show when there is no picture. PR10 One Save writes all fields; not optimistic.
- PR11 The children section is part of Profile (the same cards and dialogs as the old Children page). `/admin/children` and `/admin/settings` redirect to `/admin/profile`.
- PR12 Parent sidebar: Profile and Inbox, in place of Children. PR13 The Super Admin also has Profile (name, phone, picture; no children section). PR14 The collapsed sidebar keeps tooltips and names.
- IN1 Inbox page `/admin/inbox` for parents. IN2 A highlight: this is a feedback mailbox; the Super Admin replies as soon as possible, by email or by phone. IN3 Contact line: email and phone, or a link to add a phone number. IN4 Compose form, at most 5 messages in 24 hours (form off at the limit, rate-limit text on refusal). IN5 The form is shared with the suspended page. IN6 The parent's messages with status: Sent, Read, Resolved. IN7 Empty state text. IN8 The list shows only the parent's own rows (RLS).
- SA1 `super_admin_parent_contacts()`: the parents with their sign-in email and phone, for a Super Admin only; the email is read from the account, never stored in `profiles`.
- SA2 Messages page: the sender's email (mailto) and phone (tel) beside each message, or "No phone number". SA3 The contacts are read once with the page; if they fail, the messages still show with a note.
- PT1-PT3 Tests: unit (validation, data, form, Inbox, sidebar, redirects), database (RLS, column grant, policy, function), e2e (`parent-profile`, `admin-parent-inbox`).
## 3e. Phase 2: Puzzle Pairs (child, 2026-11-07)
Design: `docs/superpowers/specs/2026-11-07-puzzle-pairs-design.md` (mockup in `docs/superpowers/mockups/`). Built on the integration branch `claude/phase2/puzzle-pairs`. Joining halves is mouse only (ADR-037).

| ID | Requirement |
|---|---|
| H1 | Entry: `/games/pairs` plays directly (no level select). Registry entry `pairs`, ready. Game list card with its own color (proposed berry: border `#E3B5CF`, title and icon ring `#A2577F`, circle `#F8EAF2`; final values from the screenshots the PO approves) and a decorative two-halves icon (`aria-hidden`). A "? Puzzle Pairs" badge opens "How to play" (`GameHelp`, 3 steps). |
| H2 | Level: 4 pictures from the active `puzzle_pictures` (pictures with the same word, trimmed and ignoring case, count once). Each picture gives a left (`L`) and a right (`R`) half; the 8 halves are shuffled into slots 0-7 of a 2 x 4 grid, all face down. When more than 4 pictures are on, a new level is never the exact same 4 as the level before. |
| H3 | Tap (or Enter/Space on the focused half) on a face-down half opens the question modal. Ignored while a modal is open, while a join is animating, or on a face-up half. |
| H4 | Question draw: Quiz or Listen & Pick with equal chance; when one source has nothing, the other is used; when both are empty the half turns over without a question. Never the same question twice in a row. Quiz questions are the ones the Quiz game would play (prompt text or prompt sound, at least 2 answers, each with a picture or text, exactly one right). Listen questions need at least 3 cards with different words. |
| H5 | Modal: the question as in its own game (Quiz: prompt picture/text/sound and 2-3 answers; Listen & Pick: big speaker and 3 pictures), number + fixed color answers (1 rose, 2 sky, 3 butter). The prompt is said automatically after a short pause and again with the speaker button or R. X top right (`ModalClose size="child"`), Esc and a backdrop click close it; the half stays face down and the next open draws a new question. |
| H6 | Wrong pick: "Oh-Oh" (custom `ohoh_path` as in Quiz), the answer dims and is disabled, the "Oh-oh... try again!" popup shows for 1.4 s; Listen & Pick says the word again after a short pause. |
| H7 | Right pick: "Hooray" (custom `hooray_path`), the answer grows with a ring; after 1.2 s the modal closes and the half turns over (a 0.56 s horizontal flip; a fade under reduced motion). |
| H8 | Drag: only face-up halves, primary button, starts after 8 px of movement. What counts is where the dragged half is drawn (the centre of its visible half), not the pointer. While dragging, the face-up half under it glows (join target), and its own other half glows as soon as the two are within 240 stage px (centre to centre, the "magnet"). A face-down half or an empty slot under it for 0.6 s (changed from 0.2 s after the PO's play-test, 2026-11-07) makes the halves slide so the dragged half takes that slot; never while its other half is within the magnet. A drop outside the board, or a release without a target, puts it in the slot it is shown in. |
| H9 | Join: dropping a half on the other half of the same picture, or anywhere within the 240 px magnet of it, slides both into the whole picture at the target's slot, plays the chime, says the word (`sayWord`: recording if `audio_path`, else kid voice), then moves the whole picture to the next free shelf place (4 places above the board) and the remaining halves close the gap in grid order. A drop on any other face-up half slides back with no sound. |
| H10 | Finish: 0.9 s after the 4th picture lands on the shelf, the shared `CelebrationScene` (stars, confetti, the child's celebration pictures) with the 4 pictures and two picture buttons: new level (H2 draw again) and back to `/games`. Each of the 4 pictures is a button: a tap (or Enter/Space) says its English word again (`sayWord`, stopping the praise sound first); Left/Right move over the pictures and the two buttons (added after the PO's play-test, 2026-11-07). The "custom You did it" sound applies as in Quiz. |
| H11 | Keyboard: Left/Right (and Tab) move between halves in grid order, Enter/Space on a face-down half opens the question; in the modal 1/2/3 pick, Left/Right move, Enter/Space pick, R replays, Esc closes; Esc outside the modal goes to `/games`. Joining is mouse only (ADR-037). Visible focus ring everywhere. |
| H12 | Robustness and calm: fewer than 4 usable pictures or a load failure shows the friendly picture screen (like Listen & Pick); a missing picture shows a placeholder; no English voice means no spoken word; leaving the page cancels timers and speech; the level's pictures are preloaded; reduced motion keeps only fades. No timer, no score, no counter on screen. |

## 4i. Phase 2: Puzzle Pairs admin (Super Admin, 2026-11-07)

| ID | Requirement |
|---|---|
| A32 | Super Admin page `/admin/puzzle` ("Puzzle Pairs pictures"), in the Super Admin route group (parents get the no-permission screen, like the other Super Admin pages). Sidebar: the "Puzzle" link sits in the "Game settings" group after Find, shown only to a Super Admin (PO, 2026-11-07). A table: picture, English word (1-40 characters), sound (optional, Sound Library; play button; empty = "Kid voice reads the word"), On switch, remove. "Add from Image Library" opens the library pop-up and adds one row per chosen picture with an empty word. Save and discard like the Cards page; Save is disabled when nothing changed or a row is incomplete (no picture or no word). |
| A33 | A status chip shows "N on · ready" (green) when at least 4 pictures with different words are on, else "N on · needs at least 4" (rose). Two rows with the same word get the duplicate warning used on the Cards page (save is still allowed). |
| A34 | Media: `puzzle_pictures.image_path` and `audio_path` count as used. A file used by the list cannot be deleted from the library, renaming it re-points the rows (`MEDIA_SOURCES`, `media_in_use`, `media_used_by_others`). |
| A35 | Seed: four active rows, `fish`/`seed/fish.svg`, `triangle`/`seed/triangle.svg`, `house`/`seed/house.svg`, `apple`/`seed/apple.svg`, no sound; the migration skips a row whose `image_path` already exists. |
| A36 | Every admin wait (Profile, Cards, Find, Spot, Puzzle, Global content, Set editor, Parent detail, Media library) shows the same fish over soft ripples (`AdminLoading`), with no visible words. A screen reader hears "Loading…" (Profile: "Loading your profile…"). Reduced motion keeps the fish still. |

## Guest Play and No-Select (2026-11-08)

Full spec: `docs/superpowers/specs/2026-11-08-guest-play-design.md` (approved mockup v7 changes in its section 5.1).

- **NS1** Child screens paint no text selection and drag no picture: one `.hm-child` rule in `app/globals.css`; inputs keep normal selection.
- **NS2** `.hm-child` is on `Stage` (Welcome, `/games`, every game, `/play`) and on `/play/sign-in` and `/play/guest`. Admin never gets it.
- **NS3** `Pic` renders `draggable={false}`; games that drag with pointer events are unaffected.
- **NS4** PIN and email inputs keep normal selection, copy and paste.
- **GU1** `/play/sign-in` is a chooser: Log in (the parent form, in place) and Guest (`/play/guest`); arrows and Enter/Space.
- **GU2** `/play/guest` step 1: "Who are you?" and Boy/Girl cards with the head pictures; Left/Right move, a click picks.
- **GU3** The pick glides the card to the header avatar (about 600 ms); the form follows 200 ms later; reduced motion is a cross-fade.
- **GU4** Details: name (1-20 characters after trim), age 2-5 or 5-10 (stored only), OK goes to Welcome; the X returns to Boy/Girl and keeps the name.
- **GU5** A visitor plays Welcome, `/games` and every game as the child, with the gender's colours and head.
- **GU6** `lib/visitor.ts`: localStorage `cp_visitor` plus cookie `cp_visitor=1`; a bare cookie is not a visitor.
- **GU7** Leave asks the two-digit sum (`AdultCheck`); a right answer stops the music, clears the visitor and goes to the chooser.
- **GU8** A parent sign-in (play or admin) clears the visitor; a signed-in parent never sees the chooser.
- **GU9** Middleware: `/play/guest` open; `/play/sign-in` with a profile goes to `/play`.
- **GU10** No profile and a visitor cookie: `/` and `/games/*` open, `/play` goes to `/`, `/admin` goes to sign-in.
- **GU11** The cookie only opens pages; RLS decides data.
- **GU12** A visitor writes nothing: no insert, update, upsert, rpc or upload; synthetic child settings; `playerId()` null.
- **GU13** `20261108300000_guest_anon_read.sql`: anon reads global published/active rows of `quiz_sets`, `memory_cards`, `spot_levels`, `find_levels`, `card_groups`, and their questions and answers; no function grant.
- **GU14** `public/images/prince-head.webp` and `princess-head.webp`, 320 px, round.
