# Phase 3 Multi-user Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let parents self-register, create 1 to 5 child accounts and their own game content, share content globally through Super Admin review, with bans, quota and a Super Admin console.

**Architecture:** One Supabase project; `profiles` (role) plus `owner_id` and `visibility` on content, enforced by RLS and `security definer` functions (all authorization lives in the DB). Child/Super-Admin account creation runs server-side in Next.js route handlers with the service-role key. Authorization is proven by a DB test suite on real Postgres; UI flows by Vitest and Playwright (extended stand-in).

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (`@supabase/ssr`), Vitest, Playwright, Postgres via Docker for DB tests (new dev dependency `pg`).

**Spec:** `docs/superpowers/specs/2026-11-04-multi-user-phase3-design.md` (IDs U/V/Q/N/T below refer to it).

## Global Constraints

- Schema changes only as new `supabase/migrations/*.sql` files; never edit existing migrations; never paste SQL in the dashboard.
- Service-role key only in server-only code and env var `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_`). Only the Supabase URL and anon key may be `NEXT_PUBLIC_`.
- Client-supplied auth metadata must never decide a role or parent link.
- Max 5 children per parent; quota default `52428800` bytes; per-file limit 2 MB for images and sounds (UI only).
- Child-facing screens have no hard-coded text and need no reading; adult screens (sign-up, admin, suspended, carousel) may contain text (Vietnamese with an English line where the spec says so).
- Calm & Slow tokens, Baloo 2 (child) / Nunito (admin), desktop Chromium only.
- Commits cite spec IDs and end with the attribution lines from the session reminder. Work stays on branch `claude/great-bohr-0i1ukz`.
- Before each commit: `npm run typecheck`, `npm run lint`, `npm test` pass (and `npm run test:rls` once Task 1 exists).

## Review Focus

1. A sign-up request that puts `role: 'super_admin'` or a `parent_id` in user metadata must still produce a plain `parent` (test in Task 2).
2. Concurrent creation of the 6th child must fail for one of the two requests, and a failed child creation must leave no orphan auth user (Tasks 2, 7).
3. A parent banned while holding a valid session is blocked on the next request, and their writes are rejected by RLS, not just by the UI (Tasks 3, 6).
4. Two uploads racing past the 50 MB quota: at most one succeeds; deleting a file used only by someone else's `global` content is refused (Task 5).
5. Sign-up without a policy version in metadata is rejected by the DB (the disabled Register button is not a security control) (Task 8).

---

## File Structure

- `supabase/migrations/20261104000000_profiles_roles.sql`, `…010000_content_ownership_rls.sql`, `…020000_child_settings.sql`, `…030000_review_workflow.sql`, `…040000_media_quota_storage.sql`, `…050000_support_messages.sql`
- `tests/db/` (DB suite: `harness.ts`, one file per migration); `docker-compose.test.yml`
- `lib/auth/roles.ts`, `lib/policy/reasons.ts`, `lib/policy/slides.ts`, `lib/supabase/server.ts`, `lib/supabase/service.ts`, `lib/settings.ts`, `lib/review.ts`
- `app/api/children/route.ts`, `app/api/users/route.ts`
- `app/admin/(panel)/…` role-aware pages; `app/admin/{forbidden,suspended}/page.tsx`; `app/admin/(super)/{queue,parents,children,content,messages}/page.tsx`; `app/sign-up/page.tsx`; `app/play/sign-in/page.tsx`
- `components/auth/{PolicyCarousel,AdultCheck}.tsx`, `components/admin/{VisibilityBadge,ContentTabs,ShareToggle,QuotaMeter,BanDialog}.tsx`

---

### Task 1: DB test harness on real Postgres

**Files:** Create `docker-compose.test.yml`, `tests/db/harness.ts`, `tests/db/harness.test.ts`; Modify `package.json` (script `test:rls`, devDependency `pg`), `vitest.config.ts` (exclude `tests/db` from `npm test`), `.github/workflows/e2e.yml` or new `rls.yml`.

