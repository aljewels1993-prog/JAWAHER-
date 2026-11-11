-- BOUSLA – check the database after setup (read-only, safe to run any time).
-- Supabase → SQL Editor → paste → Run. Every row should say ✅.

with expected_tables(name) as (values
  ('student_profiles'), ('student_devices'), ('teacher_profiles'), ('app_settings'), ('teacher_login_attempts'),
  ('study_tasks'), ('study_sessions'), ('points_transactions'), ('achievements'), ('student_achievements'), ('notifications')
),
expected_functions(name) as (values
  ('student_login'), ('teacher_login'), ('set_teacher_code'), ('current_student_id'), ('is_teacher'),
  ('start_study_session'), ('complete_study_session'), ('cancel_study_session'), ('set_task_completed'),
  ('ensure_daily_reminder'), ('get_student_stats'), ('get_weekly_report'), ('teacher_list_students'),
  ('teacher_update_student'), ('teacher_delete_student')
)
select 'table ' || e.name as item,
       case when c.oid is null then '❌ missing'
            when not c.relrowsecurity then '❌ RLS is OFF'
            else '✅ exists, RLS on' end as status
from expected_tables e
left join pg_class c on c.relname = e.name and c.relnamespace = 'public'::regnamespace
union all
select 'function ' || e.name,
       case when exists (select 1 from pg_proc p where p.proname = e.name and p.pronamespace = 'public'::regnamespace)
            then '✅ exists' else '❌ missing' end
from expected_functions e
union all
select 'RLS policies', case when count(*) >= 15 then '✅ ' || count(*) || ' policies' else '❌ only ' || count(*) end
from pg_policies where schemaname = 'public'
union all
select 'badges catalogue', case when count(*) = 5 then '✅ 5 badges' else '❌ ' || count(*) || ' badges' end
from public.achievements
union all
select 'teacher code', case when exists (select 1 from public.app_settings where key = 'teacher_code_hash')
                            then '✅ set (default 1993 — change it with set_teacher_code)' else '❌ missing' end
union all
select 'students cannot write points',
       case when has_table_privilege('authenticated', 'public.points_transactions', 'INSERT') then '❌ INSERT is allowed'
            else '✅ read-only for the app' end
union all
select 'anon (signed-out) access',
       case when has_table_privilege('anon', 'public.student_profiles', 'SELECT') then '❌ anon can read profiles'
            else '✅ no access without sign-in' end;
