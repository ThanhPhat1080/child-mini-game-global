# Children as a plain table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace child Auth accounts with a `children` table owned by a parent; children pick a card and a 4-character PIN on a parent-signed-in play device; parents manage children as gender-colored cards with a create/edit modal.

**Architecture:** One migration creates `children`, re-keys `child_settings`, removes the `child` role and deletes old child users. The play device keeps the parent's Supabase session; the chosen child's id lives in a plain cookie `cp_child`. Every play page already reads the child through `getMyChildSettings()`, so that one function is retargeted to the cookie.

**Tech Stack:** Next.js + React + TypeScript, Supabase (Postgres RLS), Vitest (`npx vitest run tests/<file>`), RLS tests on a throwaway Postgres (`npm run test:rls`), Playwright e2e on a stand-in Supabase.

**Spec:** `docs/superpowers/specs/2026-11-05-children-table-design.md` (IDs K1..K13, KU1..KU12, KT1..KT6). Cite IDs in commits.

## Global Constraints

- Schema changes only through a new `supabase/migrations/*.sql`; `npm run test:rls` stays green.
- No child-facing text is hard-coded and no screen for the child depends on reading (wrong PIN only shakes). Calm & Slow: pastel tokens, slow motion, honor `prefers-reduced-motion`; visible focus ring; keyboard works.
- Never use the service role key for children; no `app/api/children`. Only `NEXT_PUBLIC_` URL and anon key reach the browser.
- Not optimistic: create, edit and remove of a child (identity data, deletes). Remove always asks for confirmation.
- Colors: male card/modal background `#DCE8F1`, text `#3F6285`, accent `#8FB3D1`, icon ♂; female background `#F8DCDF`, text `#9A4550`, accent `#E59AA1`, icon ♀ (text darker than the pastel for contrast).
- PIN: exactly 4 characters `[A-Za-z0-9]`, stored as plain text. `child_name` 1 to 40 characters, unique across the service ignoring case and surrounding/extra spaces, never changed after insert. `display_name` 1 to 40. `gender` is `male` or `female`; `age_band` is `2-5` or `5-10`. At most 5 children per parent.
- Cookie `cp_child` (active child id): client-set, `path=/`, `SameSite=Lax`, no expiry. It is not a secret.
- Git: work on a branch from the current one; commit per task; never push to `main`/`develop`.

## Review Focus

- Delete a child who is the active child on the device: `cp_child` no longer resolves, so `/games` sends the device back to `/play` (Task 5 test).
- Names that differ only by case or surrounding/repeated spaces (`Lan`, ` lan `, `LAN`, `La  n` vs `La n`) are the same child and the second insert is `name_taken`; `La n` and `Lan` are different (Task 1 and Task 2 tests).
- A parent with zero children (or a Super Admin) opens `/play`: the Parent Configuration card still shows (Task 5 test).
- A parent edits a child through the API with a changed `child_name`, or another parent's `parent_id`: rejected by DB (Task 1 test).
- Two concurrent inserts racing for the sixth slot: one fails `too_many_children` (Task 1 test).

---

### Task 0: Branch and the work already in the tree

The tree holds earlier uncommitted work. Split it before starting.

- [ ] **Step 1:** `git checkout -b claude/children-table`.
- [ ] **Step 2:** Commit only the tab/header work: `components/admin/ContentTabs.tsx`, `components/admin/admin-ui.module.css`, `app/admin/(panel)/{cards,find,spot}/page.tsx`, `app/sign-up/page.tsx`, `tests/SignUpPage.test.tsx`, `supabase/config.toml`, `supabase/.gitignore` (message `feat: admin tabs, header layout and sign-up error messages`).
- [ ] **Step 3:** The name + PIN work (`lib/auth/childLogin.ts`, `lib/auth/accounts.ts` child parts, `app/api/children/route.ts`, `app/admin/(panel)/children/page.tsx`, `app/play/sign-in/page.tsx`, `tests/{api-children,ChildrenPage,PlaySignIn,childLogin}.test.ts*`, `docs/decision.md` ADR-034, migration `20261105010000_*`) is superseded by this plan: do not commit it. Tasks below overwrite or delete each of those files.

### Task 1: Database: `children`, RLS, role removal

