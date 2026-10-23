#!/usr/bin/env bash
# Spin up a throwaway Postgres, apply the migration over a stub of Supabase's
# auth schema, and run the RLS tests. Needs Postgres 15+ binaries on PATH or
# under /usr/lib/postgresql/*/bin.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
[ -n "$bin" ] && export PATH="$bin:$PATH"
tmp="$(mktemp -d)"
# Postgres refuses to run its server as root; drop to the postgres user if we are.
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$tmp"
trap 'as_pg pg_ctl -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
as_pg initdb -D "$tmp/data" -U postgres -A trust >/dev/null
as_pg pg_ctl -D "$tmp/data" -o "-k $tmp -c listen_addresses='' -p 54329" -l "$tmp/log" start >/dev/null
for i in $(seq 1 30); do pg_isready -h "$tmp" -p 54329 >/dev/null 2>&1 && break; sleep 0.2; done
psql=(psql -h "$tmp" -p 54329 -U postgres -d postgres -v ON_ERROR_STOP=1 -q -o /dev/null)
"${psql[@]}" -f "$here/00_stub_auth.sql"
for m in "$here"/../migrations/*.sql; do "${psql[@]}" -f "$m"; done
"${psql[@]}" -f "$here/99_grants.sql"
for t in "$here"/*.test.sql; do "${psql[@]}" -f "$t"; done
