# Design: Square image crop for every admin upload

Status: **draft, approved in brainstorming (2026-10-31); awaiting user review of this file.** Replaces the picture-shape rules of ADR-024 and the aspect warnings of A15 (see section 6). Follows ADR-029 (Phase 2 is only more games) and ADR-030 (DOM first).

## 1. Goal
Every picture a child sees is a square, so every screen has one shape and no layout breaks. The parent picks a picture, then crops it to a square in a window like Slack's "Add a profile photo".

Success:
1. Every bitmap picture uploaded in the admin is saved as a square (1:1) file.
2. The parent can move and resize the square over the picture before saving.
3. Old pictures keep their file and show inside the square frame with no overflow.
4. Spot the Differences: picture A and picture B are cropped to the same region, so the differences still line up.

## 2. Scope
In scope: every admin upload of a bitmap picture (PNG, JPG, WebP):
- Quiz: question picture, answer picture, set cover.
- Memory Match and Sort It cards (`app/admin/(panel)/cards`).
- Spot the Differences: picture A and picture B (`app/admin/(panel)/spot`).
- Find It: level picture (`app/admin/(panel)/find`).
- Avatar (`app/admin/(panel)/settings`).

Out of scope:
- SVG files and pasted SVG code: kept as they are (user decision).
- Audio, and the picture library (A23): it only reuses files already stored, so nothing is cropped.
- Migrating or re-cropping existing pictures (user decision): they stay as they are.

## 3. Components

| Unit | Responsibility | Depends on |
|---|---|---|
| `lib/crop/geometry.ts` | Pure functions: fit a square into the picture bounds, move it, resize it from a corner (keeps it square), convert it to pixels. | nothing |
| `lib/crop/render.ts` | Draws the chosen square from an image onto a canvas and returns a WebP `File`, at most 1024 px per side. | browser canvas |
| `components/admin/CropDialog.tsx` | Modal. Shows the picture, the square with four corner handles, a drag-to-move area, Cancel and Save, a preview. Takes a picked `File` and an optional starting box. Resolves to a cropped `File`, or `null` on Cancel. | geometry, render |
| `lib/media.ts` | No change to its contract. | — |

As built (2026-10-31): `MediaLibraryDialog` is the one bitmap upload path (`upload()` opens `CropDialog` before `uploadToLibrary`). `LibraryButton` passes `startCrop` and `onCropped` through, so Spot can pass A's crop to B. There is no separate `pickSquare` helper.

## 4. Behaviour
- **Opening the dialog:** the square starts centered, as large as the shorter side. The picture is shown fitted in the window.
- **Moving and resizing:** the square is always 1:1 and stays inside the picture. Dragging a corner keeps it square; a minimum size of 10% of the shorter side keeps it easy to adjust.
- **Keyboard (admin):** arrows move the square, Shift+arrows resize, Enter saves, Esc cancels. The focus ring stays visible.
- **Output:** WebP at quality 0.9, square, at most 1024 px per side. Changed from PNG during planning: a 1024 px photo saved as PNG can exceed the 2 MB limit, while WebP keeps transparency and stays well under it. The check on the input file (2 MB) stays as it is.
- **Cancel:** no pending file is created, and the upload field stays as it was.
- **Spot picture B:** the dialog opens with A's box as a fraction of A's width and height, applied to B's size. If B's aspect differs from A's by more than 2%, the square is recomputed from B's center, and the existing A15 aspect warning is shown.
- **Errors:** a picture that cannot be decoded shows a plain message and leaves the field unchanged.

## 5. Layout effects
- **Quiz question picture:** the frame changes from 600x300 (2:1) to a 300x300 square. Its height stays 300 px, so the three bands of ADR-025 keep their vertical space. The question text sits beside it, as now. The image stays `object-fit: contain` inside the square, so old pictures fit.
- **Quiz answers:** already square-friendly (460x400 card, picture about 260 px). The square picture is centered in the card. No size change.
- **Set cover, cards, Sort It:** already square-framed. Only the upload changes.
- **Spot the Differences:** two squares side by side, up to 860 px each, fit the 1920x1080 stage. Adjust the board size in `components/spot/SpotBoard.tsx` from 4:3 to 1:1. The hit test already takes `aspect`, so with aspect 1 it still works. Existing levels keep their pictures and get a letterbox, which is the same as now.
- **Find It:** picture shown at most 900x900 (the board bound `MAX_H = 900` in `components/find/FindBoard.tsx`, from develop, where the word list takes the left column). Its tap mapping uses `aspect`, so no logic changes. This replaces the earlier 800x800 figure, which predates the word list.

## 6. Rules that change
- **ADR-032 (new):** supersedes ADR-024. Every admin bitmap picture is cropped to a square on upload. The question frame is 300x300. Old pictures are shown fitted, not re-cropped.
- **A5 (spec.md):** the question picture is "square, max 1024 px, cropped in the admin, shown in a 300x300 frame, fitted (never stretched)".
- **A15 (spec.md) and Spot design:** remove the "portrait picture" and "landscape tip" warnings for new uploads. Keep the 2% A/B aspect warning and the small-spot warning.
- **New admin requirements:** A24 (crop dialog on every bitmap upload), A25 (Spot picture B uses A's crop), A26 (old pictures are shown fitted, not re-cropped).

## 7. Testing
- Unit (Vitest): `geometry` (clamp inside bounds, move, corner resize stays square, minimum size, pixel conversion); `render` (output is square and at most 1024 px, mocked canvas); `pickSquare` (returns the cropped file, returns null on cancel, starts with a given box).
- Component (Vitest + Testing Library, if already set up; otherwise covered by E2E): `CropDialog` keyboard moves, Save and Cancel.
- E2E (Playwright, `npm run e2e`): upload a non-square picture on the card editor, crop it, save, and check the stored file is square. Spot: upload A and B, check both are square and match.
- Visual: check the Quiz question screen and the Spot board at 1920x1080 for overlap (ADR-025).
- Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## 8. Open items for the plan
- Confirm the exact Quiz band height at 1920x1080 once implemented. If the 300 px frame overlaps anything, it is reduced and ADR-032 is updated.
- Decide whether the 1024 px cap should be 1200 px. Start at 1024.
