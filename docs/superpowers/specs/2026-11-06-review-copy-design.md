# Review per game, approve creates a global copy (Spec 2)

Date: 2026-11-06. Status: **implemented** on branch `claude/phase4/review-copy` (V8-V13 in `spec.md` section 4f).
Source: `Feedback-phase04` (Super Admin section, "Review queue" bullets).
Requirement IDs: V8–V13 (to be listed in `spec.md`; check the next free IDs first, since V1–V7 are in the phase 3 spec).
Depends on: Spec 1 (`2026-11-06-super-admin-people-design.md`). Spec 1 changes the Super Admin pages and the children policies that this spec relies on.

## 1. Context

Today `review_approve` (`supabase/migrations/20261104030000_review_workflow.sql:100-110`) moves the parent's own row from `pending` to `global` **in place**. Consequences:
- The Super Admin (SA) cannot own or edit a global level without changing the parent's row.
- Review lives on a separate `/admin/queue` page. Global content lives on `/admin/content`, which Spec 1 removes.
- The child app shows the family's own rows plus global rows (`lib/review.ts:66-72`). A global row can therefore appear twice for the same family.

Goal: the SA reviews each game in its own tab. Approve **creates a copy** owned by the SA. The copy references the parent's existing media files; no new files are created. The SA can edit every global level.

## 2. Decisions

From the user's answers:
1. **Original after approve:** goes back to `private`. The parent keeps editing it. The family sees only the original; the copy is hidden from that family (no duplicate). A later share and approve creates a new copy.
2. **Existing global rows owned by parents:** migrated to copies, then the original goes back to `private`.
3. **"Parent published" tab:** lists every published or active level of every parent, of any visibility, with the parent's name and a status badge. View only.
4. **Media:** the copy references the parent's media paths. The copy adds 0 bytes to the SA's quota. The files stay in the parent's folder and count against the parent's quota.

Also from the feedback: the SA can edit all global content. A global copy is independent of the original.

## 3. What the code looks like now (facts to rely on)

- **Visibility and RLS:** `visibility` enum `private | pending | global`. `can_write_content` allows the SA on any row. `content_guard` lets the SA change owner and visibility (`supabase/migrations/20261104010000_content_ownership_rls.sql`). The database already allows an SA to edit global rows; only the UI blocks it.
- **Media:** there is no media table. Files are `storage.objects` in bucket `media`, at `<owner uuid>/…`. `media_in_use()` checks every owner's rows, so a parent deleting a level or a file **cannot break a copy**: the delete is refused while a copy uses the file (`lib/media.ts:115-128`, `tests/db/media.test.ts:129`).
- **Rename is the hazard:** `renameMedia` (`lib/media/rename.ts:34-50`) moves the file and repoints only the rows the parent can update. A copy owned by the SA would be left pointing at a path that no longer exists.
- **Quiz sets:** a `quiz_sets_publish_gate` trigger refuses a row inserted as `published` with no questions. A copy must be inserted as `draft`, then questions and answers added, then the status set.
- **Memory cards:** the `memory_cards_group_owner` trigger requires a card to have the same owner as its group (`supabase/migrations/20261104010000_content_ownership_rls.sql:174-199`). A card copy needs a group owned by the SA with the same name, or `group_id = null`.
- **Spot and Find:** no child tables. `differences` and `objects` are jsonb; they are copied verbatim.
- **Child play queries:** quiz `app/games/quiz/page.tsx:45-52`; spot `lib/spot/levels.ts:9-19`; find `lib/find/levels.ts:15-22`; memory `lib/memory/cards.ts:10`; sort `lib/sort/cards.ts:8`. All of them filter `active` or `published`, and RLS adds the visibility rule.

## 4. Design

### 4.1 Database (new migration, next free timestamp after Spec 1)

- Add to the five content tables (`quiz_sets, memory_cards, card_groups, spot_levels, find_levels`):
  - `source_id uuid references <same table>(id) on delete set null`
  - `source_owner_id uuid references profiles(user_id) on delete set null`
  - an index on `source_id`
- `copy_content_as(p_table text, p_id uuid, p_owner uuid) returns uuid`, `security definer`, `set search_path = ''`, **not granted to clients**. Deep copy owned by `p_owner`, `visibility = 'global'`, `source_id = p_id`, `source_owner_id = <original owner>`. Media path columns and jsonb are copied verbatim.
  - `quiz_sets`: insert as `draft`, copy `questions` (keep an id map), copy `answers`, then set the original's status.
  - `spot_levels`, `find_levels`: copy the row.
  - `card_groups`: find or create a group with the same name owned by `p_owner` (the unique index is on `lower(btrim(name))`), set to `global`.
  - `memory_cards`: map `group_id` through the same find-or-create group, then copy the card.
- `review_approve(p_table, p_id) returns uuid` (changes from `void`, so drop and recreate, then re-grant):
  1. `assert_super_admin()`
  2. `move_content(p_table, p_id, 'pending', 'private', false)`, which returns the owner
  3. `copy_content_as(p_table, p_id, auth.uid())`
  4. return the copy id
- `publish_own(p_table, p_id)`: SA only, own row, `private → global`, built on `move_content(..., true)`. This lets the SA publish its own content without a review.
- **Data migration** (runs once):
  - Owner of null-owner rows: the first `super_admin` by `created_at` (same rule as the seed migration). If there is none, skip.
  - For each `global` row owned by a parent: `copy_content_as(...)`, then set the original to `private`.
- **Media rename guard:** add `media_used_by_others(p_path)`, the content-table part of `media_in_use()` restricted to rows whose `owner_id` differs from the folder owner. Recreate `media_owner_update` with `and not public.media_used_by_others(name)` in USING. Delete is already guarded.
- Grants: `publish_own` to `authenticated`. Revoke `anon` execute on the new functions, as `20261105000000_revoke_anon_execute.sql` does.

