# Plan: HaMy Phase 1 (Quiz MVP + Admin)

Source: `spec.md` (requirement IDs C1-C12, A1-A8), `docs/decision.md` (ADRs). Stack per ADR-027: Next.js + React + TypeScript, Supabase, Vercel.
Status: **Phase 1 CLOSED 2026-10-28 (PO decision).** All tickets below are built and deployed except the leftovers in section 4, which are parked. The platform is a computer browser (child may cast it to a TV, which is not a requirement; ADR-028), so all TV and webOS work was removed from scope.

## 1. Decisions to confirm
Recommended defaults; the owner can override before T0 starts.

| Topic | Default |
|-------|---------|
| Router | Next.js App Router, TypeScript `strict` |
| Styling | Plain CSS Modules + CSS variables for the spec section 6 tokens. No Tailwind (light bundle) |
| Data access | Child routes are client-rendered and read-only through the Supabase anon client. Admin under `/admin/*`, guarded by middleware + Supabase Auth (`@supabase/ssr`) |
| Browser targets | `browserslist` in `package.json` (Chrome >= 80, last 2 Edge/Firefox). Kept as is; it no longer comes from a TV requirement (ADR-012, ADR-028) |
| Tooling | npm; Vitest + Testing Library (unit); Playwright (key flows); ESLint + `tsc --noEmit` |
| Migrations | Supabase CLI, `supabase/migrations/*.sql` (ADR-008) |
| Open spec questions | Decided and built: star progress in localStorage; silent when no greeting/music; fixed question order; up/down buttons for reorder (A8) |

## 2. Architecture sketch
- `app/(child)/`: Welcome, game list, set selection, question, completed. Read-only, unauthenticated.
- `app/admin/`: sign-in, settings, set list, set editor, question editor, preview. Authenticated.
- `lib/supabase/`: browser client (anon) and server/middleware client. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; never the service role key (ADR-015).
- `lib/audio/`: one audio manager for music, voice, effects; music persists across screens (ADR-016).
- `lib/games/registry`: game list reads from a registry; Quiz is the only entry (ADR-014).
- `components/`: `SetCard` (shared by child and admin preview, ADR-023), `Confetti` (shared, dense variant for completed, ADR-026), `AnswerCard` (fixed slot colors, ADR-019).
- RLS: anon `select` on settings and published sets with their questions/answers; authenticated admin does everything including storage writes. Draft preview uses the authenticated client (ADR-022).

## 3. Tickets
Done only when every Acceptance Criterion (AC) passes.

### T0 Scaffold
Next.js + TS app, scripts (dev, build, lint, typecheck, test, e2e script placeholder), `browserslist`, self-hosted Baloo 2 and Nunito, design tokens, global focus ring and `prefers-reduced-motion` base.
- AC: install, dev, build, lint, typecheck and test all run clean on a fresh clone.
- AC: Vietnamese diacritics (e.g. "Hà My ơi, bé ngoan") render correctly in both fonts with no CDN request.
- AC: `CLAUDE.md` "Commands" updated with the real commands, including single-test and migrations.

### T1 Schema, RLS, storage (spec 5; ADR-008, 015, 024)
- AC: migrations create `settings`, `quiz_sets`, `questions`, `answers`, bucket `media`, with unique `(question_id, slot)` and exactly-one-correct enforced by constraint/trigger.
- AC: as anon, only settings and published sets/questions/answers are readable; every write is denied.
- AC: as admin, all writes succeed, including drafts and storage uploads. Storage policy rejects non-image types and files over 2 MB for images.
- AC: migrations apply cleanly to an empty Supabase project.

### T2 Admin sign-in (A1)
- AC: valid email + password opens admin; wrong credentials show an inline error.
- AC: unauthenticated visits to any `/admin/*` route redirect to sign-in.

### T3 Admin settings (A2)
- AC: save child name; upload greeting audio and background music; each has play-to-check.
- AC: values persist after reload and are readable by the child app.
- AC: "Feedback sounds" section: optional custom audio track for "Hooray", "Oh-oh" and "You did it", each with a play button (previews the custom track, or the built-in sound when none is set; every row toggles play / pause icons the same way as greeting and music), Replace, and "Use built-in" (columns `settings.hooray_path`, `ohoh_path`, `complete_path`).

### T4 Admin set list and preview strip (A3; ADR-023)
- AC: table shows name, question count, draft/published; actions new, edit, delete (with confirmation).
- AC: preview strip renders with the same `SetCard` component as the child screen.
- Tests: `tests/SetsPage.test.tsx` (TC1-TC9: table columns, incomplete count, New/Edit links, delete confirm/cancel/confirm/error, preview strip with `SetCard`, empty states).

### T5 Set editor (A4; ADR-020)
- AC: name, optional sub-title, status, 6 color presets + picker + hex input, low-contrast warning.
- AC: cover upload with live preview; saved set reflects in the preview strip.

