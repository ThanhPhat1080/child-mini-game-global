# Admin: Media library and level lists (requests and decisions)

Record of what the PO asked for in the session of 2026-11-02 and the choices made. Merged in PR #89 (branch `claude/admin-media-page`). Spec IDs touched: A20-A24 (library, Find/Spot editors). Written into `spec.md` as A27-A31 (A14, A20 and A23 amended).

## 1. Library pop-up ("Image Library", "Sound Library")
- **Rename**: double click a file name; it becomes a text box with the name selected. Only the name is editable: the 13-character upload id and the extension stay (`oh-ring-9j2k4m1a7b3cx.mp3`, edit `oh-ring`). Enter or leaving the box saves; Esc cancels; no change = nothing happens. A toast reports success or the error (for example a taken name).
- Renaming moves the file in the bucket and points every record at the new path (all columns in `MEDIA_SOURCES`, including `find_levels.objects[].audio_path`). If a record cannot be updated everything is put back. Open admin pages swap the old path for the new one in their unsaved edits (`useMediaRenamed`, `replacePath`).
- **Optimistic UI**: the list shows the new name at once and goes back with an error toast on failure. Each file renames on its own; renaming one never blocks another. OK is disabled only while the chosen file is settling. A renamed file keeps its place in "Created" order.
- **Sort**: a select, "Created (newest)" (default, by the upload id) or "Name (A to Z)".
- **Delete**: trash button per file. Click shows "Validating before delete." and the item goes inert with "Validating..." next to the button (play, choose, rename and view are off). If any record uses the file: warning toast, file kept. Otherwise a confirmation, then delete. Deletes are never optimistic. Items are independent: deleting one does not change the state of another.
- **View full size**: one click on a picture opens it large (in the pop-up the click also selects it). Esc, ×, or a click outside closes only the viewer.
- **Loading**: the bundled fish (`/seed/fish.svg`) bobbing over water ripples with a small "Loading..." text; still under `prefers-reduced-motion`.
- **Lists the whole bucket** (used or not), for both the pop-up and the Media page (`listLibrary` walks the bucket folders). This replaced the old "files a record uses" list.

## 2. Media page (`/admin/media`, in the nav under Settings)
- Two tabs with icons: "Image library" and "Sound library". Same component as the pop-up (`MediaLibrary mode="page"`): list, sort, upload, rename, delete, full-size view. No choosing, no OK.
- Uploading a sound goes straight up. A bitmap picture still opens the crop window first (A24); SVG is uploaded as is.

## 3. Find and Spot level lists
- Each level is **collapsed** to its header plus small picture(s) (Find: one, Spot: A and B). Controls, SVG box, tip and marker editor show only when open. A new level starts open. Incomplete levels show an "Incomplete" badge in the header.
- Sorted by **created date**, newest first by default; an icon button reverses it. Levels load by `created_at` (then `sort_order`). The Level number is its creation order, so a new level is "Level <last>".
- Up/down buttons for levels were **removed** (order is the creation date). Saving writes `sort_order` in that order, so existing data whose play order differed from creation order changes on the next save.

## 4. Other
- `/admin/sets/<id>` is inside the `(panel)` group, so the left sidebar stays.
- `npm run tts` makes mp3 files from a JSON file (`scripts/tts_Readme.md`).
- Convention added to CLAUDE.md: "Optimistic UI" (fast, rarely failing admin actions update first and roll back on error; never for delete or upload).

## Known gaps
- The delete check reads only saved records. A file chosen on a page but not yet saved can still be deleted in the library.
- The e2e stand-in supports bucket listing but not `move`, so rename and the Media page have no e2e test.
- Six e2e specs in `e2e/admin-cards.spec.ts` fail (Save stays disabled); not verified whether they fail on a clean `develop`.