**Interfaces — Produces:**
- `startDb(): Promise<void>` applies every `supabase/migrations/*.sql` in order to a fresh database; `resetDb(): Promise<void>`.
- `createUser(role: 'super_admin'|'parent'|'child', opts?: { parentId?: string; banned?: boolean }): Promise<string>` returns the user id (inserts `auth.users` + `profiles` as a superuser).
- `as(userId: string | null): { query<T>(sql: string, params?: unknown[]): Promise<T[]> }` runs inside a transaction with `set local role authenticated` (or `anon` for null) and `request.jwt.claims` = `{sub: userId, role: 'authenticated'}`.

- [ ] **Step 0 (baseline):** run `npm ci && npm run typecheck && npm run lint && npm test && npm run build` on the untouched import; record any failure in the commit message of this task and fix only what blocks the plan.
- [ ] **Step 1:** Failing test `harness.test.ts`: `it('applies migrations and isolates roles')` creates two parents, asserts `as(a).query('select count(*) from public.profiles')` runs and `as(null)` cannot read `profiles`.
- [ ] **Step 2:** Run `npm run test:rls`; expected FAIL (no harness).
- [ ] **Step 3:** Implement using the `supabase/postgres` image (has `auth`, `storage`, roles `anon`/`authenticated`/`service_role`); `docker-compose.test.yml` exposes port 54322. If Docker cannot run in the session, report it and stop; do not swap in a fake.
- [ ] **Step 4:** Run `npm run test:rls`; expected PASS. Run `npm test`; expected unchanged (DB suite excluded).
- [ ] **Step 5:** Commit `test: DB harness for RLS (T1)`.

### Task 2: `profiles`, roles and triggers (U1, U2, U6, review focus 1-2)

**Files:** Create `supabase/migrations/20261104000000_profiles_roles.sql`, `tests/db/profiles.test.ts`.

**Interfaces — Produces (SQL):** table `public.profiles(user_id, role, parent_id, display_name, banned, ban_reason_code, ban_note, banned_at, policy_version_accepted, policy_accepted_at, quota_bytes default 52428800, created_at)`; functions `current_role() returns text`, `owner_scope() returns uuid`, `is_banned(uuid) returns boolean`; trigger on `auth.users` insert creating a `parent` profile; `public.is_admin()` kept as `current_role() = 'super_admin'` only until Task 3 rewrites policies, then dropped.

- [ ] **Step 1:** Failing tests: `a client cannot read or write another profile`; `inserting auth.users with raw_user_meta_data {"role":"super_admin","parent_id":"<x>"} yields role parent with null parent_id`; `sign-up metadata without policy_version raises`; `a parent gets at most 5 children, the 6th insert (also two concurrent inserts for the 5th slot) fails`; `a child must have a parent`; `owner_scope returns self for parent, parent_id for child, null for super_admin`.
- [ ] **Step 2:** Run; expected FAIL.
- [ ] **Step 3:** Write the migration. Children limit uses `pg_advisory_xact_lock(hashtext(parent_id::text))` in the trigger. The signup trigger reads only `raw_user_meta_data->>'policy_version'` and stores it; role is always `parent` there. Children and Super Admins are inserted only by service role.
- [ ] **Step 4:** Run `npm run test:rls`; expected PASS.
- [ ] **Step 5:** Commit `feat(db): profiles and roles (U1,U2,U6)`.

### Task 3: Content ownership, visibility and RLS rewrite (U3, U5, V1, V5, V6)

**Files:** Create `…010000_content_ownership_rls.sql`, `tests/db/content-rls.test.ts`.

First read migrations `20261029100000`, `20261030000000`, `20261030110000`, `20261030100000`, `20261030120000` to confirm row granularity. Decision recorded here: `visibility` and `owner_id` sit on each row of `quiz_sets`, `memory_cards`, `spot_levels`, `card_groups`, `find_levels`; sharing acts on rows (the UI shares a selection); a card keeps its group's owner (enforced by trigger).

**Interfaces — Produces:** enum `public.visibility('private','pending','global')`; columns `owner_id uuid not null`, `visibility default 'private'` on the five tables; existing rows get `owner_id` of the first Super Admin (migration looks it up; fails loudly if none exists); all old `*_admin_*` and `*_read_published` policies replaced.

