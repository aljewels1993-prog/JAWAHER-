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
