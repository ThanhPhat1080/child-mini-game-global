# Square Image Crop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every bitmap picture the admin uploads is cropped to a square before it is stored, and every screen shows pictures in a square frame.

**Architecture:** The only bitmap upload path is `MediaLibraryDialog.upload()` (it calls `uploadToLibrary`). Before uploading, it opens a `CropDialog` (move and resize a square over the picture). Pure geometry (`lib/crop/geometry.ts`) and canvas rendering (`lib/crop/render.ts`) are separate units. Spot's picture B starts from picture A's crop, passed through `LibraryButton` as props. Board and frame sizes move from 4:3 or 2:1 to 1:1.

**Tech Stack:** React + TypeScript (DOM), Vitest + Testing Library (jsdom), Playwright (E2E), Supabase Storage (unchanged).

**Spec:** `docs/superpowers/specs/2026-10-31-square-image-crop-design.md`

## Global Constraints

- Input file size limit stays 2 MB (`MAX_IMAGE_BYTES`); input types PNG, JPG, WebP cropped; SVG is never cropped.
- Output: square, at most 1024 px per side, WebP at quality 0.9 (keeps alpha). Changed from the spec's PNG so a 1024 px photo stays well under 2 MB.
- Admin UI text is English, like the rest of the admin. No child-facing text.
- The square frame size for the Quiz question picture is 300x300 (spec section 5).
- No schema change; no migration.
- Keep the existing `lib/media.ts` contract. Do not change `uploadToLibrary`.

## Review Focus

1. Phone photo with EXIF rotation: the crop shows the picture upright and the output is upright. Test: `createImageBitmap` gets `imageOrientation: 'from-image'` in both the dialog and the renderer.
2. Very wide panorama (for example 4000x500): the default square is the shorter side, centered. Test: `defaultCrop(4000, 500)` gives a 500 px square at x = 1750.
3. Tiny picture (for example 40x30): the crop works, and the output is not upscaled. Test: `outputSide(30) === 30`.
4. Undecodable file: a clear message, nothing is uploaded, the library does not change. Test: a rejected decode shows the error and `uploadToLibrary` is not called.
5. Cancel or Esc: nothing is uploaded and no library entry appears. Test: `onCancel` path does not call `uploadToLibrary`.

---

### Task 1: Crop geometry (pure functions)

**Files:**
- Create: `lib/crop/geometry.ts`
- Test: `tests/cropGeometry.test.ts`

**Interfaces:**
- Produces:
  - `type Crop = { x: number; y: number; w: number; h: number; ratio: number }`. `x`, `y`, `w`, `h` are fractions of the picture's width and height. `ratio` is source width divided by height when the crop was made. A crop is a square in pixels when `w * W === h * H`.
  - `MIN_SIDE_FRACTION = 0.1` (minimum side is 10% of the shorter side).
  - `defaultCrop(W: number, H: number): Crop`
  - `moveCrop(c: Crop, dxPx: number, dyPx: number, W: number, H: number): Crop`
  - `resizeCrop(c: Crop, deltaPx: number, W: number, H: number): Crop`
  - `cropPixels(c: Crop, W: number, H: number): { x: number; y: number; size: number }` (integers)
  - `startCropFor(start: Crop | undefined, W: number, H: number): Crop` (uses `start` when its `ratio` is within 2% of `W / H`, otherwise `defaultCrop(W, H)`)
- Consumes: nothing.

Behaviour:
- `defaultCrop`: side = `min(W, H)`; centered; `ratio = W / H`.
- `moveCrop`: shifts by the pixel delta, then clamps `x` into `[0, 1 - w]` and `y` into `[0, 1 - h]`.
- `resizeCrop`: anchored at the top-left. New side in pixels = current side + `deltaPx`, clamped to `[round(MIN_SIDE_FRACTION * min(W, H)), min(W - x*W, H - y*H)]`. Updates `w` and `h` so the square stays square.

