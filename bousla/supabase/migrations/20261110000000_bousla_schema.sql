-- ════════════════════════════════════════════════════════════════════════════
--  BOUSLA – بوصلة  ·  database schema, security and reward logic
--
--  Run once in the Supabase SQL editor (or `supabase db push`).
--  Requires: Authentication → Sign In / Providers → "Allow anonymous sign-ins".
--
--  Sign-in model (simple, no e-mail):
--    • Each device signs in to Supabase anonymously (a private session).
--    • A student then calls student_login(name, grade): the device is linked
--      to that student's profile (created the first time).
--    • A teacher calls teacher_login(code): the code is checked on the
--      server against a bcrypt hash, with attempt throttling.
--  Everything that affects points, badges or roles happens inside
--  SECURITY DEFINER functions below. The browser can only read its own rows
--  (Row Level Security), edit its own tasks (not their completed flag) and
--  call the whitelisted functions. Points are never accepted from the client.
-- ════════════════════════════════════════════════════════════════════════════

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ─── helpers ────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

/** "  Sara   Ahmed " → "sara ahmed" — how names are matched at sign-in. */
create or replace function public.name_key(p_name text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

-- ─── 1. student_profiles ───────────────────────────────────────────────────
create table public.student_profiles (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null check (char_length(btrim(full_name)) between 2 and 80),
  name_key        text not null,
  grade           integer not null check (grade between 1 and 12),
  language        text not null default 'ar' check (language in ('ar', 'en')),
  timezone        text not null default 'Asia/Muscat',
  custom_subjects text[] not null default '{}' check (cardinality(custom_subjects) <= 20),
  total_points    integer not null default 0 check (total_points >= 0),
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- Name + grade identify a student.
create unique index student_profiles_identity on public.student_profiles (name_key, grade);
create index student_profiles_grade_idx on public.student_profiles (grade);

create or replace function public.validate_student_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    new.timezone := 'Asia/Muscat';
  end if;
  new.full_name := regexp_replace(btrim(new.full_name), '\s+', ' ', 'g');
  new.name_key  := public.name_key(new.full_name);
  if exists (select 1 from unnest(new.custom_subjects) s where char_length(s) not between 1 and 40) then
    raise exception 'invalid_custom_subject';
  end if;
  return new;
end $$;

create trigger student_profiles_validate before insert or update on public.student_profiles
  for each row execute function public.validate_student_profile();
create trigger student_profiles_touch before update on public.student_profiles
  for each row execute function public.touch_updated_at();

/** Which student this signed-in device belongs to. */
create table public.student_devices (
  auth_uid   uuid primary key references auth.users (id) on delete cascade,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  linked_at  timestamptz not null default now()
);
create index student_devices_student_idx on public.student_devices (student_id);

create or replace function public.current_student_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select student_id from public.student_devices where auth_uid = auth.uid();
$$;

-- ─── 8. teacher_profiles (one row per signed-in teacher device) ───────────
create table public.teacher_profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  language   text not null default 'ar' check (language in ('ar', 'en')),
  created_at timestamptz not null default now()
);

/** True when the signed-in device entered the teacher code. */
create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.teacher_profiles where id = auth.uid());
$$;

-- Private settings (teacher code hash). No client access at all.
create table public.app_settings (
  key   text primary key,
  value text not null
);
create table public.teacher_login_attempts (
  id         bigint generated always as identity primary key,
  auth_uid   uuid,
  ok         boolean not null,
  created_at timestamptz not null default now()
);
create index teacher_login_attempts_time_idx on public.teacher_login_attempts (created_at);

