-- BOUSLA database tests: data isolation, roles, rewards and duplicate prevention.
-- Run with `npm run test:db`. Every check raises an exception on failure.
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set T '''cccccccc-0000-0000-0000-000000000003'''

-- Small assertion helper.
create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'TEST FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;

-- ─── sign-ups (as the auth service) ──────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  (:A, 'alia@example.com',  '{"full_name":"Alia Salim","username":"alia","language":"ar","timezone":"Asia/Muscat"}'),
  (:B, 'badr@example.com',  '{"full_name":"Badr Said","username":"ALIA","language":"en","timezone":"Not/AZone","role":"teacher"}'),
  (:T, 'teacher@example.com','{"full_name":"Ms. Teacher","username":"teacher1"}');

select pg_temp.check((select count(*) from public.student_profiles) = 3, 'every sign-up gets a student profile');
select pg_temp.check((select username from public.student_profiles where id = :B) <> 'alia', 'duplicate username is made unique');
select pg_temp.check((select timezone from public.student_profiles where id = :B) = 'Asia/Muscat', 'invalid timezone falls back to Asia/Muscat');
select pg_temp.check(not exists (select 1 from public.teacher_profiles), 'role in sign-up metadata is ignored');
select pg_temp.check((select count(*) from public.notifications where kind = 'welcome') = 3, 'welcome notification created');

-- Admin promotes the teacher (SQL editor).
select public.promote_to_teacher('teacher@example.com', 'Al Noor School');
select pg_temp.check(exists (select 1 from public.teacher_profiles where id = :T), 'teacher promoted');
select pg_temp.check(not exists (select 1 from public.student_profiles where id = :T), 'teacher no longer listed as a student');

-- ─── anon ────────────────────────────────────────────────────────────────
set role anon;
select pg_temp.check(public.username_available('newgirl'), 'anon can check a free username');
select pg_temp.check(not public.username_available('alia'), 'taken username reported');
do $$ begin
  begin perform * from public.student_profiles; raise exception 'TEST FAILED: anon read profiles';
  exception when insufficient_privilege then raise notice 'ok - anon cannot read profiles'; end;
end $$;
reset role;

-- ─── student A ───────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', :A, false);
set role authenticated;

select pg_temp.check((select count(*) from public.student_profiles) = 1, 'student sees only own profile');
select pg_temp.check(not public.is_teacher(), 'student is not a teacher');

do $$ begin
  begin update public.student_profiles set total_points = 9999; raise exception 'TEST FAILED: points edited';
  exception when insufficient_privilege then raise notice 'ok - student cannot edit total_points'; end;
end $$;
do $$ begin
  begin insert into public.points_transactions (student_id, points, reason, ref_key)
        values (auth.uid(), 100, 'daily_bonus', 'x'); raise exception 'TEST FAILED: ledger insert';
  exception when insufficient_privilege then raise notice 'ok - student cannot write points'; end;
end $$;
do $$ begin
  begin insert into public.teacher_profiles (id, full_name) values (auth.uid(), 'Hacker'); raise exception 'TEST FAILED: self-promotion';
  exception when insufficient_privilege then raise notice 'ok - student cannot make themself a teacher'; end;
end $$;
do $$ begin
  begin perform public.award_points(auth.uid(), 100, 'daily_bonus', 'x'); raise exception 'TEST FAILED: award_points callable';
  exception when insufficient_privilege then raise notice 'ok - award_points is private'; end;
end $$;
do $$ begin
  begin perform public.promote_to_teacher('alia@example.com'); raise exception 'TEST FAILED: promote callable';
  exception when insufficient_privilege then raise notice 'ok - promote_to_teacher is private'; end;
end $$;
do $$ begin
  begin perform * from public.teacher_list_students(null); raise exception 'TEST FAILED: student listed students';
  exception when insufficient_privilege then raise notice 'ok - student cannot use teacher list'; end;
end $$;
do $$ begin
  begin perform public.get_weekly_report(current_date, 'bbbbbbbb-0000-0000-0000-000000000002');
        raise exception 'TEST FAILED: read other report';
  exception when insufficient_privilege then raise notice 'ok - student cannot read another report'; end;