- [ ] **Step 1: Write the failing tests** in `tests/cropGeometry.test.ts`. Cover: default is centered square for `(4000, 500)` (side 500, x = 1750 px) and `(600, 900)`; `moveCrop` clamps at each edge; `resizeCrop` keeps `w * W === h * H` for a non-square picture; resize never goes below 10% of the shorter side; resize never leaves the picture; `startCropFor` keeps the start crop when ratios match within 2% and returns the default otherwise.
- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/cropGeometry.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement `lib/crop/geometry.ts`** with the interfaces above. Keep it free of DOM and browser APIs.
- [ ] **Step 4: Run it and confirm it passes.** Same command → PASS.
- [ ] **Step 5: Commit**

```bash
git add lib/crop/geometry.ts tests/cropGeometry.test.ts
git commit -m "feat(crop): square crop geometry (A24)

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Render the chosen square to a WebP file

**Files:**
- Create: `lib/crop/render.ts`
- Test: `tests/cropRender.test.ts`

**Interfaces:**
- Consumes: `Crop`, `cropPixels` from Task 1.
- Produces:
  - `MAX_SIDE = 1024`
  - `outputSide(sizePx: number, max?: number): number` returns `Math.max(1, Math.min(sizePx, max))`.
  - `cropToSquare(file: File, crop: Crop): Promise<File>`. Decodes with `createImageBitmap(file, { imageOrientation: 'from-image' })`, draws the square with `drawImage` onto a canvas of `outputSide(size)`, writes `canvas.toBlob(..., 'image/webp', 0.9)`, and returns `new File([blob], <name without extension>-square.webp, { type: 'image/webp' })`. Throws `Error('Could not read this picture')` if decoding fails.

- [ ] **Step 1: Write the failing tests.** `outputSide(1500) === 1024`, `outputSide(30) === 30`, `outputSide(0) === 1`. Mock `createImageBitmap` and `HTMLCanvasElement.prototype.getContext`/`toBlob` (jsdom has no canvas). Assert `cropToSquare` passes `imageOrientation: 'from-image'`, the output name is `photo-square.webp`, and a rejected decode throws `Could not read this picture`.
- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/cropRender.test.ts` → FAIL.
- [ ] **Step 3: Implement `lib/crop/render.ts`.** Use `cropPixels` for `sx, sy, size`. Draw from the bitmap with `drawImage(bitmap, sx, sy, size, size, 0, 0, out, out)`. Call `bitmap.close()` after drawing.
- [ ] **Step 4: Run it and confirm it passes.** → PASS.
- [ ] **Step 5: Commit** `feat(crop): render the square to a WebP file (A24)`

---

### Task 3: CropDialog component

**Files:**
- Create: `components/admin/CropDialog.tsx`
- Test: `tests/CropDialog.test.tsx`

**Interfaces:**
- Consumes: `Crop`, `defaultCrop`, `moveCrop`, `resizeCrop`, `startCropFor`, `cropPixels` (Task 1).
- Produces: `CropDialog({ file, start?, onCancel, onSave })`, where `file: File`, `start?: Crop`, `onCancel: () => void`, `onSave: (crop: Crop) => void`. `onSave` gets the crop only. The caller renders and uploads (Task 4).

Behaviour:
- `role="dialog"`, `aria-label="Crop picture"`, modal, with a close (X) button labelled "Close".
- Loads the picture with `URL.createObjectURL(file)` and `img { image-orientation: from-image }`. On load it reads `naturalWidth` and `naturalHeight`, then sets the crop to `startCropFor(start, W, H)`.
- The square has a dashed border, four corner handles (visual), and a drag area in the middle. Pointer drag moves it. The bottom-right handle drags to resize.
- Keyboard on the square (`tabIndex={0}`, `aria-label="Crop area"`): Arrow keys move by 2% of the picture side; Shift+Arrow resizes by 2%; Enter saves; Esc cancels.
- Preview: a square `div` showing the picture through `backgroundSize` and `backgroundPosition` computed from the crop (CSS only, no canvas).
- Buttons: "Cancel" and "Save". Save calls `onSave(crop)`. Focus ring visible (`outline` on `:focus-visible`).
- Revokes the object URL on unmount.

