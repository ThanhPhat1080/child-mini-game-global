# Guest Play (no account) and No-Select design

Date: 2026-11-08. Status: Accepted (2026-11-08, grilling session with the PO). Repo: `child-mini-game-global`. Branch: `claude/great-bohr-0i1ukz` (from `develop`).

Requirement IDs: `GU1..` (guest play), `NS1..` (no text selection on child screens), `GT1..` (tests). Cite them in commits.

## 1. Goal

Today every visit starts with the parent sign-in form. A family that only wants to try the games must create an account first. Guest Play adds a second door **next to** the parent login: a visitor picks Guest, then Boy or Girl, types the child's name and age, presses OK and plays the public (global) games. A guest is play-only and view-only: no admin pages, no child picker, no uploads, nothing written to the database. Leaving the guest session erases it.

Second, smaller goal (NS): a child who moves the mouse with the button down paints text and pictures blue (browser selection) or drags a ghost picture. On every child screen this must not happen.

Success:
- A visitor opens the site, sees two cards (Log in, Guest), picks Guest, picks Girl, the Girl card glides into place and the name + age form slides in, types "Mai", leaves age 2-5, presses OK and lands on the Welcome page with the princess. They play any global quiz, memory, spot, sort, find, listen, pairs or caro game. "You did it" shows the princess (Boy: the prince).
- The top-left Leave button asks the two-digit sum; a right answer erases the guest data and returns to the Log in | Guest screen.
- The guest never sees a private or pending row of any family, never reaches `/admin/*` or the `/play` child picker, and the database receives no write from a guest.
- Pressing and dragging over any child screen paints no selection and drags no picture ghost. Inputs (name, PIN) still select normally. Admin pages are unchanged.

Existing rules still hold: RLS decides access and the UI mirrors it; calm and slow motion, `prefers-reduced-motion`; keyboard and focus ring; no child-facing text except grown-up screens (ADR-036); one audio manager, nothing plays before "tap to enter".

## 2. Decisions taken in grilling (2026-11-08)

| # | Topic | Decision |
|---|---|---|
| Q1 | Data access | No account. New `select to anon` RLS policies on global, published/active content only. A guest writes nothing to the database (no Supabase Anonymous Sign-in: its `handle_new_user` trigger would make every visitor a `parent` with admin and upload rights). |
| Q2 | Entry | `/play/sign-in` becomes a two-card chooser (Log in, Guest). Log in reveals today's form in place. `/admin/sign-in` is unchanged. |
| Q3 | Guest data | Name, gender, age band live only in this browser (localStorage + a marker cookie) until the guest leaves; reopening the site goes straight to Welcome. Leave erases everything ("leaving = deleting the session"). |
| Q4 | Age | Segmented switch 2-5 / 5-10 like the admin child dialog, but bigger. Stored only, it filters nothing in this change. |
| Q5 | Leave | Leave (top left) opens the existing Leave dialog; Leave then asks the two-digit sum (`AdultCheck`), because leaving erases the name. Inside games the back button keeps going to `/` or `/games` as today. |
| Q6 | Parent-side guest | The existing signed-in-parent guest (`GuestPickCard`, cookie `cp_guest`) stays as it is. The new guest is a separate mode called **visitor** in code. |
| Q7 | Sounds | The repo has no default greeting or music (`public/seed/sounds` holds only `complete`, `hooray`, `ohoh`). A visitor has no greeting; the built-in background track (`background-track.mp3`) plays for everyone, and the games use their built-in effects. |
| Q8 | Text | The gender cards are for the child: head picture, color, ♂/♀ and the existing `GENDER_THEME` label (Boy, Girl). The name + age step is a grown-up screen (English labels allowed, as on sign-in). Name required, 1-20 characters after trim. |
| Q9 | Head pictures | New files `public/images/prince-head.webp` and `public/images/princess-head.webp`, cut from `prince.webp` / `princess.webp`, shown in a round frame. |
| Q10 | Feedback loop | Static HTML mockup of the 4 steps with motion first; the PO approves it; then code; then Playwright screenshots compared with the mockup. |
| Q11 | No-select scope | All child screens (`/`, `/games/*`, `/play`, `/play/sign-in`, `/play/guest`). Inputs and textareas keep normal selection. Admin unchanged. |
| Q12 | Picture drag | Pictures on child screens cannot be dragged (no ghost). The right-click menu is left alone. |
| Q13 | Delivery | No-select ships first as its own small PR into `develop`; Guest Play follows in a second PR. |
| Q14 | Parent wins | A signed-in parent never sees the chooser (sent to `/play`). Signing in from the chooser erases any visitor data. A device is never half guest, half parent. |

## 3. Non-goals

