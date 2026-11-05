# Children as a plain table (no child accounts) design

Date: 2026-11-05. Status: draft for owner review. Repo: `child-mini-game-global`.

Requirement IDs: `K1..` (children data and access), `KU1..` (UI), `KT1..` (tests). Cite them in commits. Layout work for `/admin` and the question editor is a separate spec (see section 9).

## 1. Goal

Simplify children. A child stops being a Supabase Auth user with role `child`; a child becomes a row in a normal `children` table owned by a parent. A parent signs in once on the play device; children pick their own card and enter a 4-character PIN. No child-level security is needed: the PIN only tells siblings apart.

Supersedes ADR-033's role `child` and ADR-034 (name + PIN derived into an Auth email and password). Both must be marked superseded in `docs/decision.md` when this ships, and CLAUDE.md rules about "a signed-in child account" updated.

Success means: a parent creates, edits and removes children from a card view; a child picks a card, enters the PIN and plays the parent's content; no `child` role, no Auth user and no service-role route exists for children.

## 2. Roles after this change

| Role | Can do |
|---|---|
| Super Admin | As before, plus view and remove any family's children. Does not create children. |
| Parent | Self sign-up; create 1 to 5 children; edit each child's display name, avatar, PIN, gender, age band and sounds; everything else as before. |
| Child | Not an account. A row in `children`. |

`profiles.role` becomes `super_admin | parent`.

## 3. Data model (K1..K6)

