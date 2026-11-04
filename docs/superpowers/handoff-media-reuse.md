# Handoff: admin media reuse (branch `claude/admin-media-reuse`)

Last code commit: `ed686ec`. Based on `develop` (`3f31b09`). Nothing is merged, no PR is open. Do not open a PR or merge without the PO's OK.

## What the PO asked for, in order

1. **Reuse pictures and sounds from the library on every admin page** that has an upload (A24). Spec: `docs/superpowers/specs/2026-10-31-media-reuse-design.md`.
2. **Play / pause in the sound chooser** (A25). One preview at a time; pause keeps position; closing or leaving stops it.
3. **Everything is a preview until Save** (A26 and the PO's rule): choosing from the library, uploading, and Use built-in only change the draft. Save writes to the database. Revert drops the draft.
4. **OK applies, Cancel closes.** Clicking an item only highlights it. OK (bottom right) applies it. Cancel sits beside OK. There is no Close button in the header.
5. **Upload inside the library dialog.** "Upload new" uploads at once, shows an uploading state, keeps the dialog open, and lists the new file so the PO can select it, press OK, and then Save.
6. **Sound list layout.** One row per sound with a round play / pause icon on the left (same design as Settings). Upload new is blue; OK is the dark admin primary; Cancel is ghost.
7. **Dialog layout.** Fixed height about 600 px. Only the list scrolls. Title, Upload new, Cancel and OK stay fixed. Scrolling must not scroll the page behind (body scroll is locked while open). Titles: "Image Library" with a picture icon, or "Sound Library" with a sol note icon.
8. **Find It.** "Play sound" becomes the round play icon, same design.
9. **Remove the old upload buttons** on every admin page ("Upload sound", "Change picture", "Replace", "Upload", "Upload picture", "Upload image", "Upload avatar", "Upload track"). Each field has one button: **"+ Choose images"** for pictures, **"+ Choose sounds"** for sounds. "Use built-in" stays (it is not an upload).
10. **Quiz Set SVG paste.** "Or paste SVG code" on question pictures, answer pictures and the set cover (same rules as Cards, checked by `checkSvg`). This was asked earlier and is done.
11. **Play-state bug fixed.** Settings: two feedback sounds that share one file both showed Pause. State is now keyed by setting. Find It object sounds are keyed by row for the same reason.

## Workflow rules the PO set (keep them)

- Push code only while the PO tests. **Do not write new unit tests or E2E until the PO says so.** Existing tests were kept green by updating or removing tests that covered removed upload controls.
- Tell the PO the branch name when it changes.
- PR into `develop` only when asked. `develop` -> `main` only when asked. Release: merge once, do not poll Vercel, report only failures.
- Commit messages: no model name in them. Keep the `Claude-Session` line.

## Current state (what is in the code)

- `components/admin/MediaLibraryDialog.tsx`: the dialog. Selection, OK / Cancel, Upload new (direct upload, loading state, errors), fixed-height panel, titles and icons, sound rows with play button.
- `components/admin/LibraryButton.tsx`: "+ Choose images" / "+ Choose sounds" button that opens the dialog. Props: `kind`, `label`, `onChoose(path)`. The aria-label is `Choose from library for <label>`.
- `components/admin/useSoundPreview.ts`: one `HTMLAudioElement`; `toggle(key, url)`, `stop()`, `isPlaying(key)`.
- `components/admin/PlayButton.tsx`: round play / pause button and icon, shared by the dialog, Find It and Settings.
- `components/admin/SvgPaste.tsx`: "Or paste SVG code" box.
- `lib/media/uploads.ts`: registry of files uploaded from the dialog that no record uses yet. `rememberUpload`, `unsavedUploads(kind)`, `forgetUploads()`. Listed by `listLibrary` until the page Saves or Reverts.
- `lib/media.ts`: `uploadToLibrary(kind, file)` (folder `library`). `removeMedia` keeps any path that a record still references (A23 / ADR-031).
- `lib/media/library.ts`: `listLibrary` returns referenced paths plus unsaved uploads of that kind.
- Pages (all draft-based, Save / Revert): Cards, Spot, Find, Quiz Set (`SetEditor`, `QuestionPanel`), Settings. Settings no longer uses pending files: avatar and sounds are bucket paths in a draft.
- Removed upload inputs and props from `CardPanel`, `SpotLevelPanel`, `FindLevelPanel`, `FindMarkerEditor`, `QuestionPanel`, `SetEditor`, and the page-level `pick` handlers in cards, spot and find.

Tests: `npx vitest run` gives 969 passing (81 files). Typecheck clean. Lint: 1 warning (`<img>` in `MediaLibraryDialog.tsx`, existing style).

## Open items

1. **E2E specs are stale and will fail.** `e2e/admin-cards.spec.ts` (lines around 44, 141, 143) and `e2e/admin-find.spec.ts` (lines around 52, 90, 103-104, 142, 148-149, 160) use the removed file inputs and the old "Choose from library" names. Rewrite them when the PO asks for E2E.
2. **Unit tests to write** after the PO's play-test: the dialog (select, OK, Cancel, upload states, sound list play icon, fixed layout), `useSoundPreview`, `uploads.ts`, the Settings draft flow (Save / Revert, Use built-in), the Find sound play icon, and the play-state keying fix (two settings sharing one file).
3. **Spec docs need a fix.** `spec.md` row A24 and the spec file still say "the Upload button stays" and describe an immediate choose. Update them to: "+ Choose images / + Choose sounds" with in-dialog upload, OK to apply, Save to persist. A25 and A26 are still accurate.
4. **Orphan files.** A file uploaded from the dialog and then abandoned (Revert, or never chosen) stays in the bucket with no record using it. It is not listed after Save or Revert. Not deleted on purpose: another page's draft may be using it. A cleanup tool for unused files is not built.
5. **PO play-test pending.** Layout at 1920x1080, the fixed 600 px dialog, the list scrolling without moving the page, the sound list icons, chime and sound behaviour in Find It, and the Settings play state. Name and colours for the dialog buttons are the PO's to confirm.
6. **No PR yet.** `claude/admin-media-reuse` -> `develop` when the PO asks.

## Environment notes for the next session

- Install: Node 24, `npm ci`.
- Env vars (not committed): `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` only. Never put the service role key in the frontend.
- E2E: set `PW_CHROMIUM_PATH` to an installed Chromium. Do not run `playwright install` on the cloud image.
- Commands: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run e2e` (after the E2E specs are updated).