**Files:**
- Create: `supabase/migrations/20261105020000_children_table.sql`, `tests/db/children.test.ts`
- Delete: `supabase/migrations/20261105010000_child_settings_on_role_update.sql` (untracked; then `npx supabase db reset` so local matches)
- Modify: `tests/db/harness.ts` (drop `'child'` from `TestRole`; add `createChild(parentId, over?)` returning the child id), `tests/db/{profiles,content-rls,child-settings,media,review,support}.test.ts` (remove or rewrite every `'child'` case)

**Interfaces:**
- Produces: table `public.children(id uuid pk default gen_random_uuid(), parent_id uuid not null default auth.uid() references profiles(user_id) on delete cascade, child_name text not null, display_name text not null, avatar_path text, gender text, age_band text, pin text, created_at)`; unique index on `lower(regexp_replace(btrim(child_name), '\s+', ' ', 'g'))`; `child_settings.child_id references children(id) on delete cascade` without `child_name` and `avatar_path`; `profiles.role in ('super_admin','parent')`; `can_read_content` and `owner_scope` without the `child` branch.

- [ ] **Step 1: Write failing tests** in `tests/db/children.test.ts` (names exact): `parent selects only own children`; `parent cannot insert for another parent` (parent_id mismatch rejected); `parent cannot update or delete another parent's child` (0 rows); `sixth child is rejected with too_many_children`; `two concurrent inserts for the last slot: one fails`; `child_name is unique across parents ignoring case and extra spaces` (`Lan`, ` lan ` and `LAN` collide; `La  n` collides with `La n`; `La n` does not collide with `Lan`); `changing child_name or parent_id on update is rejected`; `pin must be 4 letters or digits` (`12`, `12345`, `12 4`, `ab-1` rejected; `aB3z` ok); `gender and age_band checks`; `super admin selects and deletes all children`; `anon has no access`; `child_settings row is created on child insert and removed on delete`; `child_settings follows children RLS (other parent cannot read or update it)`; `profiles role check rejects 'child'`; `owner_scope returns the parent id for a parent`.
- [ ] **Step 2:** Run `npm run test:rls`; expect the new tests to FAIL.
- [ ] **Step 3:** Write the migration in this order: create `children` (K1) with checks and the unique index; trigger functions `children_limit` (advisory lock per parent, `too_many_children`, SQLSTATE 23514) and `children_immutable` (`child_name`, `parent_id`); RLS policies (K6: parent CRUD on `parent_id = auth.uid()` and not banned for writes, Super Admin select and delete, `revoke all ... from anon`, grants to `authenticated` and `service_role`); delete `auth.users` whose profile role is `child` (cascades profiles and old `child_settings`); drop `child_settings` columns `child_name`, `avatar_path`, drop its old FK and add `child_id references children(id) on delete cascade`; replace `create_child_settings()` trigger so it fires `after insert on children`; update role check, `profiles_guard` (no child rules, no `parent_id`), drop `profiles.parent_id`; recreate `owner_scope()` (parent: self) and `can_read_content` without `child`.
- [ ] **Step 4:** `npx supabase db reset`, then `npm run test:rls`; expect PASS (all files, including the edited old ones).
- [ ] **Step 5:** Commit `feat(db): children table, RLS and role removal (K1-K6,KT1,KT2)`.

### Task 2: Children data layer and active-child cookie

**Files:**
- Create: `lib/childTheme.ts`, `lib/children.ts`, `lib/childSession.ts`, `tests/children.test.ts`, `tests/childSession.test.ts`, `tests/childTheme.test.ts`
- Modify: `lib/settings.ts`, `tests/settings.test.ts`, `lib/media/refs.ts` + `tests/mediaRefs.test.ts` (the `avatar_path` reference moves from `child_settings` to `children`)
- Delete: `lib/auth/childLogin.ts`, `tests/childLogin.test.ts`, `app/api/children/route.ts`, `tests/api-children.test.ts`; in `lib/auth/accounts.ts` remove `parseChildInput`, `countChildren` and the `name_taken` code