### T6 Question editor (A5, A6, A8; ADR-022, 024)
- AC: prompt text and/or audio, 2-3 answers each with an image, exactly one correct.
- AC: question image is optional and small: 600x300 px frame (2:1), fitted not cropped, SVG (best) / PNG / JPG / WebP, max 2 MB; its absence never blocks Save.
- AC: prompt voice is upload only (mp3/m4a/wav); no in-browser recording.
- AC: a "Read the answers aloud" checkbox per question (default on, column `questions.read_answers`); when off, only the question is read and the answers are not read one by one after it. The answer the child picks is always read aloud, regardless of the checkbox.
- AC: each answer has an optional text field ("Answer text (read aloud)"); it is saved with the answer and does not block completeness.
- AC: a "Hide the answer text" checkbox per question (default off, column `questions.hide_answer_text`, migration `20261029000000_questions_hide_answer_text.sql`) sits next to "Read the answers aloud". When on, the child's answer cards show only the picture (and the number), never the answer text. It does not change the reading: with "Read the answers aloud" on the answers are still read one by one, and the answer the child picks is always read aloud. The JSON import accepts an optional `hideAnswerText` (true/false) per question.
- AC: the checkbox options in the editors ("Published", "Read the answers aloud", "Hide the answer text") share one component (`CheckOption`): the box is always 20x20 px and is never squeezed by a long hint, so every option looks the same at any window width.
- AC: the sticky page header keeps Save, Revert and Preview as child visible while scrolling the set and question editors.
- AC: "Preview as child" opens the child quiz in a new browser tab.
- AC: the answer image button reads "Upload image" (also "Upload" when empty), never "Replace image".
- AC: a "Revert" button sits next to "Save" and discards unsaved edits back to the last saved state.
- AC: completeness checklist lists what is missing; Save is disabled until complete.
- AC: delete question only from the editor panel, always with confirmation.
- AC: up/down buttons reorder questions and the order persists.
- AC: creating a 5-question set takes under 10 minutes (timed manual check, DoD 2).

### T7 Audio manager and Welcome (C1; ADR-016)
- AC: no audio plays before "tap to enter"; after the press the greeting plays, music loops, then "Start game" appears.
- AC: child name from settings and the princess illustration show; missing audio is silent without errors.
- AC: music on/off button is always visible at the bottom-left of Welcome and toggles music by click.
- AC: music keeps playing across all later screens.

### T8 Game registry and carousel (C2; ADR-014, 018)
- AC: only "Quiz" is listed, from the registry.
- AC: Left/Right keys, click-and-hold drag, arrow buttons and dots all move it; a drag never triggers the card click; Enter/click opens the game.
- AC: the carousel dots are real buttons (large hit area, visible focus ring, `aria-current` on the active one): clicking or pressing Enter on a dot moves the carousel to that game; the dot visuals are unchanged.
- AC (replaced by the PO decision in feedback 3 F4: the tutorial is opened inside the game from the "? Quiz" badge; the game list card shows a decorative round "?" icon only, `aria-hidden`, not a button, clicks go to the card link) ~~the "?" on the Quiz card is a real button (not part of the card link, so it never starts the game; large hit area, gentle pulse, visible focus ring). It opens a "How to play Quiz" popup (`components/QuizHelp.tsx`) with a backdrop: a short description plus a 4-step carousel (What is Quiz? / Listen first / Pick an answer / Fill the dots) with small pictures, Previous/Next buttons, clickable step dots, Left/Right keys, a "Play" button on the last step that opens the Quiz, and a Close button. All its buttons are large.~~
- AC (the popup is now opened from the "? Quiz" badge on set selection, see T9): Esc, the Back key, the Close button and a click on the backdrop close the popup and return focus to the badge; while it is open Esc never leaves the page.
- AC: on the game list the child's avatar is large (150 px) in the top-right corner; tapping it pops a light-pink cloud speech bubble with "Let's play with me!" (one constant, `AVATAR_SAY` in `components/AvatarSay.tsx`) that goes away by itself after about 4.5 s; tapping again shows it again; no audio is played; with `prefers-reduced-motion` the pop-in animation is off.

### T9 Set selection (C3, C11)
- AC: published sets show cover, heading-colored name, optional sub-title, question-count pill, and a star when finished; selectable by click, or by keyboard: the first set is focused on arrival, Left/Right arrows move between sets, Enter or Space opens the focused one (laptop keyboard support stays after ADR-028).
- AC: the "? Quiz" badge at the top right of the set selection screen is a real button (large, press animation, visible focus ring). It opens the "How to play Quiz" popup (the only place that opens it since F4); its last button says "Play" and just closes the popup, since the child is already choosing a set. Esc / Back / Close / backdrop close it without leaving the screen.
- AC: the sets form a carousel like the game list: hold the mouse and drag (120 px threshold; a drag never opens a set), Left/Right arrows (focus moves and the focused set is centered), Previous/Next buttons and clickable dots; tapping a side set centers it, tapping the centered set opens it; with one set there are no arrows or dots.
- AC: with no published sets, a friendly picture screen shows, not an error.
- Tests: `tests/QuizSets.test.tsx` (TC1-TC15: card content, published/complete filtering, star, focusable links, blocked storage, empty state, help popup open/close/Play, Esc and back button, arrows + Space/Enter).

