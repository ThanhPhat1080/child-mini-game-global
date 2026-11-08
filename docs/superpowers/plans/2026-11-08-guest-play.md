# Guest Play and No-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Child screens stop painting text selection and dragging picture ghosts (PR 1), and a visitor can play global games as a guest without an account: chooser, Boy/Girl, name + age, play, celebration with prince/princess, Leave with the sum erases the guest (PR 2).

**Architecture:** PR 1 is one CSS rule scoped to a `.hm-child` class on child roots plus `draggable={false}` in `Pic`. PR 2 adds a browser-only visitor session (`lib/visitor.ts`: localStorage + marker cookie), lets the middleware open `/` and `/games/*` for it, feeds a synthetic child into the existing play hooks, and adds anon read policies limited to global content. No Auth user is created and a visitor writes nothing.

**Tech Stack:** Next.js (App Router, middleware), React, TypeScript, CSS modules, Supabase (Postgres RLS), Vitest, pg RLS harness (`npm run test:rls`), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-08-guest-play-design.md` (decisions Q1-Q14, requirements NS1-NS4, GU1-GU14, GT1-GT7).

## Global Constraints

- PR 1 (NS) ships before PR 2 (GU), each as its own PR into `develop` (Q13). Merge only after the PO's OK. Never push to `main`/`develop`.
- Visitor = no account: never call `auth.signInAnonymously`, `insert`, `update`, `upsert`, `rpc` or storage upload in a visitor path (Q1, GU12).
- Anon policies show only `visibility = 'global'` rows that are published (`quiz_sets.status = 'published'`) or `active` (`memory_cards`, `spot_levels`, `find_levels`); `card_groups` global only (GU13). No function is granted to anon.
- Name 1-20 characters after trim; gender `male | female`; age band `'2-5' | '5-10'`, default `'2-5'` (Q4, Q8).
- Storage keys: localStorage `cp_visitor` (JSON `{ name, gender, ageBand }`), cookie `cp_visitor=1` (Path=/, SameSite=Lax, Max-Age one year) (GU6).
- Colors from `GENDER_THEME`: Boy accent `#8FB3D1`, text `#3F6285`; Girl accent `#E59AA1`, text `#9A4550`.
- Motion: gender pick FLIP about 600 ms ease-out, form slide about 500 ms starting 200 ms later; `prefers-reduced-motion` = cross-fade only (GU3).
- Child-facing: no new hard-coded text except the existing Boy/Girl labels and the grown-up details screen ("Child's name", "Age", "OK"), the chooser ("Log in", "Play as guest") (Q8).
- Admin pages keep normal text selection (Q11). The right-click menu is not blocked (Q12).
- The existing signed-in-parent guest (`cp_guest`, `GuestPickCard`) is untouched (Q6).
- Commits cite IDs (e.g. `NS1`, `GU6`) and end with the session's attribution lines. Run `graphify update .` after code changes.

## Review Focus

1. A forged `cp_visitor=1` cookie with no localStorage data: middleware lets `/` open, but the page must treat it as no visitor and send the browser to `/play/sign-in`, not crash. Test in Task 4 and Task 6.
2. A parent signs in on a device that still holds a visitor: after sign-in the visitor keys are gone and `/` needs a picked child again. Test in Task 7.
3. Name of only spaces, or 21 characters, or an emoji-heavy name: OK stays disabled for spaces and >20 code points (count with `[...name.trim()].length`). Test in Task 4.
4. Pending or private content of a parent stays invisible to anon even when it is `active`/published. Test in Task 3.
5. Typing in the name or PIN field with `.hm-child` on the page: selecting (shift+arrow, double-click) still works. Test in Task 1.

---

## PR 1: No-select on child screens (branch `claude/great-bohr-0i1ukz`, then PR into `develop`)

### Task 1: `.hm-child` no-select and no picture drag (NS1-NS4, GT6)