-- No known default teacher code: a random, unguessable code is set at install.
-- Set the real code after installing (setup/change_teacher_code_template.sql or:)
--   select public.set_teacher_code('your-new-code');
insert into public.app_settings (key, value)
values ('teacher_code_hash', extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf')));

-- ─── 2. study_tasks ────────────────────────────────────────────────────────
create table public.study_tasks (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null default public.current_student_id()
                     references public.student_profiles (id) on delete cascade,
  subject          text not null check (char_length(btrim(subject)) between 1 and 40),
  title            text not null check (char_length(btrim(title)) between 1 and 120),
  description      text check (char_length(description) <= 1000),
  task_type        text not null default 'homework' check (task_type in ('homework', 'study', 'test')),
  task_date        date not null,
  start_time       time,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 240),
  priority         text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  reminder_minutes integer check (reminder_minutes in (0, 5, 10, 15, 30, 60, 120, 1440)),
  completed        boolean not null default false,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index study_tasks_student_date_idx on public.study_tasks (student_id, task_date);
create index study_tasks_student_completed_idx on public.study_tasks (student_id, completed_at) where completed;
create trigger study_tasks_touch before update on public.study_tasks
  for each row execute function public.touch_updated_at();

-- ─── 3. study_sessions ─────────────────────────────────────────────────────
create table public.study_sessions (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.student_profiles (id) on delete cascade,
  subject         text check (char_length(subject) <= 40),
  task_id         uuid references public.study_tasks (id) on delete set null,
  planned_minutes integer not null check (planned_minutes between 10 and 120),
  status          text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);
create unique index study_sessions_one_active on public.study_sessions (student_id) where status = 'active';
create index study_sessions_student_completed_idx on public.study_sessions (student_id, completed_at) where status = 'completed';

-- ─── 4. points_transactions (append-only ledger) ──────────────────────────
create table public.points_transactions (
  id         bigint generated always as identity primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  points     integer not null check (points between 1 and 100),
  reason     text not null check (reason in ('study_session', 'task_completed', 'daily_bonus')),
  ref_key    text not null,
  created_at timestamptz not null default now(),
  constraint points_transactions_once unique (student_id, reason, ref_key)
);
create index points_transactions_student_time_idx on public.points_transactions (student_id, created_at);

-- ─── 5. achievements (catalogue — data-driven criteria) ───────────────────
create table public.achievements (
  id             text primary key,
  icon           text not null,
  name_en        text not null,
  name_ar        text not null,
  description_en text not null,
  description_ar text not null,
  criteria_type  text not null check (criteria_type in
                   ('sessions_completed', 'study_minutes', 'tasks_completed', 'total_points', 'study_streak_days')),
  threshold      integer not null check (threshold > 0),
  sort_order     integer not null default 0
);

insert into public.achievements (id, icon, name_en, name_ar, description_en, description_ar, criteria_type, threshold, sort_order) values
  ('study_star',      '⭐', 'Study Star',      'نجمة المذاكرة', 'Complete 3 study sessions.',     'أكملي 3 جلسات مذاكرة.',    'sessions_completed', 3,   1),
  ('time_master',     '⏰', 'Time Master',     'سيّدة الوقت',   'Study for a total of 10 hours.', 'ذاكري ما مجموعه 10 ساعات.', 'study_minutes',      600, 2),
  ('reading_hero',    '📖', 'Reading Hero',    'بطلة القراءة',  'Complete 15 planned tasks.',     'أنجزي 15 مهمة من خطتك.',    'tasks_completed',    15,  3),
  ('super_achiever',  '🏆', 'Super Achiever',  'المتفوقة',      'Collect 500 points.',            'اجمعي 500 نقطة.',           'total_points',       500, 4),
  ('weekly_champion', '👑', 'Weekly Champion', 'بطلة الأسبوع',  'Study 5 days in a row.',         'ذاكري 5 أيام متتالية.',     'study_streak_days',  5,   5);

-- ─── 6. student_achievements ───────────────────────────────────────────────
create table public.student_achievements (
  student_id     uuid not null references public.student_profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  primary key (student_id, achievement_id)
);
create index student_achievements_time_idx on public.student_achievements (student_id, unlocked_at);

-- ─── 7. notifications ──────────────────────────────────────────────────────
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.student_profiles (id) on delete cascade,
  kind          text not null check (kind in
                  ('welcome', 'task_reminder', 'homework_reminder', 'test_reminder', 'daily_reminder',
                   'session_complete', 'daily_bonus', 'achievement')),
  data          jsonb not null default '{}'::jsonb,
  task_id       uuid references public.study_tasks (id) on delete cascade,
  scheduled_for timestamptz not null default now(),
  read_at       timestamptz,
  dedupe_key    text,
  created_at    timestamptz not null default now(),
  constraint notifications_dedupe unique (student_id, dedupe_key)
);
create index notifications_student_time_idx on public.notifications (student_id, scheduled_for desc);