### T10 Question screen (C4-C6, C9, C10, C12; ADR-007, 019, 021, 025)
- AC: three bands (header, question row, answers) with no overlap at 1920x1080; prompt audio plays if present, with a replay button.
- AC: 2-3 answers show image + number + fixed color (1 rose, 2 sky, 3 butter); click/tap and keys 1/2/3 answer; Left/Right arrows move between the answers and Enter or Space picks the focused one; no timer. Tests: `tests/QuestionKeys.test.tsx`, `tests/keynav.test.ts`.
- AC: an answer card draws the answer text under the picture only when the question does not have "Hide the answer text" on; when the text is hidden the picture uses the full card height.
- AC: each answer image fills the card width (`width: 100%`) and is scaled to fit inside the card, never cropped or stretched (`object-fit: contain`; height capped at 250 px when the answer has text, so it never covers the text); this makes SVGs with a fixed size (e.g. 84x84) or only a `viewBox` render at the same size.
- AC: the reading of all answers after the question happens only when the question's "Read the answers aloud" is on; the picked answer is always read.
- AC: on a new question the app waits 0.5 s, reads the question aloud (recorded voice if uploaded, else kid voice), then reads each answer's text aloud with 1 s between answers (the card being read bounces and wiggles with a glowing ring and sound bars, the others dim slightly; static ring with reduced motion); the replay button repeats this; picking an answer stops the reading.
- AC: the built-in kid voice always speaks English (`lang = 'en-US'`, an en-US voice preferred, never a Vietnamese one), whatever language the browser or computer uses, and the page is `lang="en"`. Tests: `tests/sfx.test.ts`.
- AC: when the child picks an answer, the app first reads that answer's text aloud (if any), then shows the Hooray popup right away, or the Oh-oh popup 1 s after the reading ends, each with its sound; further picks are ignored while it reads.
- AC: the card the child picks plays a short effect for 1.5 s: it grows (up to about 1.18x), wiggles gently, and a soft ring in its color pulses out; it then stays a little bigger (1.14x) while the result shows. The hooray / oh-oh popup waits until that 1.5 s effect has played (hooray at about 1.6 s, oh-oh at about 1.8 s after the pick). With `prefers-reduced-motion` there is no movement: the card is just shown a little bigger (1.08x).
- AC: when the mouse hovers an answer card, or the Left/Right arrow keys move focus onto it, the card clearly stands out: it lifts (16 px) and grows (1.08x), gets a drop shadow and a ring in its own color that pulses, its number badge (1.22x) and picture (1.07x) pop, and the other cards step back (smaller, 0.95x, less saturated). Keyboard focus also keeps a dark outline for contrast. With `prefers-reduced-motion` nothing pulses or animates: the same emphasis is shown as a static state.
- AC: the Hooray and Oh-oh popups always draw above the answer cards, even a card that is lifted by hover, focus or the pick effect (popup layers z-index 10; cards 3-4), so the card never overlaps the popup text.
- AC: the Hooray and Oh-oh sounds use the custom track from Settings when set, else the built-in sound.
- AC: on the Hooray popup there is no button; it shows "Continue in 3s / 2s / 1s" with a 3 s countdown, then closes and goes to the next question (last question: goes to the completed screen).
- AC: the "Oh-oh… try again!" popup is centered on the screen and disappears after 2 s.
- AC: wrong answer dims the card gently with an "oh-oh" sound and the "Oh-oh… try again!" toast, which disappears after 2 s; retry allowed, no penalty.
- AC: question dots are clickable to jump to that question, and "n / total" is shown; the replay-voice and music buttons are clickable with press animation.
- AC: a question counts as finished only when the child picks its right answer. Its dot turns yellow then; every dot of a question not finished yet stays gray (the current one is gray with a pink ring), whatever the order the child played in. A wrong answer or jumping past a question never finishes it.
- AC: the finished questions are kept on the device (localStorage `hamy:progress:<setId>`, per set, no identity): after a reload or coming back later the yellow dots are still there and the child resumes at the first unfinished question. Questions that no longer exist in the set are ignored; blocked storage never breaks the page; another device starts clean.
- AC: when the set is completed the saved dots are cleared (the star stays), so "Play this set again" starts with all dots gray.
- AC: after the Hooray popup the app goes to the next question that is not finished yet (continuing past the last one back to the first unfinished one); it never assumes earlier questions are done.
- AC: correct answer plays a kid-voice "Yay, hooray!" sound with slow pastel confetti, then advances. Sounds are synthesized/browser voice for now; recorded kid-voice files can replace them later.
- AC: with `prefers-reduced-motion`, confetti and transitions are disabled or reduced.
- AC: no screen depends on text; no hard-coded child-facing text.