- [ ] **Step 1: Write the failing tests** in `tests/CropDialog.test.tsx`. Stub `naturalWidth`/`naturalHeight` (for example 1200x800) with a `load` event on the `img`. Assert: dialog is named "Crop picture"; Save calls `onSave` with a crop where `w * 1200 === h * 800`; ArrowRight on "Crop area" moves `x` right; Shift+ArrowRight grows the square; Esc calls `onCancel`; Cancel calls `onCancel` and not `onSave`.
- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/CropDialog.test.tsx` → FAIL.
- [ ] **Step 3: Implement `components/admin/CropDialog.tsx`.** Use the admin's `admin-ui.module.css` buttons (`s.btn`, `s.ghost`) to match `MediaLibraryDialog`. Follow the file's existing comment style (short JSDoc above the component).
- [ ] **Step 4: Run it and confirm it passes.** → PASS.
- [ ] **Step 5: Commit** `feat(crop): crop dialog with move, resize and keyboard (A24)`

---

### Task 4: Crop every bitmap upload in MediaLibraryDialog

**Files:**
- Modify: `components/admin/MediaLibraryDialog.tsx` (`upload()` around line 80, the `uploadToLibrary` call around line 91)
- Modify: `components/admin/LibraryButton.tsx` (pass `startCrop` and `onCropped` through)
- Test: extend `tests/MediaLibraryDialog.test.tsx`

**Interfaces:**
- Consumes: `CropDialog` (Task 3), `cropToSquare` (Task 2), `Crop` (Task 1), `uploadToLibrary` (existing).
- Produces: new optional props on both components: `startCrop?: Crop` and `onCropped?: (crop: Crop) => void`. `onCropped` runs after a successful upload, with the crop that was used.

Behaviour:
- In `upload(picked)`, for `image/png`, `image/jpeg`, `image/webp`: run the existing checks, then set state `cropping = picked` and stop. Do not upload yet.
- `CropDialog` opens with `file={cropping}` and `start={startCrop}`.
- On save: `const squared = await cropToSquare(file, crop)`, then `uploadToLibrary('image', squared)`, then add the path to the list, call `onCropped?.(crop)`, and clear `cropping`. Errors from `cropToSquare` show in `uploadError` and nothing uploads.
- On cancel: clear `cropping`, nothing uploads.
- SVG keeps the current path (no crop).
- Audio is unchanged.

- [ ] **Step 1: Write the failing tests.** Mock `@/lib/crop/render` (`cropToSquare`) and `@/lib/media` (`uploadToLibrary`). Assert: picking a PNG opens "Crop picture" and does not call `uploadToLibrary`; Save uploads the cropped file (`cropToSquare` called with the crop) and calls `onCropped` with the crop; Cancel uploads nothing; picking an SVG uploads without the dialog; a rejected `cropToSquare` shows "Could not read this picture" and uploads nothing.
- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/MediaLibraryDialog.test.tsx` → FAIL.
- [ ] **Step 3: Implement the change** in `MediaLibraryDialog.tsx` and pass the two props through `LibraryButton.tsx`.
- [ ] **Step 4: Run it and confirm it passes.** Same command → PASS. Also run `npx vitest run tests/AdminCards.test.tsx tests/SvgPaste.test.tsx` → PASS (callers of `LibraryButton`).
- [ ] **Step 5: Commit** `feat(crop): crop bitmap pictures before the library upload (A24)`

---

### Task 5: Spot the Differences: picture B uses A's crop, 1:1 board

