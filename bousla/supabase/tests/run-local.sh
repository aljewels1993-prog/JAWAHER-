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
echo "▶ upgrade from the pre-PIN database keeps all student data"
$RUNAS "${PSQL[@]}" -c "create database upgrade_test" >/dev/null
UPSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d upgrade_test -v ON_ERROR_STOP=1 -q -X)
cat "$HERE/stub_supabase.sql" | $RUNAS "${UPSQL[@]}"
cat "$HERE/../migrations/20261110000000_bousla_schema.sql" "$HERE/../migrations/20261111000000_teacher_manage_students.sql" | $RUNAS "${UPSQL[@]}"
cat <<'LEGACY' | $RUNAS "${UPSQL[@]}" >/dev/null
insert into auth.users (id) values ('aaaaaaaa-1111-0000-0000-000000000001'), ('aaaaaaaa-1111-0000-0000-000000000002');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-0000-0000-000000000001', false);
set role authenticated;
select public.student_login('Maryam Old', 7);
insert into public.study_tasks (subject, title, task_date) values ('Science', 'Old task', (now() at time zone 'Asia/Muscat')::date);
select public.set_task_completed((select id from public.study_tasks limit 1), true);
reset role;
LEGACY
BEFORE_UP=$($RUNAS "${UPSQL[@]}" -t -A -c "select (select count(*) from public.student_profiles)||'/'||(select count(*) from public.study_tasks)||'/'||(select sum(points) from public.points_transactions)")
cat "$HERE/../setup/upgrade_student_pins.sql" | $RUNAS "${UPSQL[@]}" -o /dev/null
AFTER_UP=$($RUNAS "${UPSQL[@]}" -t -A -c "select (select count(*) from public.student_profiles)||'/'||(select count(*) from public.study_tasks)||'/'||(select sum(points) from public.points_transactions)")
[ "$BEFORE_UP" = "$AFTER_UP" ] && echo "  ok - students/tasks/points identical after upgrade ($AFTER_UP)" || { echo "✖ data changed by upgrade: $BEFORE_UP → $AFTER_UP"; exit 1; }
{ cat "$HERE/upgrade_test.sql"; cat <<'CHECKS'
select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-0000-0000-000000000001', false);
set role authenticated;
select pg_temp.check(public.current_student_id() is null, 'old device must sign in again with a PIN');
select pg_temp.check((select count(*) from public.study_tasks) = 0, 'and sees nothing until then');
select pg_temp.check((public.student_login('Maryam Old', 7, '3141')->>'pin_set')::boolean, 'existing student chooses her PIN at next sign-in');
select pg_temp.check((select count(*) from public.study_tasks where completed) = 1, 'her completed task is still there');
select pg_temp.check((public.get_student_stats()->>'total_points')::int = 5, 'her points are still there');
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-0000-0000-000000000002', false);
set role authenticated;
select pg_temp.check(public.student_login('Maryam Old', 7, '0000')->>'status' = 'wrong_pin', 'someone else typing her name + grade is refused');
reset role;
CHECKS
} | $RUNAS "${UPSQL[@]}" -o /dev/null 2>&1 | sed "s/^NOTICE:  /  /"
if cat "$HERE/../setup/upgrade_student_pins.sql" | $RUNAS "${UPSQL[@]}" >/dev/null 2>&1; then echo "✖ upgrade ran twice"; exit 1; fi
echo "  ok - running the upgrade a second time is refused"
echo "✔ all database tests passed"