### T11 Completed and back navigation (C7, C8, C12; ADR-026)
- AC: the completed screen (and the star for the set) is reached only when every question of the set is finished, not when the last question in order is answered.
- AC: completed screen shows girl image, light confetti (simpler and fewer than before), praise, and a way back to set selection; the set is marked finished (star).
- AC: the completed screen shows a second character on the right (`public/images/girl-beret.webp`, a cut-out with a transparent background and no white fringe), mirroring the first one on the left; the first one is moved a little toward the center (left edge 130 -> 220 px). The two float out of step with each other. The title is limited to the space between them (840 px wide, centered) and wraps onto a second line for a long name, so it never overlaps either character.
- AC: if a "You did it" custom track is set in Settings, the completed screen plays it instead of the built-in applause and spoken praise.
- AC: completed screen plays applause and says "You did it, <child name>!".
- AC: Esc/Back key and a picture button go from set selection to game list and from a question to set selection.

### T12 Preview as child (A7; ADR-022)
- AC: enabled only after the set is saved; plays the set as the child sees it, including drafts, without publishing.

### T13 Deploy (spec 7)
- AC: deployed on Vercel; the full flow works in a computer browser (PO accepted 2026-10-28).
- Parked, not built: preloading the next question's images and the "interactive in under 3 s" check (section 4).

### T14 Setup README (DoD 3)
- AC: README covers creating the Supabase project, running migrations, creating the admin user, env vars, and deploying to Vercel.
- AC: a second child's deployment is set up from the README alone with no code changes.

### T15 Free replaced and removed media (storage hygiene; A2, A4, A5)
Files are uploaded as soon as they are picked, but only a successful Save/commit decides what stays. Never delete before Save, so Revert keeps working.
- AC: on Save of a set, every file that the last saved state referenced but the saved state no longer does (replaced, removed, or belonging to a deleted question) is deleted from the `media` bucket; the database no longer points to it.
- AC: choosing a picture or voice file (set editor: cover, question image, question voice, answer images; Settings: avatar) only shows a local preview. Nothing is sent to the bucket until the user presses Save (Settings: "Save changes"); a file replaced, removed or reverted before Save is never uploaded.
- AC: on Save, the chosen files are uploaded first, then the database is written. If an upload fails, the files already uploaded in that attempt are deleted, the database is not written, and an error is shown.
- AC: type and the 2 MB image limit are checked when the file is chosen, with an immediate message.
- AC: deleting a set (from the set list or the editor) also deletes its cover, question images, question voices and answer images from the bucket.
- AC: on Settings, replacing or removing the avatar, greeting, background music or a feedback sound ("Use built-in") deletes the old file right after the database update succeeds.
- AC: only files inside the `media` bucket are ever deleted. Bundled sample art (`seed/...`) and external image URLs are never touched.
- AC: if the database save fails, no file is deleted; if a file delete fails, the save still succeeds and the admin sees a non-blocking notice.
- AC: unit tests cover the "which paths to delete" logic (replace, remove, deleted question, seed/URL paths, revert).

### T16 Quick import of questions from JSON (A5, A6; extends T6)
- AC: in the set editor, the same row as "Delete this quiz set" has a blue "+ Quick import questions" button at the left; "Delete this quiz set" stays at the right. The button also shows for a new, unsaved set.
- AC: the button opens a modal with a backdrop. It shows a short guide, a "Download quiz-template.json" button (file `public/quiz-template.json`), and a JSON file picker. Esc and Cancel close it.
- AC: the guide says: images can be left blank and uploaded later, or can be `https://` links from the internet; question image up to 2 MB, best at 600 x 300 px; answer image 84 x 84 px; SVG is best for sharp scaling (PNG, JPG, WebP also work).
- AC: template JSON has `questions[]`, each with `text`, optional `image`, `readAnswersAloud`, and 2-3 `answers[]` (`text`, `image`, `correct`). Blank `""` or missing image is allowed.
- AC: validation runs before anything changes and lists every problem with its question number (invalid JSON, no questions, answers not 2-3, not exactly one correct, image that is not blank or an `https://` URL, file over 1 MB, more than 50 questions). Nothing is imported when there is any error.
- AC: a valid file shows "N questions ready"; "Import" appends them to the end of the current set as unsaved changes (Save and Revert behave as usual); incomplete ones (blank image or text) show in the completeness checklist and can be finished by hand.
- AC: image URLs from the internet are stored as-is and render in the editor and the child app; they are never deleted by T15.
- AC: `image` may also be raw SVG code (`<svg ...>...</svg>`). It is checked (starts with `<svg`, ends with `</svg>`, valid XML, at most 30,000 characters, no script, event handler, foreignObject, DOCTYPE or link to outside files; `xmlns` is added when missing) and any error is listed with its question and answer number.
- AC: SVG code exported by design tools is accepted: an `<?xml ?>` line, comments, a simple DOCTYPE, `<![CDATA[` in `<style>`, namespaces/metadata, `xlink:href="#id"`, and `&nbsp;` (converted). Rejected with a clear message: scripts, event handlers, foreignObject, DOCTYPE with definitions or ENTITY, embedded `data:` pictures, links to outside files, and HTML entities such as `&copy;`.
- AC: the preview shows the SVG in the editor right after import (local preview); on Save the file is uploaded, the form is silently reloaded from the database, and the imported questions and pictures stay correct (verified end to end against a stand-in Supabase, including reload, a second import, and deleting a question).
- AC: SVG code is not stored in the database. On import it becomes a local preview like any picked file and is uploaded as a small `.svg` file on Save.
- AC: identical SVG code (ignoring spacing) used in several answers and/or the question image creates ONE pending file and ONE uploaded file, and all those fields point to the same path; a different drawing gets its own file.
- AC: a file shared by several answers is deleted only when none of them uses it any more (T15).
- AC: uploaded file names are unique (timestamp plus random suffix), so several files saved in the same moment never collide.
- AC: SVG uploads are accepted in the editor and Settings (bucket allows `image/svg+xml` via a new migration).
- AC: unit tests cover the parser/validator (valid file, each error, blank images, URLs, the template file itself).

