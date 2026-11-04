# Tech debt

## Import cycle in admin media components
Found by graphify (2026-11-04). Not fixed on purpose.

`components/admin/CardPanel.tsx` -> `components/admin/LibraryButton.tsx` -> `components/admin/MediaLibraryDialog.tsx` -> `components/admin/CardPanel.tsx`

Likely fix when someone touches these files: move the shared types/constants (e.g. `CARD_IMG_TYPES`, `AUDIO_ACCEPT`) that `MediaLibraryDialog` imports from `CardPanel` into a small shared module.