- [ ] **Step 1:** Failing tests, per table via `it.each(CONTENT_TABLES)`: `parent B cannot select parent A's private row`; `child of A selects A's published private row and any published global row`; `child cannot insert, update or delete`; `parent edits own private row, cannot edit when pending or global`; `parent cannot set visibility directly to global`; `super admin reads and updates everything`; `rows of a banned owner are invisible to all but super admin and return on unban`; `anon selects nothing`. For `questions`/`answers`: same visibility as their set.
- [ ] **Step 2:** Run; expected FAIL.
- [ ] **Step 3:** Implement policies with `current_role()`, `owner_scope()`, `is_banned(owner_id)`; a `before update` trigger blocks any non-super-admin change to `visibility`/`owner_id` (changes go through Task 5 functions only). Drop `is_admin()` once nothing references it.
- [ ] **Step 4:** Run `npm run test:rls`; expected PASS.
- [ ] **Step 5:** Commit `feat(db): ownership, visibility and RLS (U3,U5,V1,V5,V6)`.

### Task 4: `child_settings` (U4)

**Files:** Create `…020000_child_settings.sql`, `tests/db/child-settings.test.ts`; Create `lib/settings.ts`, `tests/settings.test.ts`.

**Interfaces — Produces:** `type ChildSettings = { child_id: string; child_name: string | null; avatar_path: string | null; hooray_path: string | null; ohoh_path: string | null; complete_path: string | null; music_volume: number; feedback_sounds: boolean }` (copy the remaining columns from the current `settings` table); `getMyChildSettings(client?): Promise<ChildSettings | null>`; `getChildSettings(childId, client?): Promise<ChildSettings | null>`; `updateChildSettings(childId, patch: Partial<ChildSettings>, client?): Promise<void>`.

- [ ] **Step 1:** Failing DB tests: `child reads only own row`; `parent reads and updates own children's rows, not others'`; `child cannot update`; `a row is created when a child profile is inserted`. Failing unit test: `getMyChildSettings returns the row for the signed-in child`.
- [ ] **Step 2:** Run both; expected FAIL.
- [ ] **Step 3:** Migration creates the table, trigger creating a default row, copies the old singleton into the first child if one exists, drops `settings`. `lib/settings.ts` wraps the queries.
- [ ] **Step 4:** Run; expected PASS.
- [ ] **Step 5:** Commit `feat: per-child settings (U4)`.

### Task 5: Review workflow, ban, media quota and in-use functions (V2-V5, V7, U15, Q2-Q6)

**Files:** Create `…030000_review_workflow.sql`, `…040000_media_quota_storage.sql`, `tests/db/review.test.ts`, `tests/db/media.test.ts`.

**Interfaces — Produces (SQL functions, all `security definer`, `search_path` pinned):** `share_item(p_table text, p_id uuid) returns void` (owner, private to pending); `review_approve(p_table, p_id)`, `review_reject(p_table, p_id, p_note text)`, `unpublish_item(p_table, p_id)`, `delete_item(p_table, p_id)` (super admin only); `request_edit(p_table, p_id, p_note text)` (owner of a global row; writes a `review_events` row); `ban_parent(p_user uuid, p_code text, p_note text)` (code must be one of the 8 in spec 5.1; target must be a parent); `unban_parent(p_user uuid)`; `set_quota(p_user uuid, p_bytes bigint)`; `media_in_use(p_path text) returns boolean` (scans all content tables, ignores RLS); `storage_used(p_owner uuid) returns bigint`; table `review_events`. Storage policies: write only under `<auth.uid()>/` for non-child roles; insert trigger on `storage.objects` raising `quota_exceeded` when `storage_used + new size > quota_bytes` (advisory lock per owner); delete policy requires `not media_in_use(name)`; read stays for any authenticated user (policy `media_read_authenticated`).