**Files:**
- Modify: `app/globals.css` (new rule block)
- Modify: `components/Stage.tsx` (root gets `hm-child`)
- Modify: `app/play/page.tsx`, `app/play/sign-in/page.tsx` (wrap gets `hm-child`)
- Modify: `components/Pic.tsx` (`draggable={false}` default, overridable by `rest`)
- Test: `tests/Pic.test.tsx` (new or existing), `e2e/no-select.spec.ts` (new)

**Interfaces:**
- Produces: CSS class `hm-child` for any later child root (Task 8 uses it on `/play/guest`).

- [ ] **Step 1: Write the failing tests**
  - `tests/Pic.test.tsx`: `it('renders pictures as not draggable')` renders `<Pic src="/seed/fish.svg" alt="" />` and expects the `img` to have `draggable="false"`.
  - `e2e/no-select.spec.ts`: `test('dragging over Welcome selects nothing')` signs in as the fixture parent with a child (reuse helpers in `e2e/support/fixtures.ts`), opens `/`, `mouse.down()` at (100,100), `mouse.move()` to (1200,700) in 10 steps, `mouse.up()`, expects `await page.evaluate(() => String(getSelection()))` to be `''`. Same on `/games`. `test('PIN field still selects')`: on `/play`, open a PIN entry, type `abcd`, press `Control+A`, expect selection `'abcd'`.
- [ ] **Step 2: Run, expect FAIL**: `npx vitest run tests/Pic.test.tsx`; `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/no-select.spec.ts --trace off`.
- [ ] **Step 3: Implement**
  - `globals.css`:
    ```css
    .hm-child, .hm-child * { user-select: none; -webkit-user-select: none; }
    .hm-child img, .hm-child svg image { -webkit-user-drag: none; }
    .hm-child input, .hm-child textarea, .hm-child [contenteditable] { user-select: text; -webkit-user-select: text; }
    ```
  - Add `hm-child` to the outermost element of `Stage` and the two `/play` wraps (keep existing classes).
  - `Pic`: pass `draggable={false}` before `{...rest}`.
- [ ] **Step 4: Run, expect PASS**, plus `e2e/pairs-play.spec.ts`, `e2e/sort-play.spec.ts`, `e2e/play-sign-in.spec.ts` (their own drag/typing must still work).
- [ ] **Step 5:** `npm run typecheck && npm run lint && npm test`, then commit `feat(play): no text selection or picture drag on child screens (NS1-NS4)`, push, open PR "No-select on child screens" into `develop`, tell the PO.

---

## PR 2: Guest Play (new branch from `develop` after PR 1 merges, e.g. `claude/guest-play`)

### Task 2: Mockup gate and head pictures (Q9, Q10, GU14)

**Files:**
- Create (scratchpad, not committed): mockup HTML of the 4 steps (chooser, gender, transition, details) with motion, published as a private Artifact.
- Create: `public/images/prince-head.webp`, `public/images/princess-head.webp`

- [ ] **Step 1:** Cut the heads with a one-off `sharp` script in the scratchpad from `public/images/prince.webp` and `princess.webp`: square 320x320, face + crown/hair centered, transparent outside a circle; check them in a contact sheet screenshot.
- [ ] **Step 2:** Build the mockup with the real heads, colors (Global Constraints), fonts (Baloo 2 / Nunito) and timings; publish it; send the link to the PO.
- [ ] **Step 3:** Iterate until the PO approves. Write any change of layout or timing back into the spec (section 5.1) before coding. **No code of Tasks 6-9 before approval.**
- [ ] **Step 4:** Commit the two webp files `feat(guest): prince and princess head pictures (GU14)`.

### Task 3: Anon read of global content (GU13, GT3)

**Files:**
- Create: `supabase/migrations/20261108300000_guest_anon_read.sql`
- Create: `tests/db/guest-anon.test.ts`
- Modify: `e2e/support/standin-supabase.mjs` (anon requests see global published/active rows only)

**Interfaces:**
- Produces: policies `<table>_select_anon` on `quiz_sets`, `memory_cards`, `spot_levels`, `find_levels`, `card_groups`, `questions`, `answers`.