### 4.2 Lib

- `lib/review.ts`:
  - `Scope = 'mine' | 'global' | 'queue' | 'parents'`. A stored scope the role may not use falls back to `'mine'`.
  - `isLocked(visibility, ownerId, me, role?)`: an SA's own row is never locked. A parent keeps the current rule.
  - `dropOwnCopies(rows, me)`: drops a global row whose `source_id` is the id of one of the family's own rows.
- `lib/superAdmin.ts`: `approveItem` returns the copy id; `publishOwn`; `pendingCounts()` (HEAD counts with `visibility = 'pending'` per table, returning `{ sets, cards, spot, find }`). After approve or reject, dispatch `cp:pending-changed` on `window`.
- Save filters that currently skip non-private rows must accept SA-owned rows: `lib/spot/adminLevels.ts:66`, `lib/find/adminLevels.ts:114`, `lib/memory/adminCards.ts:77`. `saveSet` already writes directly, and RLS allows the SA.
- Child play queries select `source_id` and apply `dropOwnCopies` (see section 3 for the files).

### 4.3 Admin UI

- `ContentTabs` takes a `role` prop.
  - Parent: Mine | Global (unchanged).
  - SA: Mine | Review queue (red dot, accessible name includes "N pending") | Parent published.
- `components/admin/ReviewQueue.tsx`: takes `tables`. Its body (thumbnails, audio, Approve, Reject with a reason) moves out of `app/admin/(super)/queue/page.tsx`. Approve's toast: "Approved. A global copy was created."
- "Parent published": generalise `components/admin/GlobalContent.tsx` with `mode: 'global' | 'parents'`. In `parents` mode, rows are owned by a parent, published or active, and shown with the owner's name and a `VisibilityBadge`. Read only. Spot keeps `SpotViewDialog`.
- Sets page: the same filter in the table, with an owner column. View opens `/admin/sets/[id]`, which is already locked for a non-owner through `isLocked`.
- Panels (`CardPanel`, `SpotLevelPanel`, `FindLevelPanel`) and `SetEditor` use `isLocked(..., role)`.
- SA rows get a `GlobalToggle` (publish own / unpublish) in place of `ShareToggle`. Parents keep `ShareToggle`.
- A parent's own row shows a "Global copy" badge when a readable row has `source_id` equal to its id.
- `components/AdminNav.tsx`: for an SA, `pendingCounts()` on mount, on pathname change, and on `cp:pending-changed`. A red dot on the game icon (visible on the collapsed rail) with the accessible name "Quiz sets, 2 pending". Remove the Review queue link from `SUPER`.
- Remove `app/admin/(super)/queue/`. `app/admin/page.tsx` sends an SA to `/admin/parents`.

## 5. Testing

- DB, new file `tests/db/review-copy.test.ts`, modelled on `tests/db/review.test.ts`:
  - approve on each of the five tables creates an SA-owned global copy with the same media paths and `source_id`; the original becomes `private`;
  - a quiz copy has the same question and answer counts;
  - a card copy gets an SA-owned group;
  - the parent can still edit the original, and the copy is unchanged;
  - the parent deleting the original, or a file used by the copy, leaves the copy intact and the file delete is refused;
  - renaming a file used by the copy is refused;
  - `publish_own` works for an SA and is refused for a parent;
  - the data migration turns a parent's global row into a copy.
- Unit: `tests/AdminNav.test.tsx` (no review queue link, pending dot); a `ReviewQueue` test (moved from `tests/SuperQueue.test.tsx`); `tests/ReviewUi.test.tsx` (tabs per role, `isLocked` with role, `dropOwnCopies`); `tests/SetsPage.test.tsx` and `tests/ContentScopeUi.test.tsx` (SA scopes, SA edits own global).
- E2E: `e2e/support/fixtures.ts` `signInAsSuper` waits for `/admin/parents`; the stand-in `review_approve` creates a copy; `e2e/multiuser.spec.ts` approves from the Cards → Review queue tab.

## 6. Risks

- **Rename hazard** (section 4.1). Without the guard, a parent can break the SA's copy.
- **Duplicates for a family:** handled by `dropOwnCopies`. Check that the child app still shows the copy to other families.
- **Migration of existing global rows:** irreversible in the sense that the copies become the SA's rows. Run it on local first, and ask before production.
- **`review_approve` signature change:** drop and recreate. Any caller that expects `void` must be checked.

## 7. Verification

- `npm run test:rls` (must stay green), `npm test`, `npm run typecheck`, `npm run e2e`. See `docs/local-setup.md` for the commands and traps.
- Manual, on local Supabase, as the SA:
  1. A parent shares a Spot level; the Spot game icon shows a red dot.
  2. Approve it. The dot clears. The copy appears in the SA's Mine tab and is editable.
  3. The parent's own level is `private` and still editable.
  4. The parent's child sees the level once. A child of another family sees the copy.

## 8. Implementation order (for the machine that builds it)

1. Read `docs/local-setup.md`. Confirm `npm test`, `npm run test:rls` and `npm run e2e` pass on the branch before any change.
2. Branch from the latest `develop` after Spec 1 is merged (see `docs/git-workflow.md`).
3. Write the failing DB tests (section 5) first, then the migration (section 4.1). Run `npm run test:rls`.
4. Lib changes (4.2) with unit tests.
5. Admin UI (4.3), with `ReviewQueue`, `GlobalContent` mode, and the nav dot.
6. Update the e2e stand-in and `e2e/multiuser.spec.ts`. Run `npm run e2e`.
7. Manual check (section 7) on local Supabase.
8. Ask the user before any production migration.
