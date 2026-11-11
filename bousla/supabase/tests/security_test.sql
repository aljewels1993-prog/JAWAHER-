-- BOUSLA database tests: sign-in, data isolation, teacher code, rewards and
-- duplicate prevention. Run with `npm run test:db`. Any failure stops the run.
\set A1 '''aaaaaaaa-0000-0000-0000-000000000001'''
\set A2 '''aaaaaaaa-0000-0000-0000-000000000002'''
\set B  '''bbbbbbbb-0000-0000-0000-000000000003'''
\set T  '''cccccccc-0000-0000-0000-000000000004'''
\set X  '''dddddddd-0000-0000-0000-000000000005'''

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'TEST FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;

-- Anonymous device sessions (what supabase.auth.signInAnonymously creates).
insert into auth.users (id) values (:A1), (:A2), (:B), (:T), (:X);

-- ─── not signed in ──────────────────────────────────────────────────────
set role anon;
do $$ begin
  begin perform * from public.student_profiles; raise exception 'TEST FAILED: anon read profiles';
  exception when insufficient_privilege then raise notice 'ok - anon cannot read profiles'; end;
end $$;
do $$ begin
  begin perform public.student_login('Alia', 5); raise exception 'TEST FAILED: anon login';
  exception when insufficient_privilege then raise notice 'ok - login needs a device session'; end;
end $$;
reset role;

-- ─── student sign-in with name + grade ──────────────────────────────────
select set_config('request.jwt.claim.sub', :A1, false);
set role authenticated;
do $$
declare r jsonb;
begin
  begin perform public.student_login('A', 5); raise exception 'TEST FAILED: 1-letter name';
  exception when invalid_parameter_value then raise notice 'ok - too-short name rejected'; end;
  begin perform public.student_login('Alia Salim', 13); raise exception 'TEST FAILED: grade 13';
  exception when invalid_parameter_value then raise notice 'ok - invalid grade rejected'; end;
  r := public.student_login('  Alia   Salim ', 5, 'ar', 'Asia/Muscat');
  perform pg_temp.check((r->>'created')::boolean, 'first login creates the student');
  perform pg_temp.check(r->'profile'->>'full_name' = 'Alia Salim', 'name is tidied');
  perform pg_temp.check(not (r->'profile' ? 'name_key'), 'internal key not returned');
  perform pg_temp.check(not public.is_teacher(), 'student is not a teacher');
  perform pg_temp.check((select count(*) from public.notifications where kind = 'welcome') = 1, 'welcome notification');
end $$;

do $$ begin
  begin update public.student_profiles set total_points = 9999; raise exception 'TEST FAILED: points edited';
  exception when insufficient_privilege then raise notice 'ok - student cannot edit total_points'; end;
end $$;
do $$ begin
  begin insert into public.points_transactions (student_id, points, reason, ref_key) values (public.current_student_id(), 100, 'daily_bonus', 'x');
        raise exception 'TEST FAILED: ledger insert';
  exception when insufficient_privilege then raise notice 'ok - student cannot write points'; end;
end $$;
do $$ begin
  begin insert into public.teacher_profiles (id) values (auth.uid()); raise exception 'TEST FAILED: self-promotion';
  exception when insufficient_privilege then raise notice 'ok - student cannot make the device a teacher'; end;
end $$;
do $$ begin
  begin perform * from public.app_settings; raise exception 'TEST FAILED: settings readable';
  exception when insufficient_privilege then raise notice 'ok - teacher code hash is not readable'; end;
end $$;
do $$ begin
  begin perform public.set_teacher_code('0000'); raise exception 'TEST FAILED: set code callable';
  exception when insufficient_privilege then raise notice 'ok - only the admin can change the code'; end;
end $$;
do $$ begin
  begin perform public.award_points(public.current_student_id(), 100, 'daily_bonus', 'x'); raise exception 'TEST FAILED: award_points callable';
  exception when insufficient_privilege then raise notice 'ok - award_points is private'; end;
end $$;
do $$ begin
  begin perform * from public.teacher_list_students(null, null); raise exception 'TEST FAILED: student listed students';
  exception when insufficient_privilege then raise notice 'ok - student cannot use the teacher list'; end;
end $$;

