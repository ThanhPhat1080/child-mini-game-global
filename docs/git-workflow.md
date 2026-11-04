# Git workflow and deployment

Authoritative rules for branches, PRs and deploys. Claude must follow this exactly.

## Branches
| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | Production. Protected. Only receives PRs from `develop`. | Vercel Production |
| `develop` | Integration/development. Default target for all work. | Vercel Preview |
| feature/fix branches (incl. `claude/*`) | Short-lived work, branched from `develop`. | Vercel Preview |

## Flow for every change (Claude follows this exactly)
1. **Branch from the user's local `develop`.** `git fetch origin`, `git checkout develop`, `git pull origin develop`, then `git checkout -b <branch>` (use the `claude/*` name the session assigns, otherwise `claude/<short-topic>`). Do this before editing anything, and never keep working on an old feature branch. The user can then `git fetch` and check out the branch to test locally.
2. **Change and check.** Edit, then run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Fix failures before going on.
3. **Commit and push** the branch. **Every time a new branch is created, tell the user so, with the exact commands to switch their local git to it** (`git fetch origin && git checkout <branch>`), and how to test (`npm ci && npm run dev`). Keep it short.
4. **Open a PR** with base `develop` and head the new branch (use the PR template if one exists) and show the user the PR link.
5. **Deploy that branch.** Claude may create a Vercel **Preview** deployment of the new branch and share its URL.
6. **Wait for the user's OK.** Never merge before it. If the user asks for changes, push more commits to the same branch and update the PR.
7. **After the OK:** merge the PR into `develop` (repository's default merge method), then create a Preview deployment of `develop`, share the URL, and start the next task again from step 1 with the fresh `develop`.
8. **Release:** `develop` -> `main` only when the user asks (see "Release checklist").

## Deploying: what Claude may and may not do
- **May, without asking:** Preview deployments of the task branch (step 5) and of `develop` (step 7). Vercel's Git integration also builds a Preview automatically for every pushed branch.
- **Only when the user asks:** deploying or promoting to **Production** (`main`), changing Vercel project settings, env vars, domains or Deployment Protection, and anything outside this repo's Vercel project.

## Rules
1. Every change starts from the latest local `develop` on a new branch (step 1).
2. Every PR has **base = `develop`**. Never open a PR from a feature branch into `main`.
3. The only PR allowed into `main` is **`develop` -> `main`**, and only when the user asks for a release.
4. Never push directly to `main` or `develop`, and never force-push either one. `develop` changes only by merging a PR after the user's OK.
5. Do not merge a PR the user has not approved.
6. Before a release PR, `npm run typecheck`, `npm test` and `npm run build` must pass on `develop`. The GitHub Action only runs typecheck and tests after a push to `main`; Vercel's Git integration does the deploy (Production for `main`, Preview for other branches).
7. Commits cite spec IDs (C1-C15, A1-A10) where relevant, per `CLAUDE.md`.

## One-time GitHub setup (owner does this; Claude's tools cannot set protection)
Settings -> Branches -> Add branch ruleset (or classic rule) for `main`:
- Require a pull request before merging (at least 1 approval, or 0 if solo).
- Require status checks to pass (add the Vercel check once it appears).
- Block force pushes and deletions. Do not allow bypass.
- Optional: restrict who can push; require branches to be up to date.
Optionally protect `develop` the same way, minus the approval requirement.
Then Settings -> General -> Default branch -> `develop`, so new PRs default to it.

## Vercel
- Project: a NEW Vercel project, linked to `ThanhPhat1080/child-mini-game-global`. Team `rock-and-roll` (`team_qw0M5lBhhbrXr4DV9NL0J0ij`), project `child-mini-game-global` (`prj_FgOSoPaQxIc92WFDzSUQ5gSALRQP`).
- Production branch is `main`; every other branch gets a Preview deployment.
- Env vars (Production, Preview, Development): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY` (account creation, `app/api/*`). Nothing else may use `NEXT_PUBLIC_`; mark the service role key as sensitive and never expose it to the browser.
- Install is `npm ci`: keep `package-lock.json` in sync (run `npm install` after changing dependencies and commit the lockfile).
- Production URL: TBD (set after the new Vercel project exists).
- Deployment Protection (Vercel login) blocks the child from opening the page. Turn it off for the child-facing domain.

## Supabase (NEW project, separate from the original; ref `ippeairzjdpsjdjkxypt`, https://ippeairzjdpsjdjkxypt.supabase.co)
Authentication -> URL Configuration:
- Site URL: the Production URL above (or the custom domain).
- Redirect URLs: `<production URL>/**`, `http://localhost:3000/**`, and for previews `https://*-<new-team-slug>.vercel.app/**`.
- Auth -> Email: set up custom SMTP (the built-in sender is rate limited and only for the team) and keep "Confirm email" on, because parents sign up themselves.
- Auth -> Providers -> Email: minimum password length 8.
Schema changes go through `supabase/migrations/*.sql` only (see `CLAUDE.md`).

**Applied 2026-11-05 (project `ippeairzjdpsjdjkxypt`):** all 25 files in `supabase/migrations/` were applied through the Supabase MCP `apply_migration`, so the project's migration history holds the same SQL under MCP timestamps (20261104220405 onward), not the file versions. Do not run `supabase db push` against this project without first running `supabase migration repair` for them, or it will try to apply every file again. New migrations: apply with `apply_migration` and keep the file in the repo.

### Phase 3 first deployment runbook (owner steps)
1. Create the new Supabase project; note its ref and the Vercel project/team ids and record them in this file.
2. Apply every file in `supabase/migrations/` in order through the migration tool (Supabase MCP `apply_migration` or `supabase db push`); never paste SQL into the dashboard.
3. First Super Admin (U6): sign up through `/sign-up` with the owner's email (the sign-up trigger needs a policy version, so the dashboard "Add user" button does not work), confirm the email, then run once: `update public.profiles set role = 'super_admin' where user_id = (select id from auth.users where email = '<owner email>');`. Later Super Admins are created in the app (`/admin/parents`).
4. Seed rows made by earlier migrations have `owner_id` null and are global; only a Super Admin edits them.
5. Configure SMTP and the redirect URLs above.
6. Create the Vercel project, set the three env vars, deploy `main`.
7. Smoke test: sign in as the Super Admin, create a parent and a child from `/admin/parents`, sign in as the child on `/play/sign-in`.
Check before every release: `npm run typecheck && npm run lint && npm test && npm run test:rls && npm run e2e && npm run build`.

## Release checklist (`develop` -> `main`)
1. `develop` is green and `npm run build` passes.
2. New migrations are applied to Supabase before merging.
3. PR base `main`, head `develop`; merge; confirm the Production deployment is Ready.

**How the PO wants releases run (applies to every release):** when the PO says "release", open the PR and merge it once. If GitHub refuses because the Vercel check is pending, wait for it to finish and try again; do not poll or loop in a background process to save tokens. Report only if the release fails (the PR is not merged, or the Production deployment is not Ready). Do not send a "done" message.

## Phase 2 integration branch
Phase 2 work (Memory Match) goes through the integration branch `claude/phase2/memory-match`, with task branches named `claude/phase2/mm-t<N>-*`. Claude merges each task branch into the integration branch after typecheck, lint, test, build and e2e are green. The PO decides when to merge the integration branch into `develop`.
Phase 2 work for Listen & Pick goes through the integration branch `claude/phase2/listen-pick`, with task branches named `claude/phase2/lp-t<N>-<topic>` (for example `claude/phase2/lp-t7-docs`). Same rules: Claude merges each task branch into the integration branch after typecheck, lint, test, build and e2e are green; the PO decides when to merge it into `develop` (after a play-test).
Phase 2 work for Sort It goes through the integration branch `claude/phase2/sort-it`, with task branches named `claude/phase2/st-t<N>-<topic>` (for example `claude/phase2/st-t12-docs`). Same rules as above. Sort It adds one migration, `supabase/migrations/20261030110000_card_groups.sql`: it is applied to the shared Supabase project only with the PO's OK, and before the admin Cards page or the game is used on that project (the page selects `card_groups` and `group_id`). Apply `supabase/migrations/20261030110000_card_groups.sql` once, through the migration tool (Supabase MCP `apply_migration` or `supabase db push`) so it is recorded in the migration history, and never paste it into the SQL editor (a later `db push` would run it again, re-seed groups the parent renamed or deleted and re-tag cards set to "No group").

## Origin
This repo (`child-mini-game-global`) was forked as a snapshot of `ThanhPhat1080/child-mini-game` `develop` at commit 67a399a (history not carried over). It has its own Vercel project and its own Supabase project; never point it at the original's. Apply all `supabase/migrations/*.sql` to the new Supabase project in order, via the migration tool.
