# Parent feedback round 2: sign-in scene, game list, celebration pictures, theme and grown-up check

Date: 2026-11-05. Status: Accepted. Repo: `child-mini-game-global`. Builds on `2026-11-05-parent-feedback-ui-design.md`.

Requirement IDs: `FB1..FB5`. Cite them in commits. FB2 finishes FG1..FG6 of the first feedback spec, which were specified but not built.

- **FB1** Child sign-in page (`/play/sign-in`) is lively: the princess and the prince sway gently, clouds drift, a few birds fly across the sky, and grass and flowers sway on the ground. All of it is SVG or CSS, decorative, and stops under `prefers-reduced-motion`. `SkyScene` takes a `lively` prop; the picker keeps its calmer scene.
- **FB2** The two icons (My family, Everyone) at the top of the games page are removed. Play order is fixed: the signed-in parent's own content first, then global (FG1..FG6). The list query is explicit (`owner_id` is the parent, or `visibility` is `global`) and the parent's rows come first. Memory and Listen use family cards first and drop a global card whose word a family card already has. `ScopeSwitch` and `applyScope` are deleted; `useContentScope` stays for the admin tabs. Spec N6 of the Phase 3 design is amended.
- **FB3** The "you did it" screen shows the child's own pictures. The parent uploads two pictures per child in the child form (A and B, public bucket, same limits and quota as the avatar). They replace the two built-in characters and sway gently (CSS rotation, off under reduced motion). With no picture the built-in characters stay. Stored as `children.celebrate_a_path` and `children.celebrate_b_path`; `media_in_use()` and `MEDIA_SOURCES` count them, so a picture in use is never deleted.
- **FB4** One pale yellow (`#fffcf2`) is the background of the child form, the child card on the parent's page, the picker card, the PIN popup and the leave-game popup. A child's gender changes only the text color and the border color (boy: blue, girl: pink). The welcome screen keeps its own theme.
- **FB5** The grown-up check before the admin area (Parent configuration on the picker) is a centered dialog with a stop-hand icon on a pale pink disc with a pink border. The sum is two two-digit numbers (each 10 or more) and the total never exceeds 99. The question and the answer box are centered. The sign-out check keeps its one-digit sum (6 to 9).

## Checks

- Unit: `ownerFirst`, `familyOrGlobal`, `prepareCards`, family-first `drawDeck` and `buildRounds`, `AdultCheck` two-digit range across the random range, `CelebrationScene` with and without pictures, `ChildModal` saves and frees the two pictures, theme colors.
- DB: `npm run test:rls` includes `media_in_use` for the new columns.
- Visual: `/play/sign-in` at 1440x900.