-- ════════════════════════════════════════════════════════════════════════════
--  Row Level Security
-- ════════════════════════════════════════════════════════════════════════════
alter table public.student_profiles       enable row level security;
alter table public.student_devices        enable row level security;
alter table public.teacher_profiles       enable row level security;
alter table public.app_settings           enable row level security;
alter table public.teacher_login_attempts enable row level security;
alter table public.study_tasks            enable row level security;
alter table public.study_sessions         enable row level security;
alter table public.points_transactions    enable row level security;
alter table public.achievements           enable row level security;
alter table public.student_achievements   enable row level security;
alter table public.notifications          enable row level security;

revoke all on public.student_profiles, public.student_devices, public.teacher_profiles, public.app_settings,
              public.teacher_login_attempts, public.study_tasks, public.study_sessions, public.points_transactions,
              public.achievements, public.student_achievements, public.notifications
  from anon, authenticated;

-- student_profiles: read own (teachers read all); update only safe columns.
grant select on public.student_profiles to authenticated;
grant update (full_name, grade, language, timezone, custom_subjects) on public.student_profiles to authenticated;
create policy "read own profile or teacher" on public.student_profiles
  for select to authenticated using (id = public.current_student_id() or public.is_teacher());
create policy "update own profile" on public.student_profiles
  for update to authenticated using (id = public.current_student_id()) with check (id = public.current_student_id());

-- teacher_profiles: a teacher device reads/updates only its own language.
grant select on public.teacher_profiles to authenticated;
grant update (language) on public.teacher_profiles to authenticated;
create policy "teacher reads own row" on public.teacher_profiles
  for select to authenticated using (id = auth.uid());
create policy "teacher updates own row" on public.teacher_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- student_devices, app_settings, teacher_login_attempts: no client access (no grants).

-- study_tasks
grant select, delete on public.study_tasks to authenticated;
grant insert (subject, title, description, task_type, task_date, start_time, duration_minutes, priority, reminder_minutes)
  on public.study_tasks to authenticated;
grant update (subject, title, description, task_type, task_date, start_time, duration_minutes, priority, reminder_minutes)
  on public.study_tasks to authenticated;
create policy "read own tasks or teacher" on public.study_tasks
  for select to authenticated using (student_id = public.current_student_id() or public.is_teacher());
create policy "create own tasks" on public.study_tasks
  for insert to authenticated with check (student_id = public.current_student_id());
create policy "edit own tasks" on public.study_tasks
  for update to authenticated using (student_id = public.current_student_id()) with check (student_id = public.current_student_id());
create policy "delete own tasks" on public.study_tasks
  for delete to authenticated using (student_id = public.current_student_id());

grant select on public.study_sessions to authenticated;
create policy "read own sessions or teacher" on public.study_sessions
  for select to authenticated using (student_id = public.current_student_id() or public.is_teacher());

grant select on public.points_transactions to authenticated;
create policy "read own points or teacher" on public.points_transactions
  for select to authenticated using (student_id = public.current_student_id() or public.is_teacher());

grant select on public.achievements to authenticated;
create policy "read achievements" on public.achievements for select to authenticated using (true);

grant select on public.student_achievements to authenticated;
create policy "read own badges or teacher" on public.student_achievements
  for select to authenticated using (student_id = public.current_student_id() or public.is_teacher());

grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "read own notifications" on public.notifications
  for select to authenticated using (student_id = public.current_student_id());
create policy "mark own notifications" on public.notifications
  for update to authenticated using (student_id = public.current_student_id()) with check (student_id = public.current_student_id());
create policy "delete own notifications" on public.notifications
  for delete to authenticated using (student_id = public.current_student_id());

-- ════════════════════════════════════════════════════════════════════════════
--  Sign-in
-- ════════════════════════════════════════════════════════════════════════════

/** Student sign-in with name + grade. Creates the profile the first time and
    links this device to it. Returns { created, profile }. */