- [ ] **Step 1: Write the failing test** `tests/db/guest-anon.test.ts` with the harness (`createUser`, `superQuery`, `as(null)`), one parent and the content table list of `tests/db/content-rls.test.ts`:
  - `it('anon reads a global published row of <table>')`: row visible.
  - `it('anon never reads private, pending, or unpublished global rows of <table>')`: each invisible.
  - `it('anon reads questions and answers of a global published set only')`: a private set's question and answer return 0 rows.
  - `it('anon cannot write')`: insert, update, delete on each table fail or affect 0 rows.
  - `it('anon still reads nothing from children, child_settings, profiles')`.
- [ ] **Step 2: Run, expect FAIL**: `npm run test:rls -- tests/db/guest-anon.test.ts` (read-only rows fail).
- [ ] **Step 3: Write the migration**: for each table `drop policy if exists <t>_select_anon` then `create policy <t>_select_anon on public.<t> for select to anon using (<rule>)` with the rules of the Global Constraints; `questions`: `exists (select 1 from public.quiz_sets s where s.id = set_id and s.visibility = 'global' and s.status = 'published')`; `answers`: the same through `questions`; `grant select on` the seven tables `to anon`. No function grant.
- [ ] **Step 4: Run** `npm run test:rls` (whole suite), expect PASS.
- [ ] **Step 5:** Stand-in: in the content read handlers, when the request is anonymous, filter to global + published/active (mirror the migration). Commit `feat(db): anon reads global content only (GU13)`. Do not apply to Supabase until the PR is approved; then apply with the Supabase MCP `apply_migration` named `guest_anon_read`.

### Task 4: Visitor session library (GU6, GT1)

**Files:**
- Create: `lib/visitor.ts`
- Test: `tests/visitor.test.ts` (jsdom)

**Interfaces:**
- Produces:
  ```ts
  export const VISITOR_COOKIE = 'cp_visitor';
  export type Visitor = { name: string; gender: Gender; ageBand: AgeBand };
  export function validateVisitor(input: { name: string; gender: Gender | null; ageBand: AgeBand }): { ok: true; value: Visitor } | { ok: false; errors: { name?: string; gender?: string } };
  export function saveVisitor(v: Visitor): void;
  export function getVisitor(): Visitor | null;
  export function isVisitor(): boolean;
  export function clearVisitor(): void;
  export const VISITOR_HEAD: Record<Gender, string>; // '/images/prince-head.webp', '/images/princess-head.webp'
  ```
  (`Gender` from `lib/childTheme`, `AgeBand` from `lib/children`.)

- [ ] **Step 1: Write the failing tests**: save then get returns the same value with name trimmed; cookie `cp_visitor=1` set; `clearVisitor()` removes both; cookie with no localStorage → `getVisitor()` null and `isVisitor()` false; bad JSON → null; `validateVisitor` rejects `'   '`, a 21-code-point name, a null gender, and accepts a 20-code-point emoji name; storage that throws → `getVisitor()` null, no throw.
- [ ] **Step 2: Run** `npx vitest run tests/visitor.test.ts`, expect FAIL.
- [ ] **Step 3: Implement** following `lib/childSession.ts` (same cookie helpers style; wrap storage in try/catch).
- [ ] **Step 4: Run**, expect PASS. Commit `feat(guest): visitor session (GU6)`.

### Task 5: Middleware routes for visitors (GU9-GU11, GT2)

**Files:**
- Modify: `middleware.ts`
- Test: `tests/middleware.test.ts`

**Interfaces:**
- Consumes: `VISITOR_COOKIE` (Task 4).

- [ ] **Step 1: Write the failing tests** (extend the existing `h.who` setup, add a visitor cookie helper):
  - signed out + `cp_visitor=1`: `/` and `/games/quiz` pass; `/play` redirects to `/`; `/admin` redirects to `/admin/sign-in`.
  - signed out, no cookie: `/` redirects to `/play/sign-in` (unchanged).
  - parent + `cp_visitor=1` and no child: `/` redirects to `/play` (profile beats visitor).
  - parent on `/play/sign-in` redirects to `/play`; signed out on `/play/sign-in` and `/play/guest` passes.
