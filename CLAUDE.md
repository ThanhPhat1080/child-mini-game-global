# CLAUDE.md

**childPlayer.** Calm quiz hub for a child (4-5, cannot read) in a computer browser, plus a parent admin dashboard. Phase 1 is closed. Phase 3 (multi-user, spec `docs/superpowers/specs/2026-11-04-multi-user-phase3-design.md`, plan `docs/superpowers/plans/2026-11-04-multi-user-phase3.md`, requirement IDs U, V, Q, N, T) turns one deployment into a service for many families. Phase 2 = only more games: specs and plans live in `docs/superpowers/specs` and `docs/superpowers/plans` (Memory Match, Listen & Pick, Spot the Differences, Sort It and Find It are all built). Phase 2 work for the current game goes through the integration branch `claude/phase2/puzzle-pairs` (Puzzle Pairs H1-H12, A32-A35, spec `docs/superpowers/specs/2026-11-07-puzzle-pairs-design.md`; Find It F1-F10, A20-A23 is on `claude/phase2/find-it`; Sort It R1-R10, A17-A19 is on `claude/phase2/sort-it`; Spot the Differences S1-S10, A14-A16 is already in `develop`; see `docs/git-workflow.md`).

## Docs
`spec.md` (requirement IDs C1-C15, A1-A23, G1, M1-M10, L1-L10, S1-S10 (Spot), R1-R10 (Sort It), F1-F10 (Find It), H1-H12 (Puzzle Pairs); A20-A23 are Find It admin, A32-A35 Puzzle Pairs admin; cite them in commits), `plan.md` (tickets + acceptance criteria), `docs/decision.md` (ADRs; later ones win), `docs/git-workflow.md`, `docs/superpowers/` (Phase 2 specs and plans). `docs/intent.md` is the vision, not a build source. `README.md` is still empty (plan T14).

## Stack and commands
Next.js + React + TypeScript (DOM/CSS; Phaser only if HTML/CSS cannot do it, ADR-030), Supabase (Postgres, Storage, Auth), Vercel. Node 24.
`npm ci`, `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (single file: `npx vitest run tests/<file>`), `npm run test:rls` (RLS and DB-function tests on a throwaway local Postgres, no Docker; any policy or migration change must keep it green). E2E is set up: `npm run e2e` (Playwright, Chromium; builds and starts the app on port 3100 against a stand-in Supabase on port 54391, `e2e/support/`, both set in `playwright.config.ts`). On the cloud image set `PW_CHROMIUM_PATH` to the preinstalled Chromium; never run `playwright install` there.
Schema changes only via new `supabase/migrations/*.sql`, never by hand in the dashboard.

## Rules
- The child cannot read: no screen depends on text, and no child-facing text is hard-coded (the admin writes it), except the three grown-up lines in ADR-036. Answers are image + number + fixed color (1 rose, 2 sky, 3 butter).
- Calm & Slow: pastel tokens from `spec.md` section 6, slow motion, no timers or penalties, honor `prefers-reduced-motion`. Fonts: Baloo 2 (child), Nunito (admin), self-hosted.
- Two roles in `profiles` (`super_admin`, `parent`); a child is a row in `public.children` (at most 5 per parent), not an account. The DB enforces everything with RLS, the UI only mirrors it. The play device keeps the parent's session: `/play` shows a card per child, a 4-character PIN picks one (cookie `cp_child`), and parent sign-out or Parent Configuration asks "a + b = ?"; Leave game on / and /games returns to /play with no check, and the PIN guards coming back. Child pages are read-only (ADR-035). Parents own their content (private, then pending, then global after the Super Admin approves). Banned parents are sent to `/admin/suspended`; their children keep playing. Never put the service role key in the frontend or commit secrets. Only the Supabase URL and anon key may use `NEXT_PUBLIC_`; `SUPABASE_SERVICE_ROLE_KEY` is a server-only env var used by `app/api/*` only.
- Desktop Chromium only, no TV work (ADR-028). Child keyboard: 1/2/3 answer, Left/Right move, Enter/Space pick, Esc back (`lib/keynav.ts`); keep a visible focus ring.
- A visitor (guest, no account) plays global content only: `lib/visitor.ts`, the middleware opens `/` and `/games` for the cookie, RLS decides data; leaving asks the sum and erases it (spec GU1-GU14).
- Games plug into the registry (ADR-014). One audio manager; nothing plays before "tap to enter". One deployment serves many families; configure it with env vars only.

## Optimistic UI
For an admin action that is fast and rarely fails (rename, reorder, toggle): update the UI first, send the request after, and on failure put the old state back and show an error toast. Disable anything that depends on the unconfirmed value (e.g. OK in the library) until it settles. Never use it for deletes, uploads or anything that cannot be undone.

## Workflow
Each ticket has acceptance criteria; do not mark it done until they pass. When Claude makes the same mistake twice, add the fix here. Keep this file under one page.
E2E is run only for what changed: `PW_CHROMIUM_PATH=<chrome> npx playwright test e2e/<spec>.spec.ts` for the specs that touch the changed screens (the full `npm run e2e` is a ~9 min run, only for a release or when the user asks). Locally the Chrome path is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. The Homebrew Postgres for `npm run test:rls` needs `PG_BIN=/opt/homebrew/bin` and `LC_ALL=C`.

## Git
`main` = production, `develop` = integration. Branch from latest `develop`, PR into `develop`, merge only after the user's OK; `develop` -> `main` only when asked. Never push or force-push to `main`/`develop`. Tell the user each new branch name (`git fetch origin && git checkout <branch>`). Production deploys and Vercel settings only when asked. On "release": merge once, do not poll the Vercel check, and report only a failure.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
