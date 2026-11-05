# Parent feedback: sign-in, picker, gender theme and game list design

Date: 2026-11-05. Status: Accepted. Repo: `child-mini-game-global`.

Requirement IDs: `FA1..` (admin UI and modals), `FS1..` (sign-in and sign-up), `FP1..` (picker, PIN, gender theme, corner buttons), `FG1..` (game list without the filter), `FT1..` (tests). Cite them in commits.

## 1. Goal

Act on the parent's feedback (10 items). Parents stop confusing the play sign-in with the admin sign-in and can find sign-up. The child's screens feel like their own, with a prince or princess and matching colors. Admin modals lose small UI defects. `/games` shows the family's and the global content together, the family's first.

Success means: each requirement below passes its acceptance check, and the existing rules still hold (Calm & Slow, keyboard and focus ring, `prefers-reduced-motion`, RLS).

## 2. Decisions taken during brainstorming

| Topic | Decision |
|---|---|
| Fixed text on child screens | Allowed as an exception, in English, for the accompanying grown-up, in three places only. Recorded as ADR-036. |
| Sign-out button on child screens | Leaves to `/play` with no "a + b" check. The parent stays signed in; the PIN is needed to come back. |
| Where that button appears | `/` and `/games` only. Level lists and games keep their back buttons. |
| Prince art | `public/images/prince.webp`, made from the owner's image (section 11). |
| Overall approach | Small shared pieces (`ModalClose`, `useActiveChild`, extended `GENDER_THEME`), four PRs. No rewrite of the dialogs. |
| Card games (Memory, Listen, Sort) | Family cards first; global cards only fill what is missing. |
| "Blue" in feedback item 4 | Sky blue, matching the existing boy colors. |
| Gender theme scope | The `/` screen only. `/games` and the games keep today's colors. |

## 3. Non-goals

- No shared `Modal` rewrite. The 10 dialogs keep their own focus and Escape code.
- No database migration and no RLS change.
- No text authored by the admin for the new strings.
- No gender theme beyond `/`, the picker cards and the PIN popup.
- No change to admin content tabs, which keep `useContentScope`.
- No production deploy or Supabase dashboard change unless the owner asks (see FS7).

## 4. Admin UI and modals (FA1..FA5)

- **FA1** Every modal footer button has the same size: height 44px, horizontal padding 20px, radius 12px, font 15px. This covers at least `AdultCheck`, `MediaLibraryDialog`, `ChildModal` and `ConfirmDialog`. `.primary` (height 50px) stays for full-width sign-in form buttons only. Check: OK and Cancel measure the same height in each modal.
- **FA2** `GENDER_THEME` gains `modalBg`: male `#EEF4F9`, female `#FCEFF0`. `ChildModal` uses it. `ChildCard` and `ChildPickCard` keep `bg`. Text on `modalBg` meets WCAG AA.
- **FA3** In `ChildModal`, Gender (left) and Age (right) share one row, and wrap when the modal is too narrow.
- **FA4** New `components/ModalClose.tsx`: a 36x36px button at the top right with `aria-label="Close"`, a visible focus ring and a disabled state. It does exactly what the dialog's Cancel does, including any unsaved-changes prompt, and is disabled while the dialog is busy.
- **FA5** `ModalClose` is added to `ChildModal`, `ConfirmDialog`, `BanDialog`, `ImportDialog`, `CardImportDialog`, `MediaLibraryDialog` and `AdultCheck`. `CropDialog` and `PolicyCarousel` swap their own close buttons for it, so no dialog has two. Cancel stays, and each dialog's initial focus is unchanged. `GameHelp` keeps its large child-sized Close.

## 5. Sign-in and sign-up (FS1..FS7)

