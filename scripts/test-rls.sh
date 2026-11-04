#!/usr/bin/env bash
# Runs the DB (RLS) suite. Uses RLS_DATABASE_URL if set; otherwise starts a throwaway
# local Postgres 16 cluster on a free port and removes it afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${RLS_DATABASE_URL:-}" ]; then
  exec npx vitest run -c vitest.rls.config.ts "$@"
fi

PGBIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "Set RLS_DATABASE_URL or install Postgres (initdb not found)" >&2; exit 1; }

WORK="$(mktemp -d)"
DATA="$WORK/data"
PORT="$(node -e "const s=require('net').createServer().listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})")"

# Postgres refuses to run as root.
if [ "$(id -u)" = 0 ]; then
  RUN=(runuser -u postgres --)
  chown postgres "$WORK"
else
  RUN=()
fi

cleanup() {
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -w -l "$WORK/pg.log" \
  -o "-p $PORT -k $WORK -c listen_addresses=127.0.0.1 -c fsync=off" start >/dev/null

export RLS_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/postgres"
npx vitest run -c vitest.rls.config.ts "$@"