## 4. Phase 1 closure (2026-10-28) and parked leftovers
Ticket status: T0-T16 built and deployed; Trello board updated the same day. The PO accepted the result without a formal DoD run.

Parked (not blocking the close; pick up only when the PO asks):
- **T14 Setup README** (DoD 3): `README.md` is still empty. Needed before a second child's deployment.
- **Preload and 3 s start** (was part of T13): images of the next question are not preloaded.
- **Playwright e2e**: done in Phase 2 (Memory Match Task 0); `npm run e2e` runs Chromium against a stand-in Supabase (`e2e/support/`).
- **CI**: `.github/workflows/deploy.yml` runs typecheck and tests on pushes to `main` only (not on `develop` or PRs). Its `deploy` job was removed on 2026-10-29: it always failed for lack of Vercel secrets, and Vercel's Git integration already deploys.
- **Voice depends on the device (known gap, accepted 2026-10-29)**: the built-in kid voice uses the browser's speech synthesis (`lib/sfx.ts`), which we set to English (`lang = 'en-US'`, page `lang="en"`) but cannot guarantee. It speaks only if the device has an English voice: Windows, macOS, iPhone/iPad and most Android phones usually do; Brave on Linux (e.g. Ubuntu) has none until `speech-dispatcher` and `espeak-ng` are installed, and Android phones without Google services may have none. Workarounds today: install a voice, or upload a recorded voice per question in the admin. A reliable fix would be pre-generated audio (cloud text-to-speech stored in Supabase Storage); that needs a provider, an API key and a server step, so it is a PO decision, not built.
- **Listen & Pick leftovers (known, deferred):** the middle star on the finish screen sits close to the top edge when there are 10 wrong words; "Wrong 1 times" grammar follows the Memory Match style; the praise audio is not stopped on Play again.
- **Sort It leftovers (known, deferred):**
  - No keyboard play, by PO decision (Esc still goes back).
  - No per-group pictures or colors; the baskets show only an example card.
  - One tag per card (no several tags).
  - No list of mixed-up words on the finish screen and nothing stored.
  - "Wrong 1 times" grammar follows the Memory Match and Listen & Pick style.
  - A tap on an object says the word twice (once on press, once on release).
  - Admin group-save trap: if `saveCards` fails after `saveGroups` succeeded, the saved groups copy stays stale until the page is reloaded.
  - Focus is not restored after renaming or deleting a group chip.
  - `README.md` is still empty (T14).
- DoD 1 (child plays a full set unaided) and DoD 2 (5-question set in under 10 minutes) were never timed or recorded.

Removed from scope by the PO: TV and LG webOS testing, Magic Remote, a 120 px TV hit-area rule, and TV-specific performance work (ADR-028).

## 5. Phase 2: only more games (redefined 2026-10-29)
Phase 2 only adds games on top of the game registry (ADR-014). The play-time limit, rest screen and PIN are dropped (ADR-029). New games use HTML/CSS first; Phaser only as a last resort (ADR-030).
- Game 1, Memory Match: spec `docs/superpowers/specs/2026-10-29-memory-match-design.md`, plan `docs/superpowers/plans/2026-10-29-memory-match.md`. Built on branch `claude/phase2/memory-match` (task branches `claude/phase2/mm-t<N>-*`) with Playwright E2E.
- Left to do:
  - Apply `supabase/migrations/20261029100000_memory_cards.sql` to the real Supabase project after the PO's OK.
  - PO play-test of the flip, sounds and voice in a real browser.
  - Merging `claude/phase2/memory-match` into `develop` is the PO's decision.
  - Done 2026-10-30 with the PO's OK: `supabase/migrations/20261030100000_spot_levels.sql` applied to the real Supabase project (RLS checked: anon sees active levels only, anon writes denied, 3-10 differences enforced).
  - PO play-test of Spot the Differences (tap feel, ring growth, ripple, sounds) in a real browser.
  - Merging the Spot branch `claude/kind-babbage-gd9qpd` is the PO's decision.