end $$;

-- Allowed profile edits.
update public.student_profiles set language = 'en', custom_subjects = '{Robotics}' where id = auth.uid();
select pg_temp.check((select language from public.student_profiles) = 'en', 'student updates own language');

-- Tasks
insert into public.study_tasks (subject, title, task_date, priority) values
  ('Mathematics', 'Fractions page 12', (now() at time zone 'Asia/Muscat')::date, 'high'),
  ('English',     'Read chapter 3',    (now() at time zone 'Asia/Muscat')::date, 'medium');
select pg_temp.check((select count(*) from public.study_tasks) = 2, 'student creates tasks');

do $$ begin
  begin update public.study_tasks set completed = true; raise exception 'TEST FAILED: completed edited directly';
  exception when insufficient_privilege then raise notice 'ok - completed flag only via RPC'; end;
end $$;
do $$ begin
  begin insert into public.study_tasks (student_id, subject, title, task_date)
        values ('bbbbbbbb-0000-0000-0000-000000000002', 'Math', 'x', current_date);
        raise exception 'TEST FAILED: task for another student';
  exception when insufficient_privilege then raise notice 'ok - cannot create a task for someone else'; end;
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
  begin perform public.start_study_session(3); raise exception 'TEST FAILED: 3-minute session accepted';
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

-- Only one active session; starting a new one cancels the old.
do $$
declare s1 public.study_sessions; s2 public.study_sessions;
begin
  s1 := public.start_study_session(30);
  s2 := public.start_study_session(45);
  perform pg_temp.check((select status from public.study_sessions where id = s1.id) = 'cancelled', 'old active session cancelled');
  perform public.cancel_study_session(s2.id);
end $$;
reset role;

-- Simulate 4 more completed sessions on consecutive previous days (as the server would have recorded them).
insert into public.study_sessions (student_id, subject, planned_minutes, status, started_at, completed_at)
select :A, 'Arabic', 30, 'completed', now() - (d || ' days')::interval - interval '31 minutes', now() - (d || ' days')::interval
from generate_series(1, 4) d;

-- Badges are unlocked by the next rewarded action.
select set_config('request.jwt.claim.sub', :A, false);
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
  perform pg_temp.check(r->'new_achievements' ? 'weekly_champion', 'Weekly Champion unlocked after 5-day streak');
  perform pg_temp.check((select count(*) from public.notifications where kind = 'achievement') = 2, 'achievement notifications');
  perform pg_temp.check((public.get_student_stats()->>'current_streak')::int = 5, 'current streak = 5');
end $$;

-- Reminder scheduling
insert into public.study_tasks (subject, title, task_type, task_date, start_time, reminder_minutes)
values ('Science', 'Unit test', 'test', (now() at time zone 'Asia/Muscat')::date + 2, '10:00', 60);
select pg_temp.check((select count(*) from public.notifications where kind = 'test_reminder') = 1, 'test reminder scheduled');
update public.study_tasks set start_time = '11:00' where title = 'Unit test';
select pg_temp.check((select count(*) from public.notifications where kind = 'test_reminder') = 1, 'editing a task reschedules (no duplicates)');
select pg_temp.check(
  (select to_char(scheduled_for at time zone 'Asia/Muscat', 'HH24:MI') from public.notifications where kind = 'test_reminder') = '10:00',
  'reminder time = start time - 60 min in the student timezone');

-- Notifications: mark read OK, edit content not OK.
update public.notifications set read_at = now() where kind = 'welcome';
select pg_temp.check((select read_at is not null from public.notifications where kind = 'welcome'), 'mark notification read');
do $$ begin
  begin update public.notifications set kind = 'achievement'; raise exception 'TEST FAILED: notification edited';
  exception when insufficient_privilege then raise notice 'ok - notification content is read-only'; end;
end $$;
select public.ensure_daily_reminder();
select public.ensure_daily_reminder();
select pg_temp.check((select count(*) from public.notifications where kind = 'daily_reminder') = 1, 'daily reminder once per day');