- [ ] **Step 1:** Failing tests: lifecycle `private -> pending -> global -> unpublished -> private`, reject returns to private with a readable note, empty reject note raises; non-owners and children calling `share_item` fail; `request_edit` only on own global rows; `ban_parent` rejects unknown code, a super admin target, a child target; banning hides all that parent's rows, `unban_parent` restores exact previous visibility values; `set_quota` super admin only; quota: a file that would exceed 50 MB is rejected, two concurrent uploads that together exceed it → one fails; `media_in_use` is true for a path used only by another owner's global row and `delete` on it is refused; a child cannot upload.
- [ ] **Step 2:** Run; expected FAIL.
- [ ] **Step 3:** Implement migrations to satisfy the tests.
- [ ] **Step 4:** Run `npm run test:rls`; expected PASS.
- [ ] **Step 5:** Commit `feat(db): review, ban, quota, media guard (V2-V7,U15,Q2-Q6)`.

### Task 6: `support_messages` (U17)

**Files:** Create `…050000_support_messages.sql`, `tests/db/support.test.ts`.

- [ ] **Step 1:** Failing tests: `a banned parent inserts a message for themselves and reads only their own`; `the 6th message in one day raises`; `body over 2000 chars raises`; `super admin reads all and sets read_at/resolved_at`; `other parents and children cannot read or insert`.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement. **Step 4:** Run; expected PASS.
- [ ] **Step 5:** Commit `feat(db): support messages (U17)`.

### Task 7: Auth core: roles lib, server clients, middleware, child-creation API (U8, U11-U13)

**Files:** Create `lib/auth/roles.ts`, `lib/supabase/server.ts`, `lib/supabase/service.ts`, `app/api/children/route.ts`, `app/api/users/route.ts`, `app/admin/forbidden/page.tsx`, `app/admin/suspended/page.tsx`, `tests/roles.test.ts`, `tests/api-children.test.ts`; Modify `middleware.ts`, `.env.example` (add `SUPABASE_SERVICE_ROLE_KEY=` with a comment: server only).

**Interfaces — Produces:**
- `type Role = 'super_admin' | 'parent' | 'child'`; `type Profile` (columns of Task 2, `quota_bytes: number`).
- `getMyProfile(client: SupabaseClient): Promise<Profile | null>`.
- `adminAccess(p: Profile | null): 'ok' | 'signin' | 'forbidden' | 'banned'` (null → signin; child → forbidden; banned parent → banned; super admin and unbanned parent → ok).
- `createSupabaseServerClient(): Promise<SupabaseClient>` (cookie-aware) and `createSupabaseServiceClient(): SupabaseClient` (throws if called without the env var; only imported by route handlers).
- `POST /api/children` body `{ email: string; password: string; displayName: string }` → `201 { childId }`; `401` unauthenticated; `403` not parent/super admin or banned; `409` already 5 children or email taken; on any failure after the auth user was created, that user is deleted.
- `POST /api/users` (super admin only) body `{ role: Role; email; password; displayName; parentId?: string }` → `201 { userId }`.

- [ ] **Step 1:** Failing tests: `adminAccess` for all five profile cases; route handler tests with mocked clients: 401/403/409 cases, rollback deletes the auth user when the profile insert fails, response never contains the service key.
- [ ] **Step 2:** Run `npx vitest run tests/roles.test.ts tests/api-children.test.ts`; expected FAIL.
- [ ] **Step 3:** Implement. Middleware: `/admin/sign-in`, `/admin/forbidden`, `/admin/suspended` are open; others use `adminAccess` and redirect (`signin` → `/admin/sign-in`, `forbidden` → `/admin/forbidden`, `banned` → `/admin/suspended`). Forbidden page: plain "You don't have permission" with a sign-out button. Add `/play/:path*` matcher requiring any signed-in profile, else redirect to `/play/sign-in` (U12).
- [ ] **Step 4:** Run those tests plus `npm test`; expected PASS.
- [ ] **Step 5:** Commit `feat: role-aware access and account creation API (U8,U11-U13)`.

### Task 8: Parent sign-up with the policy carousel (U7, U16, N1)

