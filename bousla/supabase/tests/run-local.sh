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
echo "▶ change-code template refuses a malformed hash"
if sed "s|HASH_HERE|not-a-hash|" "$HERE/../setup/change_teacher_code_template.sql" | $RUNAS "${PSQL[@]}" >/dev/null 2>&1; then echo "✖ malformed hash accepted"; exit 1; fi
echo "  ok - malformed hash refused"
echo "▶ backup_export.sql is read-only and complete"
BACKUP_SQL="$HERE/../setup/backup_export.sql"
if grep -qiE "\b(insert|update|delete|drop|truncate|alter|create|grant|revoke)\b" <(grep -v "^\s*--" "$BACKUP_SQL"); then echo "✖ backup query contains a write statement"; exit 1; fi
BEFORE=$($RUNAS "${PSQL[@]}" -t -A -c "select (select count(*) from public.student_profiles)||'/'||(select count(*) from public.study_tasks)||'/'||(select count(*) from public.points_transactions)")
( echo "begin transaction read only;"; cat "$BACKUP_SQL"; echo "commit;" ) | $RUNAS "${PSQL[@]}" -t -A > "$WORK/backup.json"
AFTER=$($RUNAS "${PSQL[@]}" -t -A -c "select (select count(*) from public.student_profiles)||'/'||(select count(*) from public.study_tasks)||'/'||(select count(*) from public.points_transactions)")
python3 - "$WORK/backup.json" "$BEFORE" <<'PY'
import json, sys
raw = [l for l in open(sys.argv[1]).read().splitlines() if l.strip().startswith('{')][0]
d = json.loads(raw)
students, tasks, points = map(int, sys.argv[2].split('/'))
assert d['app'] == 'BOUSLA' and d['counts']['students'] == students == len(d['students'])
assert d['counts']['tasks'] == tasks == len(d['tasks']) and d['counts']['points_transactions'] == points == len(d['points_transactions'])
assert all('name_key' not in s for s in d['students']) and 'teacher_code_hash' not in raw
print(f"  ok - backup has {students} students, {tasks} tasks, {points} point entries; no security data")
PY
[ "$BEFORE" = "$AFTER" ] && echo "  ok - database unchanged by the backup query ($BEFORE)"
echo "✔ all database tests passed"
