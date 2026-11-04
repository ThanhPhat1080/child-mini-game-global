# Reuse pictures and sounds from the library (admin)

Date: 2026-10-31. Branch: `claude/admin-media-reuse` (from `develop`). Requirements A24-A26 (extend A23). Reference guard tests for A26 are in `tests/mediaRefs.test.ts`.

## Goal

Every admin place that uploads a picture or a sound also offers "Choose from library": pick a file that a record already uses instead of uploading it again. This saves storage and upload time. The sound chooser can play and pause a preview, so the admin can hear a sound before choosing it.

## Decisions

- **A24 Reuse everywhere.** Each upload control for a picture or sound has a "Choose from library" button next to it. Pages: Cards (picture, sound), Spot (two pictures), Question (answer images, question picture, voice), Set cover, Settings (avatar, greeting, music, feedback sounds). Find It already has it and keeps its behaviour.
- **A25 Play and pause in the chooser.** The library sound list has Play/Pause for each sound. One preview plays at a time: starting another sound stops the first, pause keeps the position, and closing the dialog or leaving the page stops it. The same hook drives "Play sound" in the Find It object editor.
- **A26 Reuse keeps files safe.** Choosing a library file never deletes anything. Replacing a picture or sound still calls `removeMedia`, which keeps any file another record still references (ADR-031). The `removeMedia` tests in `tests/mediaRefs.test.ts` cover this: a path that is still referenced is kept.

## Components

- `components/admin/useSoundPreview.ts`: a hook that owns one `HTMLAudioElement`. Returns `{ toggle(key, url), stop(), isPlaying(key) }`. `key` is the bucket path, so rows can ask whether they are playing without building a URL during render. `toggle` plays a new sound, or pauses/resumes the current one. It stops on unmount and when the sound ends.
- `components/admin/MediaLibraryDialog.tsx`: unchanged props. Sound rows use `useSoundPreview` (Play/Pause buttons with `aria-label` `Play <name>` / `Pause <name>`). Stops the preview when a file is chosen or the dialog closes.
- `components/admin/LibraryButton.tsx`: `<LibraryButton kind label onChoose />`. Renders a ghost button labelled "Choose from library" and, when open, `MediaLibraryDialog`. Each page passes `onChoose(path)`, which does what its upload handler does after a file is added, using the bucket path instead of a pending token.

## Out of scope

- Changing `listLibrary` (it lists only files that records still use, which is what makes reuse safe).
- Preview in the Cards page "Play" button (that plays the word recording, not a file picker).

## Testing

- Unit: `useSoundPreview` (play, pause, resume, switch URL stops the old one, unmount stops).
- Component: `MediaLibraryDialog` Play/Pause; `LibraryButton` opens the dialog and passes the chosen path.
- Pages: each page's library choice sets the field to the bucket path and does not upload.
- Guard: replacing a shared file does not delete it (`removeMedia` test, A26).
- E2E: Cards page chooses an existing picture and sound from the library.