- **FS1** `/play/sign-in` fills the page with the child's world: sky, clouds and pastel hills as on the welcome screen, the princess on the left and the prince on the right, the form in the center, and a "Play area" label with a game-controller icon. It stays usable at desktop window sizes down to 1024px wide, and decorative motion honors `prefers-reduced-motion`.
- **FS2** The form keeps the title "Grown-ups, sign in", with the subtitle "Sign in and play along with your child."
- **FS3** Under the form: "No account yet? Sign up now" links to `/sign-up?from=play`. Beside it, a `?` button (`aria-expanded`, `aria-controls`) toggles an inline panel with one short description of the app and three steps: create an account, confirm the email, add a child in Parent configuration.
- **FS4** `/play/sign-in` has a small link "Managing content? Go to Parent Admin" to `/admin/sign-in`.
- **FS5** `/admin/sign-in` keeps its plain tool look with no characters. The title becomes "Parent Admin sign-in", and a small link "Want to play? Go to the play area" goes to `/play/sign-in`.
- **FS6** `/sign-up` accepts only `from=play`. With it, the brand label reads `childPlayer`, and "Sign in", "Go to sign in" and `emailRedirectTo` all use `/play/sign-in`. Any other value or none behaves as today (`/admin/sign-in`). The value is never used as a URL, so there is no open redirect.
- **FS7** `LogoutButton` on `/play` goes to `/play/sign-in` after its "a + b" check. This changes KU11. Admin sign-out buttons keep `/admin/sign-in`. Deployment check: `/play/sign-in` must be in the Supabase Auth Redirect URLs, or the email link may fall back to the Site URL. The owner does this or asks for it.

## 6. Picker, PIN, gender theme and corner buttons (FP1..FP13)

Text exception (ADR-036): "Who are you?", "Enter your PIN, <name>!" and "Leave game?" with its Stay and Leave labels. These are for the accompanying grown-up. Each screen remains usable without reading, through pictures, avatars and icons.

Data:

- **FP1** `getMyChildSettings` also selects `gender`. New hook `lib/useActiveChild.ts` returns `{ name, avatarUrl, gender }` or a loading or failed state. Gender-dependent parts render only once loaded, so a boy never sees the princess flash. On failure the screen shows today's look.

`/play`:

- **FP2** Title "Who are you?" in Baloo 2, above the cards.
- **FP3** A playful scene in SVG and CSS, not a `<canvas>` element (ADR-030): sun, slowly drifting clouds, balloons and stars. Motion is slow and stops under `prefers-reduced-motion`.
- **FP4** Card size depends on the total card count including Parent configuration: 1 to 4 cards are 340x480, 5 or 6 cards are 280x420 (today 270x400). Cards stay on one row within the 1800px stage width, with a gap of at most 24px at 6 cards. The avatar and the name scale with the card.
- **FP5** `ParentConfigCard` has a dashed border and no background color. This changes KU9, which specified `--peach`.

PIN popup (`PinEntry`):

- **FP6** Title "Enter your PIN, <display name>!", with the prince (male) or princess (female) art and the child's avatar. The initial letter replaces a missing avatar. The panel is `role="dialog"`, `aria-modal`, labelled by the title.
- **FP7** Each box shows a literal `*` once filled, and the real value stays in state only. The boxes remain `type="text"` with autocomplete off, because `type="password"` shows dots and can trigger password-manager prompts. Focusing a box selects its content, so typing replaces it and caret position cannot corrupt the value. Paste, Backspace and arrow keys work as today. The DOM value never contains the real character.
- **FP8** The popup closes with a large child-sized X at the top right, a click outside the panel, or Esc. Focus returns to the card just picked. A wrong PIN still shakes and clears with no text.

`/` for the active child:

- **FP9** Female: no visual change. Male: `prince.webp` replaces the princess, and the "tap to enter" button, the name and the sound bars use sky-blue tones, defined as tokens beside `GENDER_THEME`. The green "Start game" button stays for both.

Corner buttons:

- **FP10** `MusicButton` moves to bottom-right on all 13 child pages that render it, with its behavior unchanged. Pages are checked for overlap. `app/games/find/[levelId]/page.tsx` has a known overlap (its play area reaches `right: 56, bottom: 56`) and must leave room.
- **FP11** New `components/auth/LeaveGameButton.tsx` at bottom-left on `/` and `/games`, the same size as `MusicButton`, with a door-and-arrow sign-out icon and `aria-label="Leave game"`. It replaces `SwitchChildButton`, which is removed with its test.
- **FP12** The button opens a popup with a large avatar in a gender-colored border, the text "Leave game?", a top-right X, and Stay and Leave buttons with both icon and label. Initial focus is on Stay. Esc, X and a click outside all stay in the game.
- **FP13** Leave clears the active child, stops the music and goes to `/play`, with no "a + b" check. The saved music on/off preference is not changed. `setMusicWanted(false)` must not be used, because it persists the preference, so `lib/audio.ts` gains a small `stopMusic()` if nothing suitable exists. The "a + b" check stays on parent sign-out and Parent configuration on `/play`.

