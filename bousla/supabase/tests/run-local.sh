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
# The bundled file must match the migrations (it is what people paste into Supabase).
SETUP="$HERE/../setup/bousla_full_setup.sql"
cp "$SETUP" "$WORK/committed.sql"; bash "$HERE/../build-setup.sh" >/dev/null
if ! cmp -s "$SETUP" "$WORK/committed.sql"; then echo "✖ setup/bousla_full_setup.sql was out of date — rebuilt it, please commit it"; exit 1; fi
echo "▶ setup/bousla_full_setup.sql (the file to paste into the SQL Editor)"
cat "$SETUP" | $RUNAS "${PSQL[@]}"
echo "▶ running it a second time must stop without changes"
if cat "$SETUP" | $RUNAS "${PSQL[@]}" 2>"$WORK/second.err"; then echo "✖ second run did not stop"; exit 1; fi
grep -q "already installed" "$WORK/second.err" && echo "  ok - second run refused: BOUSLA is already installed"
echo "▶ verify_setup.sql"
VERIFY=$(cat "$HERE/../setup/verify_setup.sql" | $RUNAS "${PSQL[@]}" -A -t)
echo "$VERIFY" | sed 's/^/  /'
if echo "$VERIFY" | grep -q "❌"; then echo "✖ verify_setup reported a problem"; exit 1; fi
echo "▶ security & reward tests"
cat "$HERE/security_test.sql" | $RUNAS "${PSQL[@]}" -o /dev/null 2>&1 | sed "s/^NOTICE:  /  /"
echo "✔ all database tests passed"