- [ ] **Step 2: Run** `npx vitest run tests/middleware.test.ts`, expect FAIL.
- [ ] **Step 3: Implement**: add `/play/guest` to `OPEN`; take `/play/sign-in` and `/play` out of the early `OPEN` return only far enough to apply the two new redirects (signed-in on `/play/sign-in` → `/play`; visitor without profile on `/play` → `/`); in the play branch, `!profile && visitor` → allowed.
- [ ] **Step 4: Run**, expect PASS (whole file). Commit `feat(guest): middleware opens play pages for a visitor (GU9-GU11)`.

### Task 6: Visitor as the active child (GU5, GU12, GT4)

**Files:**
- Modify: `lib/settings.ts` (`getMyChildSettings`), `lib/useActiveChild.ts`, `lib/celebration.ts` (`fetchCelebrationPictures`), `lib/review.ts` (`playerId`)
- Modify: `app/page.tsx` (when `useActiveChild()` is `failed`, no session child and `getVisitor()` is null, i.e. a bare or forged `cp_visitor` cookie: call `clearVisitor()` and `router.replace('/play/sign-in')`; Review Focus 1)
- Test: `tests/visitorPlay.test.ts`

**Interfaces:**
- Consumes: `getVisitor`, `VISITOR_HEAD` (Task 4).
- Produces: in visitor mode `getMyChildSettings()` resolves `{ child_id: 'visitor', greeting_path: null, music_path: null, music_volume: 30, hooray_path: null, ohoh_path: null, complete_path: null, child_name: v.name, avatar_path: null, gender: v.gender }`; `useActiveChild()` → `ready` with `avatarUrl = VISITOR_HEAD[gender]`; `fetchCelebrationPictures()` → `{ a: null, b: null, gender }`; `playerId()` → `null`.

- [ ] **Step 1: Write the failing tests**: with a saved visitor and a Supabase client mock whose `from` throws, each function returns the values above and the mock was never called; with no visitor the old paths still run.
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement**: each function checks `getVisitor()` first and returns early. Visitor is checked before `isGuestPlay()` in `playerId`.
- [ ] **Step 4: Run** `npm test`, expect PASS. Commit `feat(guest): the visitor plays as the active child (GU12)`.

### Task 7: Chooser on `/play/sign-in` (GU1, GU8)

**Files:**
- Create: `components/play/EntryChooser.tsx` (two cards, keyboard Left/Right/Enter/Space)
- Modify: `app/play/sign-in/page.tsx` (state `'choose' | 'login'`; back arrow on login; `clearVisitor()` after a successful sign-in), `app/admin/sign-in/page.tsx` (`clearVisitor()` after success), `app/play/play.module.css`
- Test: `tests/EntryChooser.test.tsx`, `e2e/play-sign-in.spec.ts` (click "Log in" first)

**Interfaces:**
- Produces: `<EntryChooser onLogin(): void />`; the Guest card is a link to `/play/guest`.

- [ ] **Step 1: Write the failing tests**: chooser renders buttons named "Log in" and "Play as guest"; ArrowRight moves focus from Log in to Guest; Enter on Log in calls `onLogin`; Guest href is `/play/guest`. E2E: `/play/sign-in` shows the chooser, "Log in" reveals the email field, back returns to the cards; after sign-in `localStorage.cp_visitor` is null (seed it first: Review Focus 2).
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement** with the approved mockup's layout; fade between states (reduced motion: no transform).
- [ ] **Step 4: Run** unit tests and `e2e/play-sign-in.spec.ts`, `e2e/multiuser.spec.ts`, expect PASS (update their helpers to click "Log in" first).
- [ ] **Step 5:** Commit `feat(guest): Log in or Guest chooser (GU1, GU8)`.

### Task 8: Guest setup page `/play/guest` (GU2-GU4)

**Files:**
- Create: `app/play/guest/page.tsx`, `app/play/guest/guest.module.css`, `components/play/GenderCards.tsx`, `components/play/GuestDetails.tsx`, `components/play/AgeSwitch.tsx`
- Test: `tests/GuestSetup.test.tsx`