- **K1 `children`**: `id uuid pk default gen_random_uuid()`, `parent_id uuid not null references profiles(user_id) on delete cascade`, `child_name text not null` (unique across the service, compared case-insensitively on trimmed text via a unique index on `lower(btrim(child_name))`, 1 to 40 characters, immutable after insert), `display_name text not null` (1 to 40), `avatar_path text`, `gender text not null check in ('male','female')`, `age_band text not null check in ('2-5','5-10')`, `pin text not null check (pin ~ '^[A-Za-z0-9]{4}$')`, `created_at`.
- **K2 limit**: a trigger rejects the sixth child of a parent (`too_many_children`, same contract as today's profile guard).
- **K3 immutable name**: a trigger rejects any update that changes `child_name` or `parent_id`.
- **K4 PIN is stored as plain text** (decision: no security at child level). A parent sees and edits it in the child modal.
- **K5 `child_settings`** is kept for sounds and music (`greeting_path` is the per-child welcome sound, plus `music_path`, `music_volume`, `hooray_path`, `ohoh_path`, `complete_path`), re-keyed to `child_id references children(id) on delete cascade`. Its `child_name` and `avatar_path` columns move to `children` (`display_name`, `avatar_path`) and are dropped. A row is created by an insert trigger on `children`.
- **K6 RLS on `children`**: parent selects, inserts, updates and deletes only rows with `parent_id = auth.uid()` (and not banned for writes); Super Admin selects and deletes all. `anon` has no access. `child_settings` follows the same rule through `children.parent_id`. The `child` branches of the content policies and of `owner_scope()` are removed.

## 4. Access for the play device (K7..K12)

- **K7** The play device holds a **parent session** (email sign-in, unchanged). `/play` lists that parent's children.
- **K8** A child taps their card and types the PIN. A correct PIN stores the child's `id` in a cookie `cp_child` (not a secret, set by the client, `SameSite=Lax`, session-long). A wrong PIN shakes the card; no text (the child cannot read).
- **K9** `/games/**` redirects to `/play` when `cp_child` is missing, or when the id does not resolve to a child of the signed-in parent (checked through RLS). The welcome screen and per-child settings load from that id.
- **K10** Switching child asks for the new child's PIN again. Content shown to a child is the parent's content plus global content, filtered to `published` in the queries the play pages use (RLS no longer narrows a parent's own rows to published ones).
- **K11** Bans keep today's rules: a banned parent is sent to `/admin/suspended` and their content is invisible through RLS. Their session on the play device is not signed out, so `/play` still lists their children; they see no content until unbanned.

- **K12** `/admin` is reached from the play device through the **Parent Configuration** card (KU9) and its grown-up check. This is a convenience for parents, not a lock: `/admin` itself is not guarded by the check, and typing the address works for anyone on a parent session. No extra cookie is used.

## 5. Parent UI: Children page (KU1..KU8)

- **KU1** Card grid. Each card: round avatar, display name, small login name, age band chip, gender badge.
- **KU2** Male cards: light blue background (`--sky-tint`), dark blue text, icon ♂. Female cards: light pink background (`--rose-tint`), dark pink text, icon ♀. Text colors are darker than the pastel so contrast stays readable.
- **KU3** Top-right of each card: pencil button (edit) and X button (remove), each with a tooltip on hover and keyboard focus (`aria-label` and a visible tooltip).
- **KU4** Remove asks for confirmation (never optimistic, per CLAUDE.md), then deletes the row.
- **KU5** A dashed "Add child" card at the end; disabled at five children with the existing limit note.
- **KU6** One modal component for create and edit. Fields: login name (create only; read-only with a lock icon in edit), display name, avatar picker, PIN (4 characters, letters or digits), age band (segmented 2-5 / 5-10), welcome sound picker, and a Boy / Girl segmented switch (`aria-pressed`).
- **KU7** Switching Boy / Girl recolors the modal background, borders, title and primary button immediately to the colors in KU2.
- **KU8** Edit mode adds a collapsed "More sounds" block (music, hooray, oh-oh, complete). A duplicate login name shows an inline error under the name field ("That name is already used. Choose another."), mapped from the unique violation (`23505`).

Errors are plain English and never show raw database text. Create and edit are not optimistic (they add or change identity data); the list reloads after success.

## 6. Play UI: child picker (KU9..KU12)

- **KU9** `/play`: a row of large cards (avatar and display name) in the gender colors, then the PIN entry (four boxes) after a card is tapped. The **last card is Parent Configuration**: neutral color (`--peach`), a tool icon (wrench), no avatar, an `aria-label` and a tooltip. It always shows, even with no children, so a parent with zero children can still reach the admin.
- **KU9b** Tapping Parent Configuration opens the grown-up check popup (`AdultCheck`, "a + b = ?"). A correct answer goes to `/admin`; a wrong answer shakes the popup and offers a new sum. Esc or tapping outside closes it.
- **KU10** After a correct PIN: the existing welcome screen shows the display name and plays the child's welcome sound once audio is allowed ("tap to enter" rule, ADR audio).
- **KU11** A corner **back to sign-in** button on the picker screen. The "a + b = ?" check stays on it (as for logout today). When passed it signs the parent out and goes to `/admin/sign-in`, which links to sign-up. Clears `cp_child`.
- **KU12** Honors `prefers-reduced-motion`; keyboard works (Left/Right across cards, Enter to pick, Esc back); visible focus ring.

## 7. Super Admin (K13)

"All children" lists every child with its parent, read-only except remove. The "create child" option of the create-account form is removed.

## 8. Migration

One migration, for a product that has no real families yet: create `children`; delete `profiles` rows with `role = 'child'` and their `auth.users` (cascade removes old `child_settings`); re-key `child_settings`; update the role check, `owner_scope()` and content policies; drop `profiles.parent_id` and the child branch of its guard trigger (only children used it). `/api/children` and `lib/auth/childLogin.ts` are deleted; `/api/users` keeps creating Super Admins and parents. `npm run test:rls` stays green.

## 9. Out of scope (separate spec)

Widening `/admin` and redesigning the question editor (question list as a sidebar, small-screen friendly) and the uneven set cards on the front page preview. These do not depend on this spec.

## 10. Tests (KT1..KT6)

- **KT1** RLS on real Postgres: parent sees only own children; cannot read or write another parent's; sixth child rejected; `child_name` unique across parents and case-insensitive; `child_name` cannot be changed; PIN pattern enforced; Super Admin selects and deletes all; `anon` has nothing.
- **KT2** `child_settings` row appears on child insert and disappears on delete; sound settings follow the same RLS.
- **KT3** Unit: modal (create, edit, gender switch recolors, read-only login name, duplicate-name error), card (colors, tooltips, confirm remove), page (limit).
- **KT4** Unit: `/play` picker (cards, PIN right and wrong, cookie set; Parent Configuration card is last, shows with zero children, opens the check, correct sum goes to `/admin`, wrong sum stays and shows a new sum; back button needs the check and signs out).
- **KT5** Guard: `/games` without `cp_child`, or with another parent's child, redirects to `/play`.
- **KT6** The e2e stand-in Supabase learns the `children` table; `e2e/multiuser.spec.ts` is updated to the picker flow.

## 11. Risks

- A parent session on the play device is still a parent session: anyone who types `/admin` gets in. The Parent Configuration card is a shortcut, not protection (K12). Accepted; a lock can be added later without schema change.
- Queries on the play pages must filter `published` themselves; missing one shows a draft to the child. KT5 and per-game tests cover the shared helper, not every query.
- Old children are deleted by the migration. Acceptable only while no real family exists.