update public.student_profiles set language = 'en', custom_subjects = '{Robotics}';
select pg_temp.check((select language from public.student_profiles) = 'en', 'student updates own profile');

-- Tasks
insert into public.study_tasks (subject, title, task_date, priority) values
  ('Mathematics', 'Fractions page 12', (now() at time zone 'Asia/Muscat')::date, 'high'),
  ('English',     'Read chapter 3',    (now() at time zone 'Asia/Muscat')::date, 'medium');
select pg_temp.check((select count(*) from public.study_tasks) = 2, 'student creates tasks');
do $$ begin
  begin update public.study_tasks set completed = true; raise exception 'TEST FAILED: completed edited directly';
  exception when insufficient_privilege then raise notice 'ok - completed flag only via RPC'; end;
end $$;

do $$
declare r jsonb; t1 uuid; t2 uuid;
begin
  select id into t1 from public.study_tasks where subject = 'Mathematics';
  select id into t2 from public.study_tasks where subject = 'English';
  r := public.set_task_completed(t1, true);
  perform pg_temp.check((r->>'points_awarded')::int = 5 and (r->>'bonus_awarded')::int = 0, 'first task +5');
  r := public.set_task_completed(t1, true);
  perform pg_temp.check((r->>'points_awarded')::int = 0, 'repeat click pays nothing');
  perform public.set_task_completed(t1, false);
  r := public.set_task_completed(t1, true);
  perform pg_temp.check((r->>'points_awarded')::int = 0, 'un-complete then complete pays nothing');
  r := public.set_task_completed(t2, true);
  perform pg_temp.check((r->>'points_awarded')::int = 5 and (r->>'bonus_awarded')::int = 20, 'last task of the day +5 and +20 bonus');
  perform pg_temp.check((r->>'total_points')::int = 30, 'total is 30');
  perform public.set_task_completed(t2, false);
  r := public.set_task_completed(t2, true);
  perform pg_temp.check((r->>'bonus_awarded')::int = 0, 'daily bonus paid once');
end $$;

-- Sessions
do $$
declare s public.study_sessions; r jsonb;
begin
  begin perform public.start_study_session(3); raise exception 'TEST FAILED: 3-minute session';
  exception when invalid_parameter_value then raise notice 'ok - too short duration rejected'; end;
  s := public.start_study_session(25, 'Science');
  r := public.complete_study_session(s.id);
  perform pg_temp.check(r->>'status' = 'too_early', 'session cannot finish early');
end $$;
reset role;
update public.study_sessions set started_at = now() - interval '26 minutes' where status = 'active';
set role authenticated;
do $$
declare sid uuid; r jsonb;
begin
  select id into sid from public.study_sessions where status = 'active';
  r := public.complete_study_session(sid);
  perform pg_temp.check(r->>'status' = 'completed' and (r->>'points_awarded')::int = 10, 'completed session +10');
  r := public.complete_study_session(sid);
  perform pg_temp.check(r->>'status' = 'already_completed' and (r->>'points_awarded')::int = 0, 'session pays once');
  perform pg_temp.check((select total_points from public.student_profiles) = 40, 'total is 40');
end $$;
reset role;

-- 4 earlier study days → 5-day streak with today's session.
insert into public.study_sessions (student_id, subject, planned_minutes, status, started_at, completed_at)
select (select id from public.student_profiles where name_key = 'alia salim'), 'Arabic', 30, 'completed',
       now() - (d || ' days')::interval - interval '31 minutes', now() - (d || ' days')::interval
from generate_series(1, 4) d;

select set_config('request.jwt.claim.sub', :A1, false);
set role authenticated;
do $$
declare s public.study_sessions; r jsonb;
begin
  s := public.start_study_session(10);
  reset role;
  update public.study_sessions set started_at = now() - interval '11 minutes' where id = s.id;
  set role authenticated;
  r := public.complete_study_session(s.id);
  perform pg_temp.check(r->'new_achievements' ? 'study_star', 'Study Star unlocked');
  perform pg_temp.check(r->'new_achievements' ? 'weekly_champion', 'Weekly Champion after a 5-day streak');
  perform pg_temp.check((public.get_student_stats()->>'current_streak')::int = 5, 'current streak = 5');
end $$;