**Files:** Create `lib/policy/reasons.ts`, `lib/policy/slides.ts`, `components/auth/PolicyCarousel.tsx`, `public/policy/slide-1.svg … slide-6.svg`, `app/sign-up/page.tsx`, `tests/PolicyCarousel.test.tsx`, `tests/SignUpPage.test.tsx`.

**Interfaces — Produces:**
- `type BanReason = 'inaccurate'|'sexual'|'violent_scary'|'political'|'hate'|'off_target'|'personal_or_copyright'|'other'`; `BAN_REASONS: readonly { code: BanReason; label: string }[]` (the 8 of spec 5.1, Vietnamese label plus English line).
- `POLICY_VERSION = '2026-11-04'`; `POLICY_SLIDES: readonly { image: string; vi: string; en: string }[]` (6 items in the order of spec 5.2).
- `PolicyCarousel(props: { open: boolean; onClose(): void; onAccept(): void })`: Register button disabled until the last slide has been shown; dots cannot jump past the furthest viewed slide; arrow keys work; closing calls `onClose` without `onAccept`.

- [ ] **Step 1:** Failing tests: `Register is disabled on slides 1-5 and enabled on slide 6`; `clicking dot 6 from slide 1 does nothing`; `Back works and the furthest-viewed rule holds`; `closing never calls onAccept`; sign-up page: `Create account opens the carousel and does not call signUp`; `onAccept calls supabase.auth.signUp with options.data.policy_version = POLICY_VERSION`; password and email validation messages.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement (simple inline-SVG-style illustrations, plain language). After sign-up redirect to "check your email", then first-run flow to add the first child (uses `/api/children`).
- [ ] **Step 4:** Run; expected PASS. **Step 5:** Commit `feat: parent sign-up with content policy carousel (U7,U16,N1)`.

### Task 9: Child sign-in, session and adult-check logout (U9, U10, U12, N6)

**Files:** Create `app/play/sign-in/page.tsx`, `components/auth/AdultCheck.tsx`, `tests/AdultCheck.test.tsx`; Modify `app/page.tsx`, `app/games/**` (move or alias under the protected area per Task 7 matcher; keep existing URLs working), `components/AdminNav.tsx` untouched.

**Interfaces — Produces:** `AdultCheck(props: { open: boolean; onPass(): void; onCancel(): void })` shows `a + b = ?` with `a,b` random integers 6-9 (sum 12-18, beyond a 4-5 year-old); `LogoutButton` (small corner button) opens it and calls `supabase.auth.signOut()` only on `onPass`.