**Files:**
- Modify: `components/admin/SpotLevelPanel.tsx` (remove the tip at line 79 and the tall warning at line 81; accept `startCrop` and `onCropped`, pass them to `LibraryButton`)
- Modify: `app/admin/(panel)/spot/page.tsx` (keep an in-session `Map<levelId, Crop>` for picture A; pass it to picture B as `startCrop`)
- Modify: `components/spot/SpotBoard.tsx` (`DEFAULT_ASPECT` from `4 / 3` to `1`; keep `MAX_W = 880`, `MAX_H = 860`)
- Test: extend `tests/SpotBoard.test.tsx`, `tests/SpotLevels.test.tsx` (or `tests/AdminSpot.test.tsx`, whichever already covers the panel)

**Interfaces:**
- Consumes: `Crop` (Task 1); `startCrop` / `onCropped` on `LibraryButton` (Task 4).
- Produces: none for other tasks.

Behaviour:
- Picture A's upload calls `onCropped(crop)`, and the page stores it for that level id. Picture B's button passes that stored crop as `startCrop`. The dialog then starts from A's region.
- Drop the 4:3 tip and the tall warning. Keep the existing 2% A/B aspect-mismatch warning. This matches spec section 6.
- `SpotBoard` with aspect 1 gives an 860x860 picture per side, two side by side, within 1920x1080.
- Clear the stored crops in the same places `clearPending` runs (Save and Revert).

- [ ] **Step 1: Write the failing tests.** Board: a square picture (`naturalWidth === naturalHeight`) renders at 860x860 with the default aspect. Panel: the tip text and tall warning are gone. Page: uploading A then B passes A's crop as `startCrop` to B.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/SpotBoard.test.tsx tests/AdminSpot.test.tsx` → FAIL.
- [ ] **Step 3: Implement** the changes above.
- [ ] **Step 4: Run them and confirm they pass.** → PASS. Also `npx vitest run tests/spotLevels.test.ts tests/spotValidate.test.ts` → PASS (aspect rule still exists).
- [ ] **Step 5: Commit** `feat(spot): square board, picture B uses picture A's crop (A25)`

---

### Task 6: Find It and the level thumbnails: 1:1

**Files:**
- Modify: `components/find/FindBoard.tsx` (`DEFAULT_ASPECT` from `4 / 3` to `1`; the `MAX_W = 1280` / `MAX_H` bounds stay)
- Modify: `components/find/FindLevelTile.tsx` (line 17: `aspectRatio: '4 / 3'` to `'1 / 1'`)
- Modify: `components/spot/SpotLevelTile.tsx` (line 17: `aspectRatio: '4 / 3'` to `'1 / 1'`)
- Test: extend `tests/FindBoard.test.tsx` and `tests/FindLevels.test.tsx`

**Interfaces:**
- Consumes: none.
- Produces: none.

Behaviour: a square picture on Find shows at most 800x800 (the stage height bound, from the existing `heightBound` logic). Tiles are 360 px wide and 360 px tall. The level grid still fits 1920x1080; check this in Task 8.