-- Reminders
insert into public.study_tasks (subject, title, task_type, task_date, start_time, reminder_minutes)
values ('Science', 'Unit test', 'test', (now() at time zone 'Asia/Muscat')::date + 2, '10:00', 60);
update public.study_tasks set start_time = '11:00' where title = 'Unit test';
select pg_temp.check((select count(*) from public.notifications where kind = 'test_reminder') = 1, 'reminder rescheduled, no duplicates');
select pg_temp.check(
  (select to_char(scheduled_for at time zone 'Asia/Muscat', 'HH24:MI') from public.notifications where kind = 'test_reminder') = '10:00',
  'reminder = start time - 60 min');
-- A planned task from 3 days ago left undone (for the teacher's follow-up view).
insert into public.study_tasks (subject, title, task_date) values ('Arabic', 'Old homework', (now() at time zone 'Asia/Muscat')::date - 3);
reset role;

-- ─── same student on a second device: same name + grade → same data ─────
select set_config('request.jwt.claim.sub', :A2, false);
set role authenticated;
do $$
declare r jsonb;
begin
  r := public.student_login('alia salim', 5);
  perform pg_temp.check(not (r->>'created')::boolean, 'returning student is recognised (any letter case/spacing)');
  perform pg_temp.check((select count(*) from public.study_tasks) = 4, 'second device sees the same tasks');
  r := public.student_login('Alia Salim', 6);
  perform pg_temp.check((r->>'created')::boolean, 'same name in another grade is a different student');
  perform pg_temp.check((select count(*) from public.study_tasks) = 0, 'and does not see the first student''s tasks');
end $$;
reset role;

-- ─── student B: isolation ───────────────────────────────────────────────
select set_config('request.jwt.claim.sub', :B, false);
set role authenticated;
select public.student_login('Badr Said', 5);
select pg_temp.check((select count(*) from public.student_profiles) = 1, 'B sees only own profile');
select pg_temp.check((select count(*) from public.study_tasks) = 0, 'B cannot see A tasks');
select pg_temp.check((select count(*) from public.study_sessions) = 0, 'B cannot see A sessions');
select pg_temp.check((select count(*) from public.points_transactions) = 0, 'B cannot see A points');
select pg_temp.check((select count(*) from public.notifications where kind <> 'welcome') = 0, 'B cannot see A notifications');
update public.study_tasks set title = 'hacked';
delete from public.study_tasks;
do $$ begin
  begin perform public.get_weekly_report(current_date, (select id from public.student_profiles limit 0));
  exception when insufficient_privilege then null; end;
  begin perform public.set_task_completed('00000000-0000-0000-0000-000000000000', true); raise exception 'TEST FAILED';
  exception when no_data_found then raise notice 'ok - cannot complete a task that is not yours'; end;
end $$;
reset role;
select pg_temp.check((select count(*) from public.study_tasks where title = 'hacked') = 0, 'B cannot edit A tasks');
select pg_temp.check((select count(*) from public.study_tasks s join public.student_profiles p on p.id = s.student_id
                      where p.name_key = 'alia salim' and p.grade = 5) = 4, 'B cannot delete A tasks');
do $$
declare v_alia uuid := (select id from public.student_profiles where name_key = 'alia salim' and grade = 5);
begin
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000003', false);
  set local role authenticated;
  begin perform public.get_weekly_report(current_date, v_alia); raise exception 'TEST FAILED: read other report';
  exception when insufficient_privilege then raise notice 'ok - student cannot read another report'; end;
end $$;
reset role;

-- ─── teacher code ───────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', :X, false);
set role authenticated;
select pg_temp.check(not public.teacher_login('0000'), 'wrong code refused');
select pg_temp.check(not public.is_teacher(), 'wrong code gives no teacher access');
do $$
declare i int;
begin
  for i in 1..4 loop perform public.teacher_login('9999'); end loop;
  begin perform public.teacher_login('1993'); raise exception 'TEST FAILED: no throttle';
  exception when insufficient_privilege then raise notice 'ok - device blocked after 5 wrong codes (even with the right one)'; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', :T, false);
set role authenticated;
select pg_temp.check(public.teacher_login('1993'), 'teacher code 1993 accepted');
select pg_temp.check(public.is_teacher(), 'teacher role recognised');
select pg_temp.check((select count(*) from public.teacher_list_students(null, null)) = 3, 'teacher lists all students');
select pg_temp.check((select count(*) from public.teacher_list_students(null, 5)) = 2, 'teacher filters by grade');
select pg_temp.check((select count(*) from public.teacher_list_students('badr', null)) = 1, 'teacher searches by name');
select pg_temp.check((select week_minutes from public.teacher_list_students('alia', 5)) = 25 + 10 + 4 * 30, 'usage: study minutes in the last 7 days');
select pg_temp.check((select active_days_week from public.teacher_list_students('alia', 5)) = 5, 'usage: active days this week');
select pg_temp.check((select tasks_due from public.teacher_list_students('alia', 5)) = 3
                     and (select tasks_due_done from public.teacher_list_students('alia', 5)) = 2, 'commitment: 2 of 3 due tasks done');
select pg_temp.check((select overdue_tasks from public.teacher_list_students('alia', 5)) = 1, 'commitment: 1 overdue task');
select pg_temp.check((public.get_student_stats((select id from public.teacher_list_students('alia', 5)))->>'total_points')::int > 0, 'teacher reads student stats');
update public.study_tasks set title = 'teacher edit';
select pg_temp.check((select count(*) from public.study_tasks where title = 'teacher edit') = 0, 'teacher cannot edit student tasks');
select pg_temp.check((select count(*) from public.notifications) = 0, 'teacher cannot read student notifications');
do $$ begin
  begin update public.student_profiles set total_points = 1; raise exception 'TEST FAILED: teacher edited points';
  exception when insufficient_privilege then raise notice 'ok - teacher cannot edit points'; end;
end $$;
reset role;

-- Changing the code signs out every teacher device.
select public.set_teacher_code('2468');
select set_config('request.jwt.claim.sub', :T, false);
set role authenticated;
select pg_temp.check(not public.is_teacher(), 'new code signs teachers out');
select pg_temp.check(not public.teacher_login('1993'), 'old code no longer works');
select pg_temp.check(public.teacher_login('2468'), 'new code works');
reset role;

-- ─── teacher manages students (migration 20261111) ──────────────────────
select set_config('request.jwt.claim.sub', :B, false);
set role authenticated;
do $$ begin
  begin perform public.teacher_delete_student(public.current_student_id()); raise exception 'TEST FAILED: student deleted';
  exception when insufficient_privilege then raise notice 'ok - a student cannot delete accounts'; end;
  begin perform public.teacher_update_student(public.current_student_id(), 'Hacker', 1); raise exception 'TEST FAILED: student renamed';
  exception when insufficient_privilege then raise notice 'ok - a student cannot use teacher editing'; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', :T, false);
set role authenticated;
do $$
declare v_badr uuid := (select id from public.teacher_list_students('badr', null));
        v_alia uuid := (select id from public.teacher_list_students('alia', 5));
        r public.student_profiles;
begin
  r := public.teacher_update_student(v_badr, '  Badr  Said Al-Harthy ', 6);
  perform pg_temp.check(r.full_name = 'Badr Said Al-Harthy' and r.grade = 6, 'teacher corrects a student name and grade');
  begin perform public.teacher_update_student(v_badr, 'alia salim', 5); raise exception 'TEST FAILED: duplicate identity';
  exception when unique_violation then raise notice 'ok - cannot give two students the same name + grade'; end;
  perform public.teacher_delete_student(v_alia);
  perform pg_temp.check(not exists (select 1 from public.teacher_list_students('alia', 5)), 'teacher deletes a student');
end $$;
reset role;
select pg_temp.check(not exists (select 1 from public.study_tasks t left join public.student_profiles p on p.id = t.student_id where p.id is null),
                     'deleting a student removes their tasks');
select pg_temp.check(not exists (select 1 from public.student_devices d left join public.student_profiles p on p.id = d.student_id where p.id is null),
                     'and unlinks their devices');
-- Badr signs in with the corrected name on his device: same account.
select set_config('request.jwt.claim.sub', :B, false);
set role authenticated;
select pg_temp.check(not (public.student_login('Badr Said Al-Harthy', 6)->>'created')::boolean, 'student signs in with the corrected name');
reset role;