- Game 2, Listen & Pick: spec `docs/superpowers/specs/2026-10-30-listen-pick-design.md`, plan `docs/superpowers/plans/2026-10-30-listen-pick.md`. Built on branch `claude/phase2/listen-pick` (task branches `claude/phase2/lp-t<N>-*`). No migration: it reuses `memory_cards` and the Cards admin page. Route `/games/listen`.
- Game 3, Spot the Differences: spec `docs/superpowers/specs/2026-10-30-spot-the-differences-design.md`, plan `docs/superpowers/plans/2026-10-30-spot-the-differences.md`. Built on branch `claude/kind-babbage-gd9qpd` (IDs S1-S10, A14-A16) with Playwright E2E.
- Game 4, Sort It: spec `docs/superpowers/specs/2026-10-30-sort-it-design.md`, plan `docs/superpowers/plans/2026-10-30-sort-it.md`. Implemented on branch `claude/phase2/sort-it` (task branches `claude/phase2/st-t<N>-*`; IDs R1-R10, A17-A19, renumbered from S1-S10 and A14-A16 on 2026-10-30 because Spot already used them). One migration: `supabase/migrations/20261030110000_card_groups.sql` (table `card_groups`, column `memory_cards.group_id`). Route `/games/sort`; in the game list it sits before Spot (quiz, memory, listen, sort, spot).
- Admin media reuse (A24-A26, extends A23): spec `docs/superpowers/specs/2026-10-31-media-reuse-design.md`. Branch `claude/admin-media-reuse`. Adds "Choose from library" to every admin picture and sound upload, and play / pause in the library sound list. No migration. Quiz sets also get "Or paste SVG code" for the question picture, each answer picture and the cover (same rules as Cards, checked by `checkSvg`).
- Game 5, Find It: spec `docs/superpowers/specs/2026-10-30-find-it-design.md`, plan `docs/superpowers/plans/2026-10-30-find-it.md`. Implemented on branch `claude/phase2/find-it` (IDs F1-F10, A20-A23; section 3d and 4d). One migration: `supabase/migrations/20261030120000_find_levels.sql` (table `find_levels`), NOT yet applied to the real Supabase project (plan FI-T13). Route `/games/find`; in the game list it is last (quiz, memory, listen, sort, spot, find).

### Listen & Pick tickets (spec 3b: G1, L1-L10)
Files: `lib/listen/rounds.ts`, `lib/listen/wrongLog.ts`, `components/listen/ListenQuestion.tsx`, `components/listen/ListenDone.tsx`, `components/ListenHelp.tsx`, `app/games/listen/page.tsx`; tests `tests/Listen*.test.ts(x)`, `tests/listenRounds.test.ts`, `tests/listenWrongLog.test.ts`, `e2e/listen-play.spec.ts`.
- [x] **LP-T1 Game list entry (G1).** Acceptance: the registry has a ready `listen` entry; its card has the lavender border/title (`#C9BFE4` / `#7B6BAE`) and a decorative `aria-hidden` icon; clicking the card opens `/games/listen`.
- [x] **LP-T2 Round building (L2, L10).** Acceptance: 10 different answer cards, two distinct distractors per question, random answer position; 3-9 usable cards give one question per card; fewer than 3 is reported as empty.
- [x] **LP-T3 Wrong-picks log (L7).** Acceptance: key `hamy.listen.wrong`, entries `{id, word, count}`, written at every wrong pick; cleared on round start, play again and leaving; blocked storage falls back to memory for the page visit.
- [x] **LP-T4 Question view (L1, L3, L8, L9, L10).** Acceptance: three picture buttons with number badge and fixed color (rose, sky, butter); speaker button and key R replay the word; 1/2/3, Left/Right, Enter/Space, Esc work with a visible focus ring; reduced motion fades only; missing picture shows a placeholder.
- [x] **LP-T5 Play page (L1-L5, L8, L10).** Acceptance: a full round plays at `/games/listen`; wrong pick says "Oh-Oh", dims and disables the picture, then repeats the word; right pick says "Hooray" and the word, then the next question; leaving cancels timers and speech; the "? Listen & Pick" help badge opens `ListenHelp`; empty/failed pool shows a friendly picture screen.
- [x] **LP-T6 Finish screen (L6, L7).** Acceptance: celebration scene with "Wrong N times" (N highlighted), play again and back buttons; a row of round pictures with word and count when there were wrong picks (tap says the word), no row otherwise.
- [x] **LP-T7 Docs and tickets.** Acceptance: spec.md (G1, L1-L10), plan.md, CLAUDE.md and git-workflow.md updated; L-IDs match the design spec one to one. Gate (typecheck, lint, test, build, e2e) and the PO play-test before merge into `develop` are still to do.