- [ ] **Step 1:** Failing tests: wrong answer keeps the dialog open and does not sign out; correct answer signs out; cancel closes; `a signed-out visitor to /games is sent to /play/sign-in`.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement. Persistent session comes from the `@supabase/ssr` cookie (verify it survives a reload in Task 14's E2E).
- [ ] **Step 4:** Run; expected PASS. **Step 5:** Commit `feat: child sign-in and adult-check logout (U9,U10,U12)`.

### Task 10: Read per-child settings in all child screens (U4)

**Files:** Modify the 8 readers of `settings` found with `grep -rn "from('settings')" app lib components` (`app/page.tsx`, `app/games/page.tsx`, `app/games/listen/page.tsx`, `app/games/sort/page.tsx`, `app/games/quiz/[setId]/page.tsx`, `app/games/quiz/[setId]/done/page.tsx`, `app/admin/(panel)/settings/page.tsx`, and any other hit); update their Vitest tests and `e2e/support/standin-supabase.mjs` to serve `child_settings`.

- [ ] **Step 1:** Update the existing tests that mock `settings` to mock `child_settings` through `getMyChildSettings`; expected FAIL.
- [ ] **Step 2:** Replace each query with `getMyChildSettings()`. Admin settings page becomes the parent dashboard of Task 11.
- [ ] **Step 3:** Run `npm test`; expected PASS. **Step 4:** Commit `refactor: child screens read per-child settings (U4)`.

### Task 11: Parent dashboard: manage children (N2, U8)

**Files:** Create `app/admin/(panel)/children/page.tsx`, `components/admin/ChildForm.tsx`, `tests/ChildrenPage.test.tsx`; Modify `components/AdminNav.tsx` (role-based links), `app/admin/page.tsx` (role-based landing).

- [ ] **Step 1:** Failing tests: `lists the parent's children and disables Add at 5`; `add child posts to /api/children and shows a 409 error as a toast`; `edit saves name, avatar and sounds via updateChildSettings`; `AdminNav shows only links allowed for the role`.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement. Reuse `MediaLibraryDialog` for avatar and sounds. **Step 4:** Run; expected PASS.
- [ ] **Step 5:** Commit `feat: parent children dashboard (N2)`.

### Task 12: Content scope UI for parents and children (N3, N4, N6, V1-V4)

**Files:** Create `lib/review.ts`, `components/admin/{VisibilityBadge,ContentTabs,ShareToggle}.tsx`, `tests/ReviewUi.test.tsx`; Modify `app/admin/(panel)/{sets,cards,spot,find}/…`, `components/admin/{SetEditor,SpotLevelPanel,FindLevelPanel,CardPanel}.tsx`, `app/games/page.tsx` and the list pages of each game.

**Interfaces — Produces:** `type ContentTable = 'quiz_sets'|'memory_cards'|'spot_levels'|'card_groups'|'find_levels'`; `shareItem(table, id)`, `requestEdit(table, id, note)` as thin wrappers over the Task 5 RPCs; `useContentScope(): { scope: 'mine'|'global'; setScope(s): void }`; `VisibilityBadge(props: { visibility: 'private'|'pending'|'global' })`; `ContentTabs` renders "Mine" / "Global" (Global lists read-only items with a lock). Editors become read-only when `visibility !== 'private'` or the row is not owned by the user; the pending notice reads "Under review". Child game list pages get the "My family / Global" switch with picture icons only.

- [ ] **Step 1:** Failing tests: `editor inputs are disabled for pending and global items`; `Share toggle calls shareItem and shows the Under review notice`; `Request edit appears only for global items and calls requestEdit`; `Global tab never shows edit controls`; `child list shows the switch and no edit controls`.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement. **Step 4:** Run; expected PASS.
- [ ] **Step 5:** Commit `feat: content scope, badges and sharing UI (N3,N4,N6)`.

### Task 13: Media UI: owner folders, 2 MB sound, quota meter, safe delete (Q1, Q5, Q6, N4)

**Files:** Modify `lib/media.ts`, `lib/media/library.ts`, `components/admin/CardPanel.tsx` (`MAX_SOUND_BYTES`), `components/admin/MediaLibraryDialog.tsx`, `components/admin/QuestionPanel.tsx` and `ImportDialog.tsx` help texts; Create `components/admin/QuotaMeter.tsx`, `tests/QuotaMeter.test.tsx`; update `tests/MediaLibraryDialog.test.tsx`, `tests/AdminMedia.test.tsx`.

**Interfaces — Produces:** `MAX_SOUND_BYTES = 2 * 1024 * 1024`; uploads write to `<ownerId>/<randomId>.<ext>`; `isMediaInUse(path): Promise<boolean>` now calls RPC `media_in_use`; `QuotaMeter(props: { used: number; quota: number })` shows "12 / 50 MB" and turns warning colour at 90%.

- [ ] **Step 1:** Failing tests: `sound over 2 MB shows "Sound must be 2 MB or smaller."`; `upload path starts with the user id`; `delete is blocked when media_in_use returns true`; `QuotaMeter formats MB and warns at 90%`.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement; surface the DB `quota_exceeded` error as a toast. **Step 4:** Run; expected PASS.
- [ ] **Step 5:** Commit `feat: media owner folders, 2 MB sounds, quota meter (Q1,Q5,Q6)`.

### Task 14: Super Admin console (N5, N9, U15, U17, V3, V5)

**Files:** Create `app/admin/(super)/{queue,parents,children,content,messages}/page.tsx`, `components/admin/BanDialog.tsx`, `tests/SuperQueue.test.tsx`, `tests/BanDialog.test.tsx`, `tests/SuspendedPage.test.tsx`; Modify `app/admin/suspended/page.tsx`, `app/admin/(super)/layout.tsx` (guard: only `super_admin`).

- [ ] **Step 1:** Failing tests: `queue lists pending items and Approve calls review_approve`; `Reject requires a note`; `queue item shows its images and sounds`; `BanDialog requires a reason code from BAN_REASONS and calls ban_parent`; `parents page changes quota via set_quota and gives unban`; `content browser unpublishes and deletes`; `suspended page shows reason label, note and date, and sends a message (disabled after 5 per day response)`; `non-super-admin sees the forbidden page on (super) routes`; `messages page marks read and resolved`.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement; creation of parents/children/Super Admins uses `/api/users`. **Step 4:** Run; expected PASS.
- [ ] **Step 5:** Commit `feat: Super Admin console (N5,N9,U15,U17)`.

### Task 15: E2E flows (T4, T5)

**Files:** Modify `e2e/support/standin-supabase.mjs` (users with roles, `profiles`, `child_settings`, RPC stubs mirroring Task 5 behaviour on in-memory data), `e2e/support/fixtures.ts`; Create `e2e/multiuser.spec.ts`.

Decision: authorization correctness is proven by the real-Postgres suite (Tasks 1-6); E2E runs on the extended stand-in and covers UI wiring only.

- [ ] **Step 1:** Write failing scenarios: parent signs up through the carousel and adds a child; child signs in, reloads and stays signed in; logout requires the adult check; child opening `/admin` sees the no-permission page; parent shares an item and sees "Under review"; Super Admin approves and the child sees it under Global; Super Admin bans with a reason, parent sees the suspended page and the child still plays; parent sends a contact message.
- [ ] **Step 2:** Run `PW_CHROMIUM_PATH=<preinstalled chromium> npm run e2e`; expected FAIL. **Step 3:** Extend the stand-in until each scenario passes. **Step 4:** Run whole e2e; expected PASS.
- [ ] **Step 5:** Commit `test(e2e): multi-user flows (T4,T5)`.

### Task 16: Docs and deployment runbook (Section 9)

**Files:** Modify `CLAUDE.md` (replace the superseded rules: child pages need sign-in; one deployment serves many families; add the three roles, `SUPABASE_SERVICE_ROLE_KEY`, `npm run test:rls`), `docs/git-workflow.md` (new project ids, SMTP, redirect URLs), `README.md` (setup), `docs/decision.md` (ADR: roles via `profiles` and RLS, RLS tests on real Postgres, E2E on stand-in).

- [ ] **Step 1:** Update the docs. **Step 2:** Run `npm run typecheck && npm run lint && npm test && npm run build`; expected all pass.
- [ ] **Step 3:** Commit `docs: Phase 3 rules, ADR and runbook`.
- [ ] **Step 4 (owner checkpoint, do not run without explicit OK):** create the new Supabase project; apply all migrations in order via the migration tool; create the first Super Admin user and insert its `profiles` row (spec U6); configure custom SMTP and Auth redirect URLs; create the new Vercel project linked to this repo with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; record the ids in `docs/git-workflow.md`.

---

## Self-review notes

- Spec coverage: U1-U6 Tasks 2-4; U7, U16 Task 8; U8, U11-U13 Task 7; U9, U10, U12 Task 9; U14, deployment Task 16; U15, U17 Tasks 5, 6, 14; V1-V7 Tasks 3, 5, 12, 14; Q1-Q7 Tasks 5, 13, 14; N1-N9 Tasks 8, 11, 12, 13, 14; T1-T5 Tasks 1-6 and 15.
- Not run yet: `npm ci`, typecheck, lint, tests and build have not been run on the imported snapshot; Task 1 starts by running them to establish the baseline.
- Open assumptions for the owner: row-level sharing granularity for Memory/Sort cards (Task 3); `supabase` CLI is not installed here, so DB tests use Docker Postgres instead of a full local Supabase stack, and E2E uses the extended stand-in.