-- Weekly report
do $$
declare r jsonb; ws date := (now() at time zone 'Asia/Muscat')::date - extract(dow from (now() at time zone 'Asia/Muscat'))::int;
begin
  r := public.get_weekly_report(ws);
  perform pg_temp.check(jsonb_array_length(r->'days') = 7, 'weekly report has 7 days');
  perform pg_temp.check((r->>'tasks_completed')::int = 2, 'weekly report counts completed tasks');
  perform pg_temp.check((r->>'points_earned')::int > 0, 'weekly report counts points');
end $$;

-- Daily cap on paid tasks (20/day).
do $$
declare i int; tid uuid; paid int := 0; r jsonb;
begin
  for i in 1..22 loop
    insert into public.study_tasks (subject, title, task_date) values ('Other', 'cap ' || i, current_date + 5) returning id into tid;
    r := public.set_task_completed(tid, true);
    paid := paid + (r->>'points_awarded')::int;
  end loop;
  perform pg_temp.check(paid = 18 * 5, 'only 20 paid tasks per day (2 already paid today)');
end $$;
reset role;

-- ─── student B: isolation ───────────────────────────────────────────────
select set_config('request.jwt.claim.sub', :B, false);
set role authenticated;
select pg_temp.check((select count(*) from public.study_tasks) = 0, 'B cannot see A tasks');
select pg_temp.check((select count(*) from public.study_sessions) = 0, 'B cannot see A sessions');
select pg_temp.check((select count(*) from public.points_transactions) = 0, 'B cannot see A points');
select pg_temp.check((select count(*) from public.notifications where kind <> 'welcome') = 0, 'B cannot see A notifications');
update public.study_tasks set title = 'hacked';
delete from public.study_tasks;
do $$
declare sid uuid := (select id from public.study_sessions limit 1);
begin
  begin perform public.set_task_completed('00000000-0000-0000-0000-000000000000', true);
        raise exception 'TEST FAILED: completed unknown task';
  exception when no_data_found then raise notice 'ok - cannot complete a task that is not yours'; end;
end $$;
reset role;
select pg_temp.check((select count(*) from public.study_tasks where title = 'hacked') = 0, 'B cannot edit A tasks');
select pg_temp.check((select count(*) from public.study_tasks where student_id = :A) = 25, 'B cannot delete A tasks');

do $$
declare sid uuid := (select id from public.study_sessions where student_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'completed' limit 1);
begin
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
  set local role authenticated;
  begin perform public.complete_study_session(sid); raise exception 'TEST FAILED: completed other session';
  exception when no_data_found then raise notice 'ok - cannot complete another student session'; end;
end $$;
reset role;

-- ─── teacher ────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', :T, false);
set role authenticated;
select pg_temp.check(public.is_teacher(), 'teacher role recognised');
select pg_temp.check((select count(*) from public.teacher_list_students(null)) = 2, 'teacher lists all students');
select pg_temp.check((select count(*) from public.teacher_list_students('badr')) = 1, 'teacher searches by name');
select pg_temp.check((select count(*) from public.study_tasks) = 25, 'teacher reads student tasks');
select pg_temp.check((public.get_weekly_report(current_date - 7, 'aaaaaaaa-0000-0000-0000-000000000001')->>'week_start') is not null,
                     'teacher reads a student weekly report');
select pg_temp.check((public.get_student_stats('aaaaaaaa-0000-0000-0000-000000000001')->>'total_points')::int > 0, 'teacher reads student stats');
update public.study_tasks set title = 'teacher edit';
select pg_temp.check((select count(*) from public.study_tasks where title = 'teacher edit') = 0, 'teacher cannot edit student tasks');
select pg_temp.check((select count(*) from public.notifications where user_id <> auth.uid()) = 0, 'teacher cannot read student notifications');
do $$ begin
  begin update public.student_profiles set total_points = 1; raise exception 'TEST FAILED: teacher edited points';
  exception when insufficient_privilege then raise notice 'ok - teacher cannot edit points'; end;
end $$;
reset role;