- Filtering content by age band.
- Default greeting or music files for visitors.
- Saving visitor progress, a visitor turning into an account, or any analytics.
- Changing the signed-in-parent guest (`cp_guest`) or the PIN picker.
- Tightening the `media` bucket listing policies (separate audit, still open).
- Blocking the right-click menu.

## 4. No-select (NS, PR 1)

- **NS1** One global rule in `app/globals.css`: elements under `.hm-child` get `user-select: none; -webkit-user-select: none`, and `img, svg image` under it get `-webkit-user-drag: none`. `input, textarea, [contenteditable]` under it get `user-select: text` back.
- **NS2** `.hm-child` is set on the child roots: `Stage` (Welcome, `/games`, every game), the `/play` picker wrap and the `/play/sign-in` wrap (and later `/play/guest`). Admin roots never get it.
- **NS3** `Pic` renders `draggable={false}` (the CSS rule does not cover Firefox; desktop Chromium is the target, the attribute is cheap insurance). Drag and drop that games build themselves (Puzzle Pairs, Sort It) use pointer events and keep working.
- **NS4** Nothing that is selected today on purpose breaks: PIN and email inputs select, copy and paste.

## 5. Guest Play (GU, PR 2)

### 5.1 Screens and motion

- **GU1 Chooser** `/play/sign-in`, same sky scene and the princess and prince heroes as today. Two big cards in the middle column: **Log in** (fish logo, "Log in") and **Guest** (both head pictures, "Play as guest"). Keyboard: Left/Right move, Enter/Space pick, focus ring. Picking Log in fades the cards out and today's form in (reduced motion: plain fade); a back arrow top left returns to the two cards. Signed-in sign-in behaves as today and also calls `clearVisitor()` (GU8).
- **GU2 Gender** `/play/guest` step 1: two cards side by side, Boy (left) and Girl (right), each a round head picture (Q9) inside a ring in the gender accent (Boy `#8FB3D1`, Girl `#E59AA1`), the ♂/♀ icon and label in the gender text color (`GENDER_THEME`). Cards breathe slowly; hover/focus lifts them. Back (top left) returns to the chooser.
- **GU3 Transition** picking a card: the other card fades and shrinks away, the picked card glides (FLIP, about 600 ms, ease-out) up to a small header avatar, and the form slides up into the space below (about 500 ms, starting 200 ms later). Reduced motion: cross-fade only. Back on step 2 plays it in reverse and keeps the typed name.
- **GU4 Details** step 2 (grown-up screen): header avatar in the chosen color, a name field ("Child's name", 1-20 characters after trim, autofocus), the age switch ("Age": 2-5 | 5-10, the admin `segBtn` look at about 1.6x size, default 2-5) and a big OK button in the gender accent. OK is disabled until the name is valid; Enter in the field submits. OK saves the visitor (GU6) and goes to `/` (Welcome, "tap to enter" as today).
- **GU5 Play** Welcome, `/games` and every game behave as for a child, with the visitor's gender theme, hero and name. The Leave button (top left) is shown as today. Celebration screens use the built-in prince or princess (`celebrationSlots` with no pictures).

**Approved mockup changes (PO, 2026-11-09, mockup v7; these win over the text above):**
- The Guest step (GU2) shows "Who are you?" with the same letter bounce as the `/play` picker.
- Log in (GU1) opens today's parent form in place, unchanged.
- The details step (GU4) has a close X top-right in the play-screen style (`ModalClose` size child: 88 px round, 20 px from the top and the right); it returns to Boy or Girl and keeps the name.
- The details form is blue for Boy and pink for Girl (the OK button and the age segment too).
- OK saves the visitor and goes to `/` (Welcome). The mockup's Play button is the existing "tap to enter" of Welcome.

### 5.2 Visitor session

- **GU6** `lib/visitor.ts`: `Visitor = { name: string; gender: Gender; ageBand: AgeBand }`. `saveVisitor(v)` writes localStorage `cp_visitor` (JSON) and cookie `cp_visitor=1` (Path=/, SameSite=Lax, one year, plain like `cp_child`). `getVisitor()` returns the parsed, validated value or null (bad JSON or cookie without data = null). `isVisitor()` = cookie and valid data. `clearVisitor()` removes both. Pure validation `validateVisitor(input)` (name 1-20 after trim, gender male/female, age 2-5/5-10).
- **GU7 Leave** `LeaveGameButton` in visitor mode: Stay/Leave as today; Leave opens `AdultCheck` (two-digit sum, as parent sign-out); a right answer stops music, calls `clearVisitor()` and goes to `/play/sign-in` (chooser). Cancel or a wrong answer keeps playing.
- **GU8 Parent wins** a successful parent sign-in (play or admin sign-in) calls `clearVisitor()`. Middleware: when a profile exists, the visitor cookie is ignored.