### Sort It tickets (spec 3b/4b: G1, R1-R10, A13, A17-A19)
Files: `lib/sort/{cards,groups,rounds,drag}.ts`, `components/sort/*` (`SortBasket`, `SortObject`, `SortDone`, `SortPicture`, `useSortDrag`), `components/SortHelp.tsx`, `app/games/sort/page.tsx`, `components/admin/GroupsPanel.tsx`, `supabase/migrations/20261030110000_card_groups.sql`; tests `tests/Sort*.test.tsx`, `tests/sort*.test.ts`, `tests/useSortDrag.test.tsx`, `tests/memorySeedGroups.test.ts`, `tests/memoryAdminGroups.test.ts`, `tests/GroupsPanel.test.tsx`, `e2e/sort-play.spec.ts`, `e2e/admin-cards.spec.ts`.
- [x] **ST-T1 Migration and seed groups (R2, A17).** Acceptance: `card_groups` has the 1-40 check and a unique index on `lower(btrim(name))`; RLS admin-only (`is_admin()`), no anon access; `memory_cards.group_id` references it with `on delete set null`; the migration is idempotent and seeds six groups and 29 tagged cards (`ball` and `car` untagged), every seeded picture exists in `public/seed`. Migration file is written and tested as text; it is NOT applied to the real Supabase project.
- [x] **ST-T2 Groups, rounds and card fetch (R2, A13).** Acceptance: a group is usable with at least 4 active cards with different words (same word counts once); a round is 2 different usable groups x (1 example + 3 objects), 8 different cards, 6 shuffled objects, random left/right; fewer than 2 usable groups gives `null`; `sortHealth` gives the pool-health line; `fetchSortCards` selects `group_id` without changing `fetchActiveCards`.
- [x] **ST-T3 Drag helpers (R3).** Acceptance: stage scale and pointer-to-stage conversion, basket hit test (left inclusive, right exclusive), 8 px tap threshold, all pure and unit-tested.
- [x] **ST-T4 Game list entry (G1).** Acceptance: registry order quiz, memory, listen, sort, spot with `sort` ready and `spot` not ready (true at the time; since the 2026-10-30 merge of `develop` Spot is ready too and all five games are playable); the Sort It card has the butter-gold border `#EAD9A0` and title `#A8842F`, and a decorative `aria-hidden` icon (circle `#FBF3D9`, ring `#A8842F`); clicking opens `/games/sort`.
- [x] **ST-T5 Presentational components (R1, R3, R9).** Acceptance: basket with its example button and three slots; draggable object with lift and slide states and a placeholder for a missing picture; `SortHelp` with 3 steps; no child-facing text hard-coded.
- [x] **ST-T6 Pointer drag hook (R3, R9).** Acceptance: Pointer Events only; drop on basket 0, 1 or outside; a tap (movement up to 8 px) says the word and never drops; `pointercancel` slides back; a second pointer or non-primary button is ignored; unmount mid-drag removes the listeners.
- [x] **ST-T7 Play page (R1-R6, R8-R10).** Acceptance: a full round plays at `/games/sort` with the mouse; right drop gives `chime`, fills the next slot, then says the word; wrong drop gives `ohOh`, the 1.4 s popup, slides back in 0.35 s and counts once; a drop outside plays nothing and counts nothing; presses during a slide-back or settle are ignored; empty/failed pool shows the friendly screen; Esc goes to `/games`; the "? Sort It" badge opens `SortHelp`; reduced motion removes lift and slide; leaving cancels timers, speech and any drag.
- [x] **ST-T8 Finish screen (R7).** Acceptance: celebration scene, "You did it, <name>!", "Wrong N times" (N may be 0, highlighted), play again (new round) and back to games; nothing stored.
- [x] **ST-T9 Admin data layer for groups (A17, A18).** Acceptance: group names validated (1-40, unique ignoring case and spaces); `saveGroups` upserts only new or renamed groups; `deleteGroups` in one call; `loadCards`/`saveCards` carry `group_id`.
- [x] **ST-T10 Admin Groups area and card picker (A17, A18).** Acceptance: chips with rename and delete (delete always asks), add by typing; "Group" picker with "No group" on every card, weak-group warning under 4 cards; Save writes groups, then cards, then group deletes; Revert discards both.
- [x] **ST-T11 JSON import `group` and pool health (A19, A13).** Acceptance: `group` resolved against the draft's groups (ignoring case and spaces); unknown name, wrong type and over 40 characters are errors with the card number and nothing is imported; the template shows the key; pool health also says how many groups can be played in Sort It.
- [x] **ST-T12 Docs and tickets (this section).** Acceptance: spec.md (G1, R1-R10, A13, A17-A19), plan.md, CLAUDE.md, git-workflow.md and the design spec status updated; R- and A-IDs match the design spec one to one.
- [ ] **ST-T13 Release gate (NOT done).** Controller's full gate (typecheck, lint, test, build, e2e) on `claude/phase2/sort-it`.
- [x] **ST-T14 Apply the migration (applied 2026-10-30 through the Supabase migration tool with the PO's OK; verified: six groups food 5, animals 4, shapes 5, school 7, home 4, nature 4 cards; 29 of 31 cards tagged, ball and car untagged; `card_groups` has RLS and four admin-only policies).** Acceptance: with the PO's OK, `20261030110000_card_groups.sql` is applied to the real Supabase project (additive, idempotent) and the six groups and the 29 tagged cards are verified; only after that is the integration branch built or deployed for play-testing or the admin page used on it. Apply `supabase/migrations/20261030110000_card_groups.sql` once, through the migration tool (Supabase MCP `apply_migration` or `supabase db push`) so it is recorded in the migration history, and never paste it into the SQL editor (a later `db push` would run it again, re-seed groups the parent renamed or deleted and re-tag cards set to "No group").
- [ ] **ST-T15 PO play-test (NOT done).** Acceptance: the PO plays a round in a real browser (drag, sounds, voice, colors from a screenshot) and OKs; merging `claude/phase2/sort-it` into `develop` is the PO's decision.

### Find It tickets (spec 3d/4d: G1, F1-F10, A20-A23)
Task list with steps: `docs/superpowers/plans/2026-10-30-find-it.md`. Tickets FI-T1 to FI-T13 follow its tasks.
- [x] **FI-T1 Pure logic (F4, F5, F10).** Acceptance: validation (2-12 objects, word 1-40 chars, radius 0.03-0.15, bad audio path rejected), hit test on the current object only (hit radius `max(r, 0.04)`, aspect respected) and the rules (advance, done) are pure and unit-tested.
- [x] **FI-T2 Migration and stand-in (A20).** Acceptance: `find_levels` has the object-array check (2-12), RLS anon-read-active and admin-only writes, no seed rows; a test reads the SQL file; it is NOT applied to the real Supabase project.
- [x] **FI-T3 Child reads (F1, F10).** Acceptance: rows with fewer than 2 objects, a blank word or non-array `objects` are dropped and the order is kept; `fetchFindLevel` returns null for an unplayable row or an error.
- [x] **FI-T4 Registry, game list art and help (G1, F1).** Acceptance: registry order quiz, memory, listen, sort, spot, find, all ready; the Find It card has the peach border `#F2C9A8` and title `#B5703A` with a decorative `aria-hidden` icon; `FindHelp` shows 3 steps and closes on Esc.
- [x] **FI-T5 Level grid (F1, F7).** Acceptance: thumbnails in order, first one focused, arrow keys move, Space opens; an empty list or failed load shows the friendly screen; the help badge opens `FindHelp`.
- [x] **FI-T6 Play screen (F2-F9).** Acceptance: a level plays in number order with the mouse; a right tap rings and advances after a pause, taps during the pause are ignored; a wrong tap ripples with no sound and no count; the completion screen follows the last object; Esc goes back; leaving cancels timers and speech; reduced motion is honored.
- [x] **FI-T7 Reference guard (A23).** Acceptance: `removeMedia` keeps any path that a card, spot level, find level, quiz answer or settings still uses; a failed check keeps every file and does not fail the save.
- [x] **FI-T8 Media library (A23).** Acceptance: the library lists pictures and sounds already in use, dropping seed, http and pending paths and duplicates; choosing one stores the same path (no copy).
- [x] **FI-T9 Admin editor model (A20, A22).** Acceptance: add, delete and move keep each word and sound with its circle and renumber it; Save uploads new files before the database write; a picture still used elsewhere is not deleted; a failed write removes this attempt's uploads and keeps the old files.
- [x] **FI-T10 Admin UI (A20, A21).** Acceptance: a click on the picture adds a numbered circle; rows and circles highlight each other; Save is disabled until a picture, 2-12 objects and every word are set; delete asks first; the admin nav shows "Find".
- [x] **FI-T11 Admin e2e (A20-A23).** Acceptance: build a level, reuse the picture from the library, delete the first level and the shared picture still loads; the played order follows the numbers (`e2e/admin-find.spec.ts`).
- [x] **FI-T12 Docs and tickets.** Acceptance: spec.md (3d, 4d, `find_levels`), plan.md, CLAUDE.md, the design spec status and ADR-031 are updated; `npm run lint` has 0 errors.
- [ ] **FI-T13 Final gate and handoff (NOT done).** Acceptance: typecheck, lint, test and e2e are all green; the migration is applied to the real Supabase project only after the PO's OK; the PO play-tests `claude/phase2/find-it` in a real browser.

## 6. Risks
- Browser autoplay policy: audio only after "tap to enter" (T7).
- Draft preview vs RLS: preview must use the authenticated client (T12).
- Large uploads: validate type and size on client and in Storage policy, compress before storing (T6).
- Deleting a file still referenced elsewhere would break a picture: delete only paths the previous saved state owned and the new state no longer uses, and only after the database write succeeds (T15).
- External image URLs can disappear or block hot-linking; the admin can replace them later. `http://` links are rejected because the site is served over HTTPS (T16).
- SVG files are user-supplied: they are shown only through `<img>` tags (scripts do not run there) and only an authenticated admin can upload them (T16).

## 7. Definition of done (spec 8)
1. Child goes from Welcome to the end of a set without anyone reading to her.
2. A parent creates a set with at least 5 questions in under 10 minutes.
3. A second child's deployment is set up from the README with no code changes.
