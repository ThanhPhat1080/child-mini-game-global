# Tech debt

## Import cycle in admin media components
Found by graphify (2026-11-04). Not fixed on purpose.

`components/admin/CardPanel.tsx` -> `components/admin/LibraryButton.tsx` -> `components/admin/MediaLibraryDialog.tsx` -> `components/admin/CardPanel.tsx`

Likely fix when someone touches these files: move the shared types/constants (e.g. `CARD_IMG_TYPES`, `AUDIO_ACCEPT`) that `MediaLibraryDialog` imports from `CardPanel` into a small shared module.

## Feedback batch (2026-11-07): limits left for later

### Guest play can open a non-global level by id
The lists for guest play (`familyOrGlobal` with no parent id) show only `global` rows. The by-id loaders do not check it: `fetchLevel` (spot), `fetchFindLevel` (find), the quiz set page (`app/games/quiz/[setId]`), and the memory, sort and listen detail pages. A guest who knows another family's level id can open it. The ids are UUIDs, so this is low risk, but it does not match "guest sees global only". Fix when touching them: when `isGuestPlay()`, add `.eq('visibility', 'global')` in those loaders. The admin preview (A16) uses the same loaders, so keep the admin path unchanged.

### Guest card has visible text
The "Guest" label on the picker (`components/play/GuestPickCard.tsx`) is text a child cannot read. CLAUDE.md says no child-facing text is hard-coded. Possible change: icon only, with the name as `aria-label`.

### Super Admin storage total and media list
- `storageUsedBy` (`lib/superAdmin.ts`) counts a failed `storage_used` call as 0, so the "all families" total can be too low without any warning.
- The Super Admin media list walks every owner folder (one request per folder and level). It will be slow with many parents. Fix with a server-side listing or paging.
- Other owners' files show no owner name, so two files with the same name look alike.

### Migrations not yet applied to the shared Supabase project (`ippeairzjdpsjdjkxypt`)
- Applied 2026-11-07: `20261107000000_super_admin_unlimited_quota`.
- Pending: `20261106000000_super_children` (Super Admin adds and edits children; without it that UI fails on the shared project).
- Pending: `20261106010000_review_copy`. It contains a one-time backfill that changes data: parents' global rows go back to private, and Super Admin copies are created. It needs the owner's explicit OK.

### Not verified in a browser
- Media with real uploads (the E2E stand-in has no uploaded files).
- Carousel position on `/games` and the quiz list after leaving and coming back.
- The new hover underline, the compact child modal, and the confirm title layout.
