# Super Admin people pages: Parents, Parent detail, Children, Messages

Date: 2026-11-06. Source: `Feedback-phase04`, Super Admin section (all bullets except "Review queue", which is Spec 2).
Requirement IDs: N10–N18 (listed in `spec.md` section 4e).

## 1. Goal

Turn the flat Super Admin (SA) pages into a parent-centred console: search and sort, a storage bar, initials avatars, red dots for pending messages, a Parent detail page, and child cards. The SA can add and edit children, but only non-media fields. All content is removed.

## 2. Decisions (from the user)

- **Child media is not editable by the SA.** Avatar, celebration pictures and sounds are hidden in SA mode. A child created by the SA has no media, so its card shows the first letter.
- **SA powers:** Ban, Unban and quota edit live on Parent detail. The SA cannot rename or delete a parent.
- **Create parent:** a dialog (name, email, password) creates the parent, then opens its Parent detail page, where "Add child" uses the same ChildModal.
- **Parent avatar:** 1–2 uppercase initials derived from the name. No image.
- **All content** (`/admin/content`) is removed. `/admin/queue` stays until Spec 2.

## 3. Requirements

- **N10** Parents list: sort by created date or A–Z; search by parent name or any child's name; each row shows initials, name, a storage bar (green below 70%, orange 70–85%, red above 85%, with whole MB), and "Children: N" in smaller, lighter text.
- **N11** Parents list: "Expand all" / "Collapse all"; each row expands to its children (read-only cards). A banned parent shows a red "Ban" tag with red text and border.
- **N12** Parents list: a message icon with a red dot on parents with pending messages. A toolbar toggle filters to those parents.
- **N13** Parents list: "Create parent" dialog; after creation it opens the new parent's detail page.
- **N14** Parent detail (`/admin/parents/[id]`): name, initials, Ban / Unban, quota (MB) and storage bar, the parent's children (ChildCard grid, Add tile limited to 5), and the parent's levels per game, view only.
- **N15** Children page (`/admin/all-children`): 2-column grid (1 column under 760px) of larger child cards; parent name as a link to detail, with a Ban tag when banned; search by login name, display name or parent name; sort by created date or A–Z.
- **N16** SA child add/edit: only name, login name (create only), PIN, gender and age. Media sections are hidden. Changing `parent_id` or `child_name` is not possible.
- **N17** Messages page: tabs Pending (`resolved_at is null`) and History; search by parent name; sort by created date or parent name; Mark read / Mark resolved / Reopen as today.
- **N18** Sidebar: "All content" is removed and "All children" is renamed "Children". A red dot on Messages shows when pending messages exist.

## 4. Data and security

- **Children RLS** (`supabase/migrations/20261105020000_children_table.sql:75-85`): the SA can select and delete but not insert or update. The new migration adds `children_insert_super` and `children_update_super`, both restricted to `current_role() = 'super_admin'` and a `parent_id` that is a parent profile.
- **Media guard:** a trigger `children_super_no_media` (BEFORE INSERT OR UPDATE) refuses when the caller is an SA and `avatar_path`, `celebrate_a_path` or `celebrate_b_path` is set on insert or changed on update.
- **Limit:** the existing `children_limit` trigger still caps a parent at 5 children.
- **PIN** stays plain text, as today (`components/play/PinEntry.tsx:55` compares on the client). Out of scope for this spec.
- `child_settings` is not changed. The SA UI never touches sounds.

## 5. Components

- `lib/people.ts` (pure): `initials`, `sortBy`, `matches` (case- and diacritic-insensitive), `usageLevel` (`ok` / `warn` / `high`), `mb`.
- `components/admin/InitialsAvatar.tsx`, `UsageBar.tsx` (new; `QuotaMeter` stays for the media page), `ListToolbar.tsx` (search, sort, slot), `RedDot.tsx`, `ParentRow.tsx`, `CreateParentDialog.tsx`, `ContentViewDialog.tsx` (read-only cards and find detail).
- `ChildCard.tsx`: optional `size="lg"` and `footer` props. Existing callers do not change.
- `ChildModal.tsx`: optional `parentId` prop. When set (SA mode), media sections are hidden and `updateChildSettings` and `removeMedia` are skipped.

## 6. Data loading

- `listPeople('parent')` gains `createdAt`.
- `listAllChildren()` returns full child rows with `parent_name` and `parent_banned`.
- `listContent(visibility?, { ownerId }?)` gains an optional owner filter.
- `pendingMessageCount()` and `pendingSenders()` read `support_messages` where `resolved_at is null`.
- `lib/children.ts`: `created_at` is added to `COLUMNS` and `Child`. `createChild(input, client?, parentId?)` sends `parent_id` only when given.

## 7. Testing

- DB (`tests/db/children.test.ts`): SA creates and edits a child for a parent; SA cannot create for a non-parent; SA media change is refused; the 6th child is refused; the parent's own rules are unchanged. The existing "does not create or edit" case changes.
- Unit: `tests/people.test.ts`, `UsageBar`, Parents page, Parent detail, Messages page, All children grid, ChildModal `parentId` mode, ChildCard `footer`/`lg`, AdminNav (no All content, dot). `SuperQueue.test.tsx` drops the moved cases.
- E2E: the ban in `e2e/multiuser.spec.ts` moves to Parent detail.