- [ ] **Step 1: Write the failing tests.** A square picture gives a 800x800 board; `FindLevelTile` has `aspect-ratio: 1 / 1`.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/FindBoard.test.tsx tests/FindLevels.test.tsx` → FAIL.
- [ ] **Step 3: Implement** the three one-line changes.
- [ ] **Step 4: Run them and confirm they pass.** → PASS.
- [ ] **Step 5: Commit** `feat(find): square board and level thumbnails (A20, F2)`

---

### Task 7: Quiz question picture: 300x300 frame

**Files:**
- Modify: `app/games/quiz/[setId]/page.tsx` (line 226: `width: 600, height: 300` to `width: 300, height: 300`)
- Test: extend the Quiz play test (find the file under `tests/` that renders `app/games/quiz`; if none, `tests/QuizSets.test.tsx`)

**Interfaces:**
- Consumes: none.
- Produces: none.

Behaviour: the question picture frame is 300x300. The image stays `object-fit: contain` (already in place). Before editing, measure the question row height at 1920x1080 in the running app (Task 8, Step 3). If the 300 px frame overlaps the answers band, stop and update the spec (section 8) before changing the size.

- [ ] **Step 1: Write the failing test.** The question picture wrapper has a `300px` width and height.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement** the change.
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Commit** `feat(quiz): square question picture frame (A5, ADR-032)`

---

### Task 8: Documentation and layout check

**Files:**
- Modify: `docs/decision.md` (add ADR-032 that supersedes ADR-024; mark ADR-024 superseded in its status line)
- Modify: `spec.md` (A5 picture size text; A15 remove the tip and tall-picture wording; add A24-A26 rows)
- Modify: `docs/superpowers/specs/2026-10-31-square-image-crop-design.md` (section 4 "Output": WebP at 0.9, not PNG; the reason is the 2 MB limit)
- Modify: `docs/superpowers/specs/2026-10-30-spot-the-differences-design.md` (note that A15 tip and tall-picture warning are replaced by ADR-032)

**Interfaces:** none.

Steps:
- [ ] **Step 1: Write the ADR and spec text** as listed above. Keep the wording the same as the existing rows.
- [ ] **Step 2: Check the docs with lint.** `npm run lint`. Ignore Markdown-only warnings that were already there before this branch.
- [ ] **Step 3: Measure the layout.** Start `npm run dev`, open the Quiz set, Spot and Find screens at 1920x1080 in the browser, and confirm there is no overlap (ADR-025 for Quiz). Write the result into this plan under Task 7 before closing it.
- [ ] **Step 4: Commit** `docs(crop): ADR-032 and spec updates for square pictures`

---

### Task 9: End-to-end check and final gates

**Files:**
- Create: `e2e/admin-square-crop.spec.ts`

**Interfaces:**
- Consumes: the admin library flow (Tasks 3-4) and the stand-in Supabase in `e2e/support/`.

Behaviour: upload a 1200x800 PNG from the card editor's "Choose images" library, crop it, and check that the stored path ends in `.webp` and the uploaded file is square (check the stored object's dimensions through the stand-in support helper). Look at `e2e/admin-cards.spec.ts` and copy its setup and login helpers.

- [ ] **Step 1: Write the E2E test** following `e2e/admin-cards.spec.ts`.
- [ ] **Step 2: Run it and confirm it fails** (the crop dialog does not exist before Task 4): `npm run e2e -- e2e/admin-square-crop.spec.ts` → FAIL. Run this step on the branch after Task 4 and before the rest, if you want the failure to show.
- [ ] **Step 3: Run the full gates** on the finished branch:
  - `npm run typecheck` → no errors
  - `npm run lint` → no errors
  - `npm test` → all pass
  - `npm run build` → succeeds
  - `npm run e2e` → all pass
- [ ] **Step 4: Commit** `test(crop): end-to-end square upload (A24)`

---

## Self-Review

- **Spec coverage:** Section 3 components → Tasks 1-4. Section 4 behaviour → Tasks 1, 3, 4 (keyboard, preview, errors). Section 5 layout → Tasks 5, 6, 7. Section 6 rule changes → Task 8. Section 7 testing → Tasks 1-7, 9. Section 8 open items → Task 7 Step 3 (measure) and Task 8 Step 3. Spec section 4's PNG output is changed to WebP (Global Constraints, Task 8 updates the spec).
- **Type consistency:** `Crop` and its fields are defined once (Task 1) and used the same way in Tasks 2-5. `startCrop` / `onCropped` names match across `LibraryButton`, `MediaLibraryDialog`, `SpotLevelPanel`, and the Spot page.
- **Review Focus:** each of the five lines has a test in Tasks 1, 2, 4 or 3.