create or replace function public.student_login(p_name text, p_grade integer, p_language text default 'ar', p_timezone text default 'Asia/Muscat')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_name    text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_profile public.student_profiles;
  v_created boolean := false;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if p_grade is null or p_grade not between 1 and 12 then raise exception 'invalid_grade' using errcode = '22023'; end if;

  select * into v_profile from public.student_profiles where name_key = public.name_key(v_name) and grade = p_grade;
  if not found then
    insert into public.student_profiles (full_name, grade, language, timezone)
    values (v_name, p_grade, case when p_language in ('ar', 'en') then p_language else 'ar' end, coalesce(p_timezone, 'Asia/Muscat'))
    on conflict (name_key, grade) do nothing
    returning * into v_profile;
    if v_profile.id is null then
      select * into v_profile from public.student_profiles where name_key = public.name_key(v_name) and grade = p_grade;
    else
      v_created := true;
      insert into public.notifications (student_id, kind, data, dedupe_key)
      values (v_profile.id, 'welcome', jsonb_build_object('name', v_name), 'welcome');
    end if;
  end if;

  delete from public.teacher_profiles where id = v_uid;
  insert into public.student_devices (auth_uid, student_id) values (v_uid, v_profile.id)
  on conflict (auth_uid) do update set student_id = excluded.student_id, linked_at = now();
  update public.student_profiles set last_seen_at = now() where id = v_profile.id returning * into v_profile;
  return jsonb_build_object('created', v_created, 'profile', to_jsonb(v_profile) - 'name_key');
end $$;

/** Teacher sign-in with the shared code. Throttled: 5 wrong codes per device
    and 30 in total per 15 minutes. */