**Interfaces:**
- Produces (`lib/childTheme.ts`): `type Gender = 'male' | 'female'`; `type AgeBand = '2-5' | '5-10'`; `GENDER_THEME: Record<Gender, { bg: string; text: string; accent: string; icon: '♂' | '♀'; label: 'Boy' | 'Girl' }>` with the Global Constraints colors.
- Produces (`lib/children.ts`): `type Child = { id; parent_id; child_name; display_name; avatar_path: string | null; gender: Gender; age_band: AgeBand; pin }`; `type NewChild = Pick<Child, 'child_name' | 'display_name' | 'avatar_path' | 'gender' | 'age_band' | 'pin'>`; `type ChildError = 'name_taken' | 'child_limit' | 'failed'`; `validateChild(input: Partial<NewChild>, mode: 'create' | 'edit'): Partial<Record<keyof NewChild, string>>` (messages in plain English); `listMyChildren(client?): Promise<Child[]>` ordered by `created_at`; `createChild(input: NewChild, client?): Promise<{ ok: true; child: Child } | { ok: false; error: ChildError }>`; `updateChild(id: string, patch: Partial<Omit<NewChild, 'child_name'>>, client?): Promise<{ ok: true } | { ok: false; error: ChildError }>`; `deleteChild(id: string, client?): Promise<{ ok: true } | { ok: false; error: 'failed' }>`; `getChildForPlay(id: string, client?): Promise<Child | null>`.
- Produces (`lib/childSession.ts`): `ACTIVE_CHILD_COOKIE = 'cp_child'`; `getActiveChildId(): string | null`; `setActiveChild(id: string): void`; `clearActiveChild(): void`.
- Produces (`lib/settings.ts`): `getMyChildSettings(client?): Promise<ChildSettings | null>` now reads the id from `getActiveChildId()` and returns `child_settings` plus `child_name` (= the child's `display_name`) and `avatar_path` taken from `children`, so every play page keeps working; `listMyChildren` moves to `lib/children.ts` (remove it here); `updateChildSettings` no longer accepts `child_name` or `avatar_path`.

- [ ] **Step 1: Failing tests.** `childTheme`: male and female entries match the constants. `children.validateChild`: `pin 'aB3z'` ok, `'123'` and `'12 4'` give a `pin` error, empty `display_name` and 41-character `child_name` give errors, `edit` mode ignores `child_name`. `children` with a fake client: `createChild` maps Postgres `23505` to `name_taken` and a `23514` carrying `too_many_children` to `child_limit`, any other error to `failed` without leaking its text; `updateChild` never sends `child_name`; `deleteChild` failure gives `failed`. `childSession`: set, get and clear round-trip through `document.cookie`; a malformed value returns `null`. `settings`: `getMyChildSettings` returns `null` without a cookie and merges `display_name` into `child_name` and `avatar_path` from `children`.
- [ ] **Step 2:** `npx vitest run tests/children.test.ts tests/childSession.test.ts tests/childTheme.test.ts tests/settings.test.ts tests/mediaRefs.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement the interfaces above. `createChild` inserts without `parent_id` (column default) and selects the row back.
- [ ] **Step 4:** Same command; expect PASS. `npm run typecheck`; errors in files that Tasks 3 to 5 own are expected here only if they still import deleted modules, so delete or retarget those imports in their tasks.
- [ ] **Step 5:** Commit `feat: children data layer and active-child cookie (K7,K8,KT1)`.

### Task 3: Roles, Super Admin and account routes

**Files:**
- Modify: `lib/auth/roles.ts` (`Role = 'super_admin' | 'parent'`, `ROLES`, drop `parent_id`, `adminAccess` loses its child branch), `app/api/users/route.ts` (remove the child branch), `lib/superAdmin.ts` (`CreatedRole`, `listPeople` roles, add `listAllChildren(): Promise<{ id: string; display_name: string; child_name: string; parent_id: string; parent_name: string | null }[]>` and `removeChild(id): Promise<void>`), `components/admin/CreateAccountForm.tsx` (`roles` no longer offers `child`), `app/admin/(super)/all-children/page.tsx` (read-only list with parent name and a confirmed remove), `tests/{AllChildren,CreateAccountForm,superAdmin,roles,api-users,middleware}.test.*` as they reference child
- Test: the files above

**Interfaces:**
- Consumes: `deleteChild` from Task 2 is not used here; Super Admin removal goes through RLS (`delete` policy) via `removeChild`.

- [ ] **Step 1: Failing tests.** `adminAccess` for a profile typed `child` no longer exists (type test by removing it); `/api/users` answers `400` for `role: 'child'`; `CreateAccountForm` shows no child option; all-children page lists children with the parent name, has no create form, and a remove asks for confirmation before calling `removeChild`.
- [ ] **Step 2:** `npx vitest run tests/AllChildren.test.tsx tests/CreateAccountForm.test.tsx tests/superAdmin.test.ts tests/api-users.test.ts tests/roles.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement. `listAllChildren` joins `children` with parent display names through two queries (children, then profiles `in` parent ids).
- [ ] **Step 4:** Same command plus `npm run typecheck`; expect PASS.
- [ ] **Step 5:** Commit `refactor: remove child role from app code, Super Admin children view (K13)`.

### Task 4: Parent Children page: cards and modal

**Files:**
- Create: `components/admin/ChildCard.tsx`, `components/admin/ChildModal.tsx`, `components/admin/ChildSounds.tsx` (the sounds editor of today's `ChildForm`, minus name and avatar, retargeted to `getChildSettings`/`updateChildSettings`)
- Modify: `app/admin/(panel)/children/page.tsx` (rewrite), `components/admin/admin-ui.module.css` (card, tooltip, segmented switch styles)
- Delete: `components/admin/ChildForm.tsx`
- Test: `tests/ChildCard.test.tsx`, `tests/ChildModal.test.tsx`, `tests/ChildrenPage.test.tsx` (rewrite), `tests/ChildSounds.test.tsx` (port the sound cases of the old ChildForm tests)

**Interfaces:**
- Consumes: `Child`, `NewChild`, `validateChild`, `createChild`, `updateChild`, `deleteChild`, `listMyChildren` (Task 2); `GENDER_THEME`; `ConfirmDialog`, `Toast`, `LibraryButton` (existing admin components).
- Produces: `ChildCard({ child, onEdit(): void, onRemove(): void })`; `ChildModal({ mode: 'create' | 'edit', child?: Child, onClose(): void, onSaved(c: Child): void })`; `ChildSounds({ childId: string })`.

- [ ] **Step 1: Failing tests.** `ChildCard`: male card shows display name, `@child_name`, age band, ♂ and the male colors in its inline style; female likewise with ♀; edit and remove buttons have accessible names `Edit <display name>` and `Remove <display name>` and a tooltip element with text `Edit` and `Remove` visible on hover and focus. `ChildModal`: create mode has an editable login name, edit mode shows it read-only with a lock and no input; clicking Girl then Boy changes the dialog's background and title colors immediately (assert style values) and sets `aria-pressed`; submitting with an invalid PIN shows a field error and does not call `createChild`; `name_taken` shows `That name is already used. Choose another.` under the name field and keeps the modal open; success calls `onSaved` and closes; Esc closes. `ChildrenPage`: lists children, Add child card disabled at 5 with the limit note, remove opens a confirm and only `deleteChild` on confirm then reloads, no optimistic removal.
- [ ] **Step 2:** `npx vitest run tests/ChildCard.test.tsx tests/ChildModal.test.tsx tests/ChildrenPage.test.tsx tests/ChildSounds.test.tsx`; expect FAIL.
- [ ] **Step 3:** Implement. Modal fields in order: Boy/Girl switch, display name, login name, avatar (`LibraryButton`, preview until Save), PIN (4 characters), age band segmented 2-5 / 5-10, welcome sound (`LibraryButton` for audio; written with `updateChildSettings` after the insert succeeds), and in edit mode a collapsed `More sounds` section that mounts `ChildSounds`. The modal and the page do not use optimistic updates (reload the list after success). Tooltips are CSS-only (`:hover`, `:focus-visible`) plus `aria-label`.
- [ ] **Step 4:** Same command plus `npm run typecheck` and `npx eslint app components lib`; expect PASS.
- [ ] **Step 5:** Commit `feat: children cards and modal with gender colors (KU1-KU8)`.

### Task 5: Play picker, PIN entry and route guard

**Files:**
- Create: `app/play/page.tsx`, `components/play/ChildPickCard.tsx`, `components/play/PinEntry.tsx`, `components/play/ParentConfigCard.tsx`, `tests/PlayPicker.test.tsx`, `tests/PinEntry.test.tsx`
- Modify: `app/play/sign-in/page.tsx` (restore the parent email + password form from `git show 70cfdf7:app/play/sign-in/page.tsx`; on success `router.push('/play')`), `tests/PlaySignIn.test.tsx` (restore from the same commit, expect `/play`), `middleware.ts` + `tests/middleware.test.ts`, `components/auth/LogoutButton.tsx` (rename to `BackToSignInButton` behavior: after the check, `signOut()`, `clearActiveChild()`, go to `/admin/sign-in`), `tests/LogoutButton.test.tsx`, `app/games/page.tsx` (its `LogoutButton` becomes a "switch child" control that calls `clearActiveChild()` and goes to `/play`; the grown-up check stays on it)

**Interfaces:**
- Consumes: `listMyChildren`, `getChildForPlay`, `GENDER_THEME`, `setActiveChild`, `clearActiveChild`, `AdultCheck` (existing).
- Produces: `PinEntry({ child, onCorrect(): void, onCancel(): void })` (4 boxes, compares to `child.pin`, wrong gives a shake with no text); `ChildPickCard({ child, onPick(): void })`; `ParentConfigCard({ onOpen(): void })` (peach, wrench icon, `aria-label="Parent configuration"`, tooltip).
- Draft guard (K10): `app/games/quiz/[setId]/page.tsx` loads its `quiz_sets` row first and treats a set whose `status` is not `published` like a missing set (back to `/games/quiz`), because a parent session can read its own drafts. The other play queries already filter `active` or `status = 'published'`; a test per game helper (`lib/{memory,sort,spot,find}/` loaders and `app/games/quiz/page.tsx`) keeps that filter from being removed.
- Middleware rule: for `/` and `/games/**`, no profile redirects to `/play/sign-in`; a profile without a `cp_child` cookie, or whose id does not select a row from `children` through RLS, redirects to `/play`. `/play` and `/play/sign-in` stay open. `/admin/**` rules are unchanged.

- [ ] **Step 1: Failing tests.** `PlayPicker`: cards render in the gender colors with the display name, the Parent Configuration card is last and also shown with zero children, tapping a card shows `PinEntry`; a wrong PIN shakes and stays; the right PIN calls `setActiveChild(child.id)` and goes to `/`; tapping Parent Configuration opens `AdultCheck`, a wrong sum shows a new sum and stays, the right sum goes to `/admin`; the back button needs the check and then signs out, clears the cookie and goes to `/admin/sign-in`; without a session the page goes to `/play/sign-in`; Left/Right move across cards, Enter picks, Esc leaves the PIN step. `quiz [setId]` page: a draft set id shows no questions and goes back to the set list. `middleware`: signed-in profile without cookie to `/games` redirects to `/play`; cookie of a deleted child redirects to `/play`; valid cookie passes; signed out goes to `/play/sign-in`; `/play` is never redirected.
- [ ] **Step 2:** `npx vitest run tests/PlayPicker.test.tsx tests/PinEntry.test.tsx tests/PlaySignIn.test.tsx tests/middleware.test.ts tests/LogoutButton.test.tsx`; expect FAIL.
- [ ] **Step 3:** Implement. `prefers-reduced-motion` turns the shake into a color flash. Reuse `AdultCheck` unchanged for both checks.
- [ ] **Step 4:** Same command plus `npx vitest run` (whole suite) and `npm run typecheck`; expect PASS.
- [ ] **Step 5:** Commit `feat: play child picker, PIN entry, parent configuration shortcut (K7-K12,KU9-KU12)`.

### Task 6: e2e stand-in, docs and final checks

**Files:**
- Modify: `e2e/support/standin-supabase.mjs` (add a `children` table with seed child `Test`, drop role `child` and the child profile, make `child_settings` seed reference the child id), `e2e/support/fixtures.ts`, `e2e/support/global-setup.ts` (parent signs in, picks the child with PIN `1234`, saves storage state including `cp_child`), `e2e/multiuser.spec.ts` (parent adds a child through the modal; child picks card and PIN and survives a reload; Parent Configuration needs the check; deleting the active child sends the device to `/play`; a ban keeps `/play` working), specs that mention `signInAsChild`
- Modify: `docs/decision.md` (ADR-035 supersedes ADR-033's child role and ADR-034), `CLAUDE.md` (roles line: `super_admin` and `parent`; children are table rows; play device keeps the parent session; rule about child accounts), `README.md` roles line, `docs/superpowers/specs/2026-11-05-children-table-design.md` (status Accepted)
- Run: graphify update

- [ ] **Step 1:** Update the stand-in, fixtures and `multiuser.spec.ts` as listed; run `npm run e2e`; expect all PASS (set `PW_CHROMIUM_PATH` if needed).
- [ ] **Step 2:** Write ADR-035 and the CLAUDE.md, README edits; mark the spec accepted.
- [ ] **Step 3:** Final verification: `npx vitest run`, `npm run test:rls`, `npm run typecheck`, `npx eslint app components lib`, `npm run e2e`, `graphify update .`; all green.
- [ ] **Step 4:** Commit `test+docs: e2e for the children table, ADR-035 (KT6)`. Tell the owner the branch name (`git fetch origin && git checkout claude/children-table`) and that the migration must be applied to the remote Supabase project (`supabase db push`) before deploying; it deletes existing child users.
