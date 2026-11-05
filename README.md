# ABC Play

A calm quiz and mini-game hub for a young child who cannot read yet, plus a parent admin and a Super Admin console. Next.js, Supabase (Postgres, Storage, Auth), Vercel.

## Run it

```bash
nvm use 24            # Node 24
npm ci
cp .env.example .env.local   # fill in the Supabase URL and anon key; SUPABASE_SERVICE_ROLE_KEY is server only
npm run dev
```

Play device: the parent signs in at `/play/sign-in`, picks a child and types the PIN at `/play`, then `/games`. Parents and Super Admins: `/admin/sign-in` (parents can create an account at `/sign-up`).

## Checks

| Command | What it runs |
|---|---|
| `npm run typecheck`, `npm run lint`, `npm test` | types, lint, unit and component tests |
| `npm run test:rls` | RLS and database-function tests on a throwaway local Postgres (no Docker) |
| `npm run e2e` | Playwright against an in-memory Supabase stand-in (set `PW_CHROMIUM_PATH` if Chromium is preinstalled) |
| `npm run build` | production build |

## Roles

`super_admin` reviews shared content, bans parents and manages quotas; `parent` owns content and up to 5 children (rows in `children`, each with a PIN; the child plays on the parent's signed-in device). See `docs/decision.md` (ADR-033, ADR-035) and `docs/superpowers/specs/2026-11-04-multi-user-phase3-design.md`.

## Deploy

See `docs/git-workflow.md` (Vercel, Supabase and the first-deployment runbook). Schema changes go in `supabase/migrations/` only.