create or replace function public.teacher_login(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_hash text;
  v_ok   boolean;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if (select count(*) from public.teacher_login_attempts where not ok and created_at > now() - interval '15 minutes') >= 30
     or (select count(*) from public.teacher_login_attempts where not ok and auth_uid = v_uid and created_at > now() - interval '15 minutes') >= 5 then
    raise exception 'too_many_attempts' using errcode = '42501';
  end if;
  select value into v_hash from public.app_settings where key = 'teacher_code_hash';
  v_ok := v_hash is not null and extensions.crypt(coalesce(p_code, ''), v_hash) = v_hash;
  insert into public.teacher_login_attempts (auth_uid, ok) values (v_uid, v_ok);
  if v_ok then
    delete from public.student_devices where auth_uid = v_uid;
    insert into public.teacher_profiles (id) values (v_uid) on conflict (id) do nothing;
  end if;
  return v_ok;
end $$;

/** ADMIN ONLY (SQL editor). Changes the teacher code and signs out every teacher device. */
create or replace function public.set_teacher_code(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if char_length(coalesce(p_code, '')) < 4 then raise exception 'Code must have at least 4 characters'; end if;
  insert into public.app_settings (key, value) values ('teacher_code_hash', extensions.crypt(p_code, extensions.gen_salt('bf')))
  on conflict (key) do update set value = excluded.value;
  delete from public.teacher_profiles;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
--  Reward engine (internal — not callable by clients)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.student_timezone(p_student uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select timezone from public.student_profiles where id = p_student), 'Asia/Muscat');
$$;

create or replace function public.award_points(p_student uuid, p_points integer, p_reason text, p_ref text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  insert into public.points_transactions (student_id, points, reason, ref_key)
  values (p_student, p_points, p_reason, p_ref)
  on conflict on constraint points_transactions_once do nothing
  returning id into v_id;
  if v_id is null then return 0; end if;
  update public.student_profiles set total_points = total_points + p_points where id = p_student;
  return p_points;
end $$;

create or replace function public.study_streaks(p_student uuid)
returns table (best_days integer, current_days integer) language sql stable security definer set search_path = '' as $$
  with tz as (select public.student_timezone(p_student) as zone),
  days as (
    select distinct (s.completed_at at time zone (select zone from tz))::date as day
    from public.study_sessions s
    where s.student_id = p_student and s.status = 'completed'
  ),
  runs as (select day, day - (row_number() over (order by day))::integer as grp from days),
  grouped as (select max(day) as last_day, count(*)::integer as len from runs group by grp),
  today as (select (now() at time zone (select zone from tz))::date as d)
  select
    coalesce((select max(len) from grouped), 0),
    coalesce((select len from grouped where last_day >= (select d from today) - 1 order by last_day desc limit 1), 0);
$$;

create or replace function public.check_achievements(p_student uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  v_sessions integer; v_minutes integer; v_tasks integer; v_points integer; v_streak integer;
  v_new text[] := '{}';
  a record;
  v_value integer;
begin
  select count(*), coalesce(sum(planned_minutes), 0) into v_sessions, v_minutes
    from public.study_sessions where student_id = p_student and status = 'completed';
  select count(*) into v_tasks from public.points_transactions where student_id = p_student and reason = 'task_completed';
  select total_points into v_points from public.student_profiles where id = p_student;
  select best_days into v_streak from public.study_streaks(p_student);

  for a in select * from public.achievements order by sort_order loop
    v_value := case a.criteria_type
      when 'sessions_completed' then v_sessions
      when 'study_minutes'      then v_minutes
      when 'tasks_completed'    then v_tasks
      when 'total_points'       then coalesce(v_points, 0)
      when 'study_streak_days'  then v_streak
      else 0 end;
    if v_value >= a.threshold then
      insert into public.student_achievements (student_id, achievement_id) values (p_student, a.id) on conflict do nothing;
      if found then
        v_new := v_new || a.id;
        insert into public.notifications (student_id, kind, data, dedupe_key)
        values (p_student, 'achievement', jsonb_build_object('achievement_id', a.id, 'icon', a.icon), 'achievement:' || a.id)
        on conflict on constraint notifications_dedupe do nothing;
      end if;
    end if;
  end loop;
  return v_new;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
--  Client RPCs (student)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.start_study_session(p_minutes integer, p_subject text default null, p_task_id uuid default null)
returns public.study_sessions language plpgsql security definer set search_path = '' as $$
declare
  v_sid uuid := public.current_student_id();
  v_row public.study_sessions;
begin
  if v_sid is null then raise exception 'not_a_student' using errcode = '42501'; end if;
  if p_minutes is null or p_minutes not between 10 and 120 then raise exception 'invalid_duration' using errcode = '22023'; end if;
  if p_task_id is not null and not exists (select 1 from public.study_tasks where id = p_task_id and student_id = v_sid) then
    p_task_id := null;
  end if;
  update public.study_sessions set status = 'cancelled' where student_id = v_sid and status = 'active';
  insert into public.study_sessions (student_id, subject, task_id, planned_minutes)
  values (v_sid, nullif(left(btrim(coalesce(p_subject, '')), 40), ''), p_task_id, p_minutes)
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.complete_study_session(p_session uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sid     uuid := public.current_student_id();
  s         public.study_sessions;
  v_elapsed numeric;
  v_needed  numeric;
  v_points  integer := 0;
  v_badges  text[] := '{}';
  v_total   integer;
begin
  select * into s from public.study_sessions where id = p_session and student_id = v_sid for update;
  if not found then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  if s.status = 'completed' then
    select total_points into v_total from public.student_profiles where id = v_sid;
    return jsonb_build_object('status', 'already_completed', 'points_awarded', 0, 'bonus_awarded', 0,
                              'new_achievements', '[]'::jsonb, 'total_points', v_total);
  end if;
  if s.status = 'cancelled' then raise exception 'session_cancelled' using errcode = '22023'; end if;

  v_elapsed := extract(epoch from now() - s.started_at);
  v_needed  := s.planned_minutes * 60 - 15;
  if v_elapsed < v_needed then
    return jsonb_build_object('status', 'too_early', 'remaining_seconds', ceil(v_needed - v_elapsed));
  end if;

  update public.study_sessions set status = 'completed', completed_at = now() where id = s.id;
  v_points := public.award_points(v_sid, 10, 'study_session', s.id::text);
  insert into public.notifications (student_id, kind, data, dedupe_key)
  values (v_sid, 'session_complete', jsonb_build_object('minutes', s.planned_minutes, 'subject', s.subject, 'points', v_points), 'session:' || s.id)
  on conflict on constraint notifications_dedupe do nothing;
  v_badges := public.check_achievements(v_sid);
  select total_points into v_total from public.student_profiles where id = v_sid;
  return jsonb_build_object('status', 'completed', 'points_awarded', v_points, 'bonus_awarded', 0,
                            'new_achievements', to_jsonb(v_badges), 'total_points', v_total);
end $$;

create or replace function public.cancel_study_session(p_session uuid)
returns void language sql security definer set search_path = '' as $$
  update public.study_sessions set status = 'cancelled'
  where id = p_session and student_id = public.current_student_id() and status = 'active';
$$;

/** +5 once per task (max 20 paid tasks per day), +20 once per day when every
    task of that day (at least 2) is done. */
create or replace function public.set_task_completed(p_task uuid, p_completed boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sid       uuid := public.current_student_id();
  t           public.study_tasks;
  v_tz        text;
  v_today     date;
  v_paid      integer;
  v_points    integer := 0;
  v_bonus     integer := 0;
  v_badges    text[] := '{}';
  v_total     integer;
  v_day_count integer;
  v_day_open  integer;
begin
  select * into t from public.study_tasks where id = p_task and student_id = v_sid for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;

  if t.completed is distinct from p_completed then
    update public.study_tasks set completed = p_completed, completed_at = case when p_completed then now() else null end where id = t.id;
  end if;

  if p_completed then
    v_tz    := public.student_timezone(v_sid);
    v_today := (now() at time zone v_tz)::date;
    delete from public.notifications where task_id = t.id and read_at is null and scheduled_for > now();

    select count(*) into v_paid from public.points_transactions
     where student_id = v_sid and reason = 'task_completed' and (created_at at time zone v_tz)::date = v_today;
    if v_paid < 20 then
      v_points := public.award_points(v_sid, 5, 'task_completed', t.id::text);
    end if;

    if t.task_date between v_today - 1 and v_today then
      select count(*), count(*) filter (where not completed) into v_day_count, v_day_open
        from public.study_tasks where student_id = v_sid and task_date = t.task_date;
      if v_day_count >= 2 and v_day_open = 0 then
        v_bonus := public.award_points(v_sid, 20, 'daily_bonus', t.task_date::text);
        if v_bonus > 0 then
          insert into public.notifications (student_id, kind, data, dedupe_key)
          values (v_sid, 'daily_bonus', jsonb_build_object('date', t.task_date, 'points', v_bonus), 'bonus:' || t.task_date)
          on conflict on constraint notifications_dedupe do nothing;
        end if;
      end if;
    end if;
    v_badges := public.check_achievements(v_sid);
  end if;

  select total_points into v_total from public.student_profiles where id = v_sid;
  return jsonb_build_object('completed', p_completed, 'points_awarded', v_points, 'bonus_awarded', v_bonus,
                            'new_achievements', to_jsonb(v_badges), 'total_points', v_total);
end $$;

create or replace function public.ensure_daily_reminder()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sid uuid := public.current_student_id();
  v_tz text; v_today date; v_open integer;
begin
  if v_sid is null then return; end if;
  v_tz := public.student_timezone(v_sid);
  v_today := (now() at time zone v_tz)::date;
  update public.student_profiles set last_seen_at = now() where id = v_sid;
  select count(*) into v_open from public.study_tasks where student_id = v_sid and task_date = v_today and not completed;
  insert into public.notifications (student_id, kind, data, dedupe_key)
  values (v_sid, 'daily_reminder', jsonb_build_object('date', v_today, 'open_tasks', v_open), 'daily:' || v_today)
  on conflict on constraint notifications_dedupe do nothing;
end $$;

create or replace function public.schedule_task_reminder()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tz   text;
  v_when timestamptz;
  v_kind text;
begin
  delete from public.notifications
   where task_id = new.id and read_at is null and scheduled_for > now()
     and kind in ('task_reminder', 'homework_reminder', 'test_reminder');
  if new.completed or new.reminder_minutes is null or new.start_time is null then return new; end if;

  v_tz   := public.student_timezone(new.student_id);
  v_when := ((new.task_date + new.start_time) at time zone v_tz) - make_interval(mins => new.reminder_minutes);
  if v_when < now() - interval '1 minute' then return new; end if;

  v_kind := case new.task_type when 'test' then 'test_reminder' when 'homework' then 'homework_reminder' else 'task_reminder' end;
  insert into public.notifications (student_id, kind, data, task_id, scheduled_for, dedupe_key)
  values (new.student_id, v_kind,
          jsonb_build_object('title', new.title, 'subject', new.subject, 'task_date', new.task_date,
                             'start_time', to_char(new.start_time, 'HH24:MI'), 'minutes_before', new.reminder_minutes),
          new.id, v_when, 'task:' || new.id || ':' || extract(epoch from v_when)::bigint)
  on conflict on constraint notifications_dedupe do nothing;
  return new;
end $$;

create trigger study_tasks_reminder after insert or update of task_date, start_time, reminder_minutes, title, subject, task_type, completed
  on public.study_tasks for each row execute function public.schedule_task_reminder();

-- ════════════════════════════════════════════════════════════════════════════
--  Reports (student for self, teacher for anyone)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.assert_can_view(p_student uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_student is null or (p_student is distinct from public.current_student_id() and not public.is_teacher()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create or replace function public.get_student_stats(p_student uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_student, public.current_student_id());
  v_tz text; v_today date;
  r jsonb;
begin
  perform public.assert_can_view(v_id);
  v_tz := public.student_timezone(v_id);
  v_today := (now() at time zone v_tz)::date;
  select jsonb_build_object(
    'total_points',       (select total_points from public.student_profiles where id = v_id),
    'sessions_completed', (select count(*) from public.study_sessions where student_id = v_id and status = 'completed'),
    'study_minutes',      (select coalesce(sum(planned_minutes), 0) from public.study_sessions where student_id = v_id and status = 'completed'),
    'tasks_completed',    (select count(*) from public.study_tasks where student_id = v_id and completed),
    'tasks_due',          (select count(*) from public.study_tasks where student_id = v_id and task_date <= v_today),
    'tasks_due_done',     (select count(*) from public.study_tasks where student_id = v_id and task_date <= v_today and completed),
    'today_planned',      (select count(*) from public.study_tasks where student_id = v_id and task_date = v_today),
    'today_completed',    (select count(*) from public.study_tasks where student_id = v_id and task_date = v_today and completed),
    'today_minutes',      (select coalesce(sum(planned_minutes), 0) from public.study_sessions
                            where student_id = v_id and status = 'completed' and (completed_at at time zone v_tz)::date = v_today),
    'best_streak',        (select best_days from public.study_streaks(v_id)),
    'current_streak',     (select current_days from public.study_streaks(v_id)),
    'last_active',        (select last_seen_at from public.student_profiles where id = v_id),
    'today',              v_today
  ) into r;
  return r;
end $$;

create or replace function public.get_weekly_report(p_week_start date, p_student uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_id  uuid := coalesce(p_student, public.current_student_id());
  v_tz  text;
  v_end date := p_week_start + 6;
  r     jsonb;
begin
  perform public.assert_can_view(v_id);
  v_tz := public.student_timezone(v_id);

  with days as (select generate_series(p_week_start, v_end, interval '1 day')::date as day),
  ses as (
    select (completed_at at time zone v_tz)::date as day, planned_minutes, coalesce(subject, '') as subject
    from public.study_sessions
    where student_id = v_id and status = 'completed' and (completed_at at time zone v_tz)::date between p_week_start and v_end
  ),
  tsk as (
    select (completed_at at time zone v_tz)::date as day, subject
    from public.study_tasks
    where student_id = v_id and completed and (completed_at at time zone v_tz)::date between p_week_start and v_end
  ),
  pts as (
    select (created_at at time zone v_tz)::date as day, points
    from public.points_transactions
    where student_id = v_id and (created_at at time zone v_tz)::date between p_week_start and v_end
  ),
  per_day as (
    select d.day,
      coalesce((select sum(planned_minutes) from ses where ses.day = d.day), 0)::integer as minutes,
      (select count(*) from ses where ses.day = d.day)::integer as sessions,
      (select count(*) from tsk where tsk.day = d.day)::integer as tasks,
      coalesce((select sum(points) from pts where pts.day = d.day), 0)::integer as points
    from days d
  ),
  subj as (
    select subject, sum(weight) as weight from (
      select subject, planned_minutes::numeric as weight from ses where subject <> ''
      union all
      select subject, 15 from tsk
    ) x group by subject order by weight desc, subject limit 1
  ),
  subjects as (
    select coalesce(jsonb_agg(jsonb_build_object('subject', subject, 'minutes', minutes) order by minutes desc), '[]'::jsonb) as list
    from (select subject, sum(planned_minutes)::integer as minutes from ses where subject <> '' group by subject) s
  )
  select jsonb_build_object(
    'week_start',         p_week_start,
    'week_end',           v_end,
    'study_minutes',      (select coalesce(sum(minutes), 0) from per_day),
    'sessions_completed', (select coalesce(sum(sessions), 0) from per_day),
    'tasks_completed',    (select coalesce(sum(tasks), 0) from per_day),
    'points_earned',      (select coalesce(sum(points), 0) from per_day),
    'top_subject',        (select subject from subj),
    'subjects',           (select list from subjects),
    'tasks_planned',      (select count(*) from public.study_tasks where student_id = v_id and task_date between p_week_start and v_end),
    'days',               (select jsonb_agg(jsonb_build_object('date', day, 'minutes', minutes, 'sessions', sessions,
                                                                'tasks', tasks, 'points', points) order by day) from per_day),
    'badges',             (select coalesce(jsonb_agg(achievement_id order by unlocked_at), '[]'::jsonb)
                             from public.student_achievements
                            where student_id = v_id and (unlocked_at at time zone v_tz)::date between p_week_start and v_end)
  ) into r;
  return r;
end $$;

/** Teacher overview: usage, benefit and commitment to planned tasks.
    "Due" tasks are those dated today or earlier; this week = the last 7 days. */
create or replace function public.teacher_list_students(p_search text default null, p_grade integer default null)
returns table (
  id uuid, full_name text, grade integer, total_points integer,
  sessions_completed bigint, study_minutes bigint,
  week_minutes bigint, week_sessions bigint, active_days_week bigint,
  tasks_planned bigint, tasks_done bigint, tasks_due bigint, tasks_due_done bigint,
  week_tasks_due bigint, week_tasks_done bigint, overdue_tasks bigint,
  badges bigint, current_streak integer, last_active timestamptz, joined_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  with base as (
    select p.*, (now() at time zone p.timezone)::date as today from public.student_profiles p
    where (p_grade is null or p.grade = p_grade)
      and (p_search is null or btrim(p_search) = '' or p.full_name ilike '%' || btrim(p_search) || '%')
  )
  select b.id, b.full_name, b.grade, b.total_points,
    (select count(*) from public.study_sessions s where s.student_id = b.id and s.status = 'completed'),
    (select coalesce(sum(s.planned_minutes), 0) from public.study_sessions s where s.student_id = b.id and s.status = 'completed'),
    (select coalesce(sum(s.planned_minutes), 0) from public.study_sessions s
      where s.student_id = b.id and s.status = 'completed' and s.completed_at >= now() - interval '7 days'),
    (select count(*) from public.study_sessions s
      where s.student_id = b.id and s.status = 'completed' and s.completed_at >= now() - interval '7 days'),
    (select count(distinct (x.at at time zone b.timezone)::date) from (
        select s.completed_at as at from public.study_sessions s where s.student_id = b.id and s.status = 'completed'
        union all
        select t.completed_at from public.study_tasks t where t.student_id = b.id and t.completed
     ) x where x.at >= now() - interval '7 days'),
    (select count(*) from public.study_tasks t where t.student_id = b.id),
    (select count(*) from public.study_tasks t where t.student_id = b.id and t.completed),
    (select count(*) from public.study_tasks t where t.student_id = b.id and t.task_date <= b.today),
    (select count(*) from public.study_tasks t where t.student_id = b.id and t.task_date <= b.today and t.completed),
    (select count(*) from public.study_tasks t where t.student_id = b.id and t.task_date between b.today - 6 and b.today),
    (select count(*) from public.study_tasks t where t.student_id = b.id and t.task_date between b.today - 6 and b.today and t.completed),
    (select count(*) from public.study_tasks t where t.student_id = b.id and t.task_date < b.today and not t.completed),
    (select count(*) from public.student_achievements a where a.student_id = b.id),
    (select current_days from public.study_streaks(b.id)),
    b.last_seen_at,
    b.created_at
  from base b
  order by b.full_name;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
--  Function permissions: deny by default, then whitelist.
-- ════════════════════════════════════════════════════════════════════════════
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.current_student_id()                              to authenticated;
grant execute on function public.is_teacher()                                      to authenticated;
grant execute on function public.student_login(text, integer, text, text)          to authenticated;
grant execute on function public.teacher_login(text)                               to authenticated;
grant execute on function public.start_study_session(integer, text, uuid)          to authenticated;
grant execute on function public.complete_study_session(uuid)                      to authenticated;
grant execute on function public.cancel_study_session(uuid)                        to authenticated;
grant execute on function public.set_task_completed(uuid, boolean)                 to authenticated;
grant execute on function public.ensure_daily_reminder()                           to authenticated;
grant execute on function public.get_student_stats(uuid)                           to authenticated;
grant execute on function public.get_weekly_report(date, uuid)                     to authenticated;
grant execute on function public.teacher_list_students(text, integer)              to authenticated;
grant execute on function public.name_key(text)                                   to authenticated;  -- used by the profile trigger
