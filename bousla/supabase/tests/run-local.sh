#!/usr/bin/env bash
# Runs the BOUSLA migration + security tests on a throwaway local PostgreSQL.
# Usage: npm run test:db   (needs PostgreSQL 15+ binaries on this machine)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"; PORT="${PGPORT_TEST:-54329}"
RUNAS=""; if [ "$(id -u)" = "0" ]; then RUNAS="runuser -u postgres --"; chown postgres "$WORK"; fi
cleanup() { $RUNAS "$PGBIN/pg_ctl" -D "$WORK/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
$RUNAS "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
$RUNAS "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start -w >/dev/null
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
cat "$HERE/stub_supabase.sql" | $RUNAS "${PSQL[@]}"
for f in "$HERE"/../migrations/*.sql; do echo "▶ migration $(basename "$f")"; cat "$f" | $RUNAS "${PSQL[@]}"; done
echo "▶ security & reward tests"
cat "$HERE/security_test.sql" | $RUNAS "${PSQL[@]}" -o /dev/null 2>&1 | sed "s/^NOTICE:  /  /"
echo "✔ all database tests passed"
