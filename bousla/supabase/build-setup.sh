#!/usr/bin/env bash
# Builds supabase/setup/bousla_full_setup.sql from the migrations, in order.
# That single file is what you paste into the Supabase SQL Editor.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/setup/bousla_full_setup.sql"
{
  cat <<'HEAD'
-- ════════════════════════════════════════════════════════════════════════════
--  BOUSLA – بوصلة · FULL DATABASE SETUP (generated — do not edit by hand)
--
--  HOW TO RUN (once):
--    Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
--  It runs as one transaction: if anything fails, nothing is changed.
--  Then run supabase/setup/verify_setup.sql to check the result.
--
--  Built from supabase/migrations/*.sql by supabase/build-setup.sh.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- Stop early if BOUSLA is already installed (running it twice would fail half-way).
do $$
begin
  if to_regclass('public.student_profiles') is not null then
    raise exception 'BOUSLA is already installed in this database (public.student_profiles exists). Nothing was changed.';
  end if;
end $$;
HEAD
  for f in "$HERE"/migrations/*.sql; do
    printf '\n\n-- ▼▼▼ %s ▼▼▼\n\n' "$(basename "$f")"
    cat "$f"
  done
  printf '\n\ncommit;\n'
} > "$OUT"
echo "wrote $OUT"

# One-time upgrade for databases installed before student PINs.
UP="$HERE/setup/upgrade_student_pins.sql"
{
  cat <<'HEAD'
-- ════════════════════════════════════════════════════════════════════════════
--  BOUSLA – UPGRADE: individual student PINs (generated — do not edit by hand)
--
--  For a database that already has BOUSLA installed. Keeps every student,
--  task, point, badge and study session. Nothing is deleted.
--  HOW TO RUN (once): Supabase → SQL Editor → New query → paste → Run
--  (confirm "Run this query" if Supabase shows a warning).
--  It runs as one transaction: if anything fails, nothing is changed.
--
--  Built from supabase/migrations/20261112000000_student_pins.sql.
-- ════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if to_regclass('public.student_profiles') is null then
    raise exception 'BOUSLA is not installed here. Run bousla_full_setup.sql instead. Nothing was changed.';
  end if;
  if to_regclass('public.student_secrets') is not null then
    raise exception 'Student PINs are already installed. Nothing was changed.';
  end if;
end $$;

HEAD
  cat "$HERE/migrations/20261112000000_student_pins.sql"
  cat <<'TAIL'


select 'Student PINs installed ✅ — every student keeps her data and sets a PIN at her next sign-in' as result;

commit;
TAIL
} > "$UP"
echo "wrote $UP"