**Interfaces:**
- Consumes: `validateVisitor`, `saveVisitor`, `VISITOR_HEAD` (Task 4); `GENDER_THEME`; `hm-child` (Task 1).
- Produces: `<AgeSwitch value: AgeBand onChange(v: AgeBand) />` (radio-like buttons with `aria-pressed`, `segBtn` look at ~1.6x: height 58 px, font 24 px Nunito).

- [ ] **Step 1: Write the failing tests**: step 1 shows two buttons with accessible names "Boy" and "Girl" and head pictures; clicking Girl shows a text field labelled "Child's name" and the age buttons with "2-5" pressed; OK disabled for `''` and `'   '`, enabled for `'Mai'`; Enter in the field submits; submit calls `saveVisitor({ name: 'Mai', gender: 'female', ageBand: '2-5' })` and `router.push('/')`; Back on step 2 returns to step 1 and keeps `'Mai'`; Back on step 1 goes to `/play/sign-in`; Left/Right moves between Boy and Girl.
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement**: root has `hm-child` and the sky scene of `/play/sign-in`; FLIP with `getBoundingClientRect` before/after and a CSS transform transition (Global Constraints timings); `matchMedia('(prefers-reduced-motion: reduce)')` → opacity only. A visitor who already exists and opens `/play/guest` starts at step 1 with the saved values.
- [ ] **Step 4: Run**, expect PASS. Screenshot both steps (Boy and Girl, deviceScaleFactor 2) and compare with the mockup; send to the PO.
- [ ] **Step 5:** Commit `feat(guest): gender and details setup (GU2-GU4)`.

### Task 9: Leave erases the visitor (GU7)

**Files:**
- Modify: `components/auth/LeaveGameButton.tsx`
- Test: `tests/LeaveGameButton.test.tsx` (new or existing)

**Interfaces:**
- Consumes: `isVisitor`, `clearVisitor` (Task 4); `AdultCheck` with `twoDigit`.

- [ ] **Step 1: Write the failing tests**: visitor mode, Leave → `AdultCheck` opens; a right answer calls `clearVisitor`, `stopMusic` and `router.push('/play/sign-in')`; cancel keeps the dialog closed and the visitor saved; non-visitor path unchanged (no sum, goes to `/play`).
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement**: on Leave, if `isVisitor()` open `AdultCheck` (`twoDigit`, centered) instead of leaving at once. Update the component doc comment (sum only for visitors).
- [ ] **Step 4: Run**, expect PASS. Commit `feat(guest): leaving asks the sum and erases the guest (GU7)`.

### Task 10: End-to-end, docs, release of the PR (GT5, GT7)

**Files:**
- Create: `e2e/guest-play.spec.ts`
- Modify: `spec.md` (new section "Guest Play" with GU1-GU14 and NS1-NS4 one line each, pointing to the spec), `CLAUDE.md` (one line in Rules: "A visitor (guest, no account) plays global content only; `lib/visitor.ts`; leaving asks the sum and erases it."), `e2e/back-leave.spec.ts` if its flow changed

- [ ] **Step 1: Write** `e2e/guest-play.spec.ts`: Girl flow to Welcome (princess hero visible), open a global quiz, finish it, celebration shows `princess.webp`; reload keeps the visitor; `/admin` lands on `/admin/sign-in`; `/play` lands on `/`; Leave → sum → chooser and `localStorage.cp_visitor` null; Boy flow shows `prince.webp`; a private quiz of the fixture parent is not listed.
- [ ] **Step 2: Run** `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/guest-play.spec.ts e2e/play-sign-in.spec.ts e2e/back-leave.spec.ts e2e/multiuser.spec.ts --trace off`, expect PASS.
- [ ] **Step 3:** `npm run typecheck && npm run lint && npm test && npm run test:rls`, all green; `graphify update .`.
- [ ] **Step 4:** Commit docs, push, open PR "Guest Play" into `develop` with screenshots; after the PO's OK apply the migration (Task 3 Step 5) and merge. Production only on a separate "release" request.
