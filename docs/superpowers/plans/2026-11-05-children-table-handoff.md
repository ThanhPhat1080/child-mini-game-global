# Children table: handoff after Task 5

Plan: `2026-11-05-children-table.md`. Spec: `../specs/2026-11-05-children-table-design.md`. Branch: `claude/children-table`.

## Done (Tasks 0 to 5), each reviewed by a separate reviewer

| Task | Commits | Result |
|---|---|---|
| 0 branch, split old work | 50779f7..b52add4 | done |
| 1 DB: `children`, RLS, role removal | b1da716 | approved |
| 2 data layer, cookie `cp_child` | f4d42b8 | approved |
| 3 roles, Super Admin view | 38e572c | approved |
| 4 parent cards and modal | 0d0851a, e2a4ba4 | approved after 1 fix round |
| 5 play picker, PIN, middleware | 87b5ccd, 5ba59a9 | approved after 1 fix round |

Verified at the end of Task 5: `npx vitest run` 1339 tests pass, `npm run typecheck` and `npm run lint` clean, `npm run test:rls` passed at Task 1 (158 tests).

## Left to do: Task 6 and the final review

1. **e2e is broken until updated.** The stand-in Supabase (`e2e/support/standin-supabase.mjs`) has no `children` table and still seeds a child profile; specs open `/games` with no `cp_child` cookie and now redirect to `/play`. Update the stand-in, `fixtures.ts`, `global-setup.ts` (parent signs in, picks the seed child with PIN `1234`, saves storage state with the cookie) and `e2e/multiuser.spec.ts` as in plan Task 6. Then run `npm run e2e`.
2. **Docs:** ADR-035 in `docs/decision.md` (supersedes ADR-033's role `child`; the name+PIN ADR-034 was never committed), CLAUDE.md rules (roles are `super_admin` and `parent`; children are table rows; the play device keeps the parent session), README roles line, spec status Accepted, add the rulings below to the spec.
3. **Final whole-branch review**, then `graphify update .`.
4. **Remote Supabase:** apply `supabase/migrations/20261105020000_children_table.sql` (`supabase db push`). It DELETES existing child users and re-keys `child_settings`. Do this before deploying.

## Rulings made during execution (decisions on the owner's behalf)

- Work stayed on the branch in place, no worktree (the tree holds the local Supabase stack).
- `media_in_use()` was rewritten in the Task 1 migration to read `children.avatar_path` (the plan missed it).
- Local Supabase was migrated with `migration repair` + `migration up`, never `db reset` (it holds the owner's local parent account).
- `createChild` normalizes names (trim, collapse whitespace runs) before insert.
- Cookie `cp_child` keeps `Max-Age=31536000` (1 year) instead of "no expiry".
- Welcome sound is in the child modal's main form; `ChildSounds` handles music, volume, hooray, oh-oh, complete in a collapsed "More sounds" block (edit mode only).
- `components/auth/LogoutButton.tsx` is "back to sign-in" (used on `/play`); `SwitchChildButton.tsx` is the `/games` corner control (no sign-out).
- Admin previews: `?preview=1` on `/games/**` skips the `cp_child` requirement (profile still required); the three "Preview as child" links append it. There is no draft guard on by-id play routes (quiz, Spot, Find); the published/active filter applies to list queries only.
- The play picker and the middleware only see children of the signed-in user (`parent_id = user id`); a Super Admin sees just the Parent Configuration card.

## Deferred minor findings (not blocking)

- DB: tab/newline edge in the name index and length check; role-change guard (parent with children) dropped with `profiles_guard`; parent UPDATE policy has no column restriction; some DB negative tests use bare `rejects.toThrow()`; 5-child limit is race-safe under READ COMMITTED only.
- Data layer: `updateChild` with an empty patch sends `update({})`; `display_name` not whitespace-collapsed; test hygiene items in `tests/children.test.ts`, `tests/settings.test.ts`.
- Super Admin: `removeChild` shows success when RLS deletes 0 rows (add `.select('id')`); `adminAccess` still types `'forbidden'`.
- Children modal: two Save buttons in edit mode (More sounds has its own); `ChildModal` is ~250 lines; Cancel button inline style; hard-coded "5" in a message; `confirmRemove` has no `catch`.
- Play: `PinEntry` is not keyed by child and its overlay is not modal; window arrow keys stay active behind the sign-out check; `'/play'` in the middleware `OPEN` set is dead code; unused `.corner` CSS; no middleware test for a failing `children` query; no test pins the quiz preview href to `?preview=1`.

The old name+PIN work (email derived from the name) was superseded and is only in a local `git stash`; it is not needed.