### 5.3 Routing (middleware)

- **GU9** `/play/guest` joins `OPEN`. `/play/sign-in` with a signed-in profile redirects to `/play` (today it shows the form).
- **GU10** No profile and a visitor cookie: `/` and `/games/*` are allowed; `/play` redirects to `/`; `/admin/*` follows `adminAccess` as today (no profile = `/admin/sign-in`, so a visitor never sees admin). No profile and no visitor cookie: as today (`/play/sign-in`).
- **GU11** The cookie only opens pages; data access is decided by RLS (GU13). A forged cookie gives a visitor nothing more than the global content anyone could already read.

### 5.4 Data

- **GU12 Play data for a visitor** `useActiveChild()` and `getMyChildSettings()` return a synthetic `ready` child for a visitor: `child_name = name`, `gender`, `avatar_path = null` and the head picture as `avatarUrl`, every sound path null, `music_volume` 30. `fetchCelebrationPictures()` returns `{ a: null, b: null, gender }`. `playerId()` returns null, so `familyOrGlobal` lists global rows only. No visitor code path calls `insert`, `update`, `upsert`, `rpc` or storage upload.
- **GU13 Migration** `20261108300000_guest_anon_read.sql` adds, idempotently (`drop policy if exists`), select policies `to anon`:
  - `quiz_sets`: `visibility = 'global' and status = 'published'`;
  - `memory_cards`, `spot_levels`, `find_levels`: `visibility = 'global' and active`;
  - `card_groups`: `visibility = 'global'`;
  - `questions`: its set is global and published (`exists` on `quiz_sets`);
  - `answers`: its question's set is global and published;
  - plus `grant select` on these tables to `anon` where missing.
  `puzzle_pictures` (active rows) and the public `media` bucket are already readable by anon. No function is granted to anon (20261105000000 stays true). `children`, `child_settings`, `profiles`, `review_events`, `support_messages` stay closed to anon.

### 5.5 Assets

- **GU14** `prince-head.webp`, `princess-head.webp`: square 320x320, the face and crown/hair centered, transparent outside, made from the existing webp with a one-off script (not committed); shown at 220 px on the cards and 120 px in the header.

## 6. Risks and how they are handled

| Risk | Handling |
|---|---|
| R1 An anon policy leaks private or pending rows. | Policies test `visibility = 'global'` explicitly; RLS tests (GT3) check a private, a pending and a draft row of a parent are invisible to anon, and that anon cannot insert/update/delete. |
| R2 Visitors get admin or upload rights. | No Auth user is created (Q1). `/admin/*` needs a profile. Storage writes need `can_write_media` (authenticated). |
| R3 Hard-coded child-facing text. | Gender cards use pictures, color, icon and the existing labels; English only on the grown-up details screen. |
| R4 Existing e2e break (`play-sign-in`, `back-leave`, `multiuser`). | The chooser step is added to their helpers; those specs run in the PR. |
| R5 Production lags `develop` (30+ commits; new seed pictures 404 there). | Shipping to production is a separate release, only when the PO asks. |
| R6 Shared device: next family sees the last guest's name. | By design until Leave (Q3); Leave is one sum away. |
| R7 Anonymous traffic cost (Supabase reads). | Read-only, small rows, the same queries a child already makes. Watch the Supabase usage after release. |
| R8 Global CSS `user-select: none` blocks an input. | Explicit `user-select: text` for inputs (NS1); e2e types and selects in the name and PIN fields. |

## 7. Tests (GT)

- **GT1** Unit: `lib/visitor.ts` (save, read, validate, clear, bad JSON, cookie without data).
- **GT2** Unit: middleware (`tests/middleware.test.ts`): visitor allowed on `/` and `/games/quiz`, `/play` to `/`, `/admin` to sign-in, profile beats visitor, `/play/sign-in` signed-in to `/play`, `/play/guest` open.
- **GT3** RLS (`tests/db/guest-anon.test.ts`): anon reads global published/active rows of every table in GU13, never private, pending or draft ones, and every anon write is refused.
- **GT4** Unit: `useActiveChild`, `fetchCelebrationPictures`, `playerId` in visitor mode; `LeaveGameButton` visitor path asks the sum and clears the visitor.
- **GT5** E2E `e2e/guest-play.spec.ts`: chooser → Guest → Girl → name + age → OK → Welcome with princess → a quiz → celebration with princess → Leave → sum → chooser, visitor data gone; Boy shows the prince; a visitor at `/admin` lands on sign-in; reload keeps the visitor.
- **GT6** E2E/unit for NS: a mouse drag across Welcome and a game leaves `window.getSelection()` empty; a picture has `draggable="false"`; the name input still selects its text.
- **GT7** `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:rls` green; e2e only for the changed screens (CLAUDE.md).
