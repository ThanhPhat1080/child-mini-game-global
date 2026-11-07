# Local setup and test commands

Written so another machine can run the same checks. Machine-specific paths are in the examples; adjust them.

## Supabase local stack (needs Docker Desktop)

- Start: `npx supabase start` (Docker Desktop must be running).
- The `docker` CLI may not be on PATH. On macOS it is at `/Applications/Docker.app/Contents/Resources/bin/docker`.
- Apply pending migrations (keeps local data): `npx supabase migration up`.
- Check which migrations are applied: `npx supabase migration list`. A row with an empty remote column is pending.
- Rebuild from every migration: `npx supabase db reset`. **This deletes all local data.** Ask first.
- Query the local DB: `docker exec supabase_db_child-mini-game-global psql -U postgres -d postgres -c "<sql>"`.
- `.env.local` points at `127.0.0.1:54321`. The service role key is server-only; never print or commit it.

### Pitfall: local DB drifted from the migration files

If a migration fails with `policy ... already exists` but `supabase_migrations.schema_migrations` does not list it, the local DB was changed outside the migration history. Check with `pg_proc.prosecdef` and `pg_policy`. Fix it by rebuilding the local DB (`db reset`), not by hand-editing SQL.

### Bootstrapping a Super Admin on local only

1. Sign up as a parent in the app (or create one with `/api/users` as an existing Super Admin).
2. Promote it on the local DB:
   `update public.profiles set role = 'super_admin' where user_id = (select id from auth.users where email = '<email>');`
3. Sign in at `/admin/sign-in`.

Do not do this on production. Production changes need the user's approval.

## Database (RLS) tests: `npm run test:rls`

The script starts a throwaway Postgres 16 cluster, so it does not need Docker.

- Install once: `brew install postgresql@16`.
- Run:
  `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 PG_BIN=/opt/homebrew/opt/postgresql@16/bin npm run test:rls`
- Without the UTF-8 locale, `initdb` fails with "invalid locale settings".
- Any policy, migration or trigger change must keep this green. Last run: 8 files, 164 tests.

## Unit tests and typecheck

- `npm test` (all), or `npx vitest run tests/<file>` (one file).
- `npm run typecheck`.

## End-to-end: `npm run e2e`

- Playwright builds the app and starts a stand-in Supabase on ports 3100 and 54391 (`e2e/support/`).
- Set `PW_CHROMIUM_PATH` to the Chrome binary, not the `.app` folder:
  `PW_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npx playwright test`.
- On the cloud image, use the preinstalled Chromium. Never run `playwright install` there.
- One spec: `npx playwright test e2e/admin-cards.spec.ts`.

## Traps seen so far

- **Symlinked `node_modules` breaks `next build`** (Turbopack cannot find the workspace root). For a second checkout, clone it: `cp -cR <repo>/node_modules <checkout>/node_modules` (APFS clone, fast, no extra space).
- **Layout tests measure during CSS transitions.** A width transition that runs at page load can make a 390px test see overflow. The admin rail waits one frame before it animates (`components/AdminNav.tsx`).
- **A test that reads a computed colour** gets `rgb(r, g, b)` from jsdom, with commas, not `rgb(r g b)`.