## 7. Game list without the filter (FG1..FG6)

- **FG1** `ScopeSwitch` and its test are deleted. `applyScope` is removed, along with anything only it used. `useContentScope` stays for admin tabs. The child no longer shares a `localStorage` choice with the admin tabs, which today changes the child's list when a parent switches tab.
- **FG2** Child content queries filter explicitly: `owner_id` is the signed-in parent, or `visibility` is `global`. RLS alone is not enough, because a Super Admin can read every family's private content and would see it when playing on that account. Global rows with a null `owner_id` still match. Existing `published` and `active` filters stay (K10). Editor-side preview by id is unchanged.
- **FG3** "Family content" means `owner_id` equals the signed-in parent, at any visibility, so the parent's approved global items count as theirs.
- **FG4** Quiz, Find and Spot lists: a pure `ownerFirst(rows, me)` moves family rows first and keeps each part's existing order.
- **FG5** Memory and Listen: family cards are used first, in random order, and global cards fill the rest. `levelsAvailable` counts the merged pool after FG6. Listen's wrong-answer choices may come from the whole pool.
- **FG6** When a family card and a non-family card share a normalized `word`, only the family card stays, in all three card games (a family's own cards are never removed this way), so a question never offers two "cat" answers. Sort It takes groups with family cards first, then global groups, and keeps its existing word-overlap handling.

## 8. Tests (FT1..FT5)

- **FT1** Unit tests: `ownerFirst`, family-first card selection including no family cards and too few family cards, word de-duplication, the explicit owner-or-global filter, and `from=play` handling with an unknown value.
- **FT2** Component tests: `ModalClose` calls the dialog's cancel and is disabled while busy; `PinEntry` never exposes the real character and closes by X, outside click and Esc; `LeaveGameButton` focuses Stay and Leave does not change the saved music preference; male and female variants of `/`; picker card sizes with 4 and with 6 cards, and the dashed `ParentConfigCard`.
- **FT3** Update what the change breaks: `tests/PlayPicker.test.tsx`, `tests/LogoutButton.test.tsx`, `tests/SignUpPage.test.tsx`, `tests/PlaySignIn.test.tsx`, `tests/AdminSignIn.test.tsx`, the game-list tests that mock `applyScope`, and `e2e/support/fixtures.ts` and `e2e/multiuser.spec.ts`.
- **FT4** E2E: from `/play/sign-in` to sign-up and back; PIN mask; leave to `/play` and back through the PIN; family content listed before global on Quiz, Find and Spot.
- **FT5** Visual check at 1920x1080 on all 13 pages with `MusicButton`, confirming no overlap with game content. `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:rls` and `npm run e2e` all stay green. Run `graphify update .` after code changes.

## 9. Docs to update when this ships

- `docs/decision.md`: **ADR-036**, fixed English text for the accompanying grown-up on the three named child screens, as a narrow exception to "no child-facing text is hard-coded". The next free number must be confirmed at write time.
- `CLAUDE.md`: the text rule, and the sign-out rule (leaving a child's session has no check; parent sign-out still does).
- `docs/superpowers/specs/2026-11-05-children-table-design.md`: KU7 (modal background now `modalBg`), KU9 (Parent configuration look), KU10 (PIN popup), KU11 (sign-out destination), and K10 (switching child now goes through the Leave game popup, FP11 to FP13; the PIN is still asked).
- `docs/superpowers/specs/2026-11-04-multi-user-phase3-design.md`: N6, whose "My family" and "Everyone" content switch is removed by FG1.

## 10. Delivery

Four PRs in order, each independently reviewable:

1. FA1..FA5, admin UI and `ModalClose`.
2. FS1..FS7, sign-in and sign-up.
3. FP1..FP13, picker, PIN, theme and corner buttons (uses `ModalClose`).
4. FG1..FG6, game list.

The work needs the children table code, so branches start from `claude/children-table` once its uncommitted work is committed, not from `develop`, unless that branch has been merged by then.

## 11. Assets

`public/images/prince.webp` is ready: 520x655, transparent background, made from the owner's `public/images/prince.jpg` (360x360 source, so it is softer than `princess.webp`). The welcome screen masks the image's lower and side edges, so the feet may fade out. A sharper source can replace the file later with no code change.
