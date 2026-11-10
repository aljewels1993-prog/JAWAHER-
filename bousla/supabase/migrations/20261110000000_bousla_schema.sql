-- ════════════════════════════════════════════════════════════════════════════
--  BOUSLA – بوصلة  ·  database schema, security and reward logic
--
--  Run once in the Supabase SQL editor (or `supabase db push`).
--  Everything that affects points, badges or roles happens inside
--  SECURITY DEFINER functions below. The browser can only:
--    • read its own rows (Row Level Security),
--    • create / edit / delete its own study tasks (but NOT their
--      completed flag),
--    • call the whitelisted RPC functions.
--  Points are never accepted from the client.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── helpers ────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─── 1. student_profiles ───────────────────────────────────────────────────
create table public.student_profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null check (char_length(btrim(full_name)) between 2 and 80),
  username        text not null check (username ~ '^[a-z0-9_.]{3,20}$'),
  language        text not null default 'ar' check (language in ('ar', 'en')),
  timezone        text not null default 'Asia/Muscat',
  custom_subjects text[] not null default '{}' check (cardinality(custom_subjects) <= 20),
  total_points    integer not null default 0 check (total_points >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index student_profiles_username_key on public.student_profiles (lower(username));
create index student_profiles_full_name_idx on public.student_profiles (lower(full_name));

-- Keep the timezone valid (an unknown zone would break every date calculation).
create or replace function public.validate_student_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    new.timezone := 'Asia/Muscat';
  end if;
  new.full_name := btrim(new.full_name);
  new.username  := lower(btrim(new.username));
  if exists (select 1 from unnest(new.custom_subjects) s where char_length(s) not between 1 and 40) then
    raise exception 'invalid_custom_subject';
  end if;
  return new;
end $$;

create trigger student_profiles_validate before insert or update on public.student_profiles
  for each row execute function public.validate_student_profile();
create trigger student_profiles_touch before update on public.student_profiles
  for each row execute function public.touch_updated_at();

-- ─── 8. teacher_profiles (created early: policies below depend on it) ─────
create table public.teacher_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(btrim(full_name)) between 2 and 80),
  school_name text check (char_length(school_name) <= 120),
  language    text not null default 'ar' check (language in ('ar', 'en')),
  created_at  timestamptz not null default now()
);

/** True when the signed-in user is a teacher. Roles live only in teacher_profiles,
    which no client can write to. */
create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.teacher_profiles where id = auth.uid());
$$;

-- ─── 2. study_tasks ────────────────────────────────────────────────────────
create table public.study_tasks (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null default auth.uid()
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
-- A student can only run one session at a time.
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
  -- The same reward can never be paid twice.
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
  ('study_star',      '⭐', 'Study Star',      'نجمة المذاكرة', 'Complete 3 study sessions.',             'أكملي 3 جلسات مذاكرة.',             'sessions_completed', 3,   1),
  ('time_master',     '⏰', 'Time Master',     'سيّدة الوقت',   'Study for a total of 10 hours.',         'ذاكري ما مجموعه 10 ساعات.',          'study_minutes',      600, 2),
  ('reading_hero',    '📖', 'Reading Hero',    'بطلة القراءة',  'Complete 15 planned tasks.',             'أنجزي 15 مهمة من خطتك.',             'tasks_completed',    15,  3),
  ('super_achiever',  '🏆', 'Super Achiever',  'المتفوقة',      'Collect 500 points.',                    'اجمعي 500 نقطة.',                    'total_points',       500, 4),
  ('weekly_champion', '👑', 'Weekly Champion', 'بطلة الأسبوع',  'Study 5 days in a row.',                 'ذاكري 5 أيام متتالية.',              'study_streak_days',  5,   5);

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
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in
                  ('welcome', 'task_reminder', 'homework_reminder', 'test_reminder', 'daily_reminder',
                   'session_complete', 'daily_bonus', 'achievement')),
  -- Parameters only; the app renders the text in the reader's language.
  data          jsonb not null default '{}'::jsonb,
  task_id       uuid references public.study_tasks (id) on delete cascade,
  scheduled_for timestamptz not null default now(),
  read_at       timestamptz,
  dedupe_key    text,
  created_at    timestamptz not null default now(),
  constraint notifications_dedupe unique (user_id, dedupe_key)
);
create index notifications_user_time_idx on public.notifications (user_id, scheduled_for desc);

-- ════════════════════════════════════════════════════════════════════════════
--  Row Level Security
-- ════════════════════════════════════════════════════════════════════════════
alter table public.student_profiles     enable row level security;
alter table public.teacher_profiles     enable row level security;
alter table public.study_tasks          enable row level security;
alter table public.study_sessions       enable row level security;
alter table public.points_transactions  enable row level security;
alter table public.achievements         enable row level security;
alter table public.student_achievements enable row level security;
alter table public.notifications        enable row level security;

-- Start from nothing, then grant exactly what each role needs.
revoke all on public.student_profiles, public.teacher_profiles, public.study_tasks, public.study_sessions,
              public.points_transactions, public.achievements, public.student_achievements, public.notifications
  from anon, authenticated;

-- student_profiles: read own (teachers read all); update only safe columns.
grant select on public.student_profiles to authenticated;
grant update (full_name, username, language, timezone, custom_subjects) on public.student_profiles to authenticated;
create policy "student reads own profile" on public.student_profiles
  for select to authenticated using (id = auth.uid() or public.is_teacher());
create policy "student updates own profile" on public.student_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- teacher_profiles: a teacher reads/updates only their own row. No insert/delete
-- for anyone except the database owner (see promote_to_teacher).
grant select on public.teacher_profiles to authenticated;
grant update (full_name, school_name, language) on public.teacher_profiles to authenticated;
create policy "teacher reads own profile" on public.teacher_profiles
  for select to authenticated using (id = auth.uid());
create policy "teacher updates own profile" on public.teacher_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- study_tasks: students manage their own tasks; `completed` only via set_task_completed().
grant select, delete on public.study_tasks to authenticated;
grant insert (subject, title, description, task_type, task_date, start_time, duration_minutes, priority, reminder_minutes)
  on public.study_tasks to authenticated;
grant update (subject, title, description, task_type, task_date, start_time, duration_minutes, priority, reminder_minutes)
  on public.study_tasks to authenticated;
create policy "student reads own tasks" on public.study_tasks
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy "student creates own tasks" on public.study_tasks
  for insert to authenticated with check (student_id = auth.uid());
create policy "student edits own tasks" on public.study_tasks
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "student deletes own tasks" on public.study_tasks
  for delete to authenticated using (student_id = auth.uid());

-- study_sessions: read-only for clients; written by RPCs.
grant select on public.study_sessions to authenticated;
create policy "read own sessions" on public.study_sessions
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());

-- points_transactions: read-only ledger.
grant select on public.points_transactions to authenticated;
create policy "read own points" on public.points_transactions
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());

-- achievements catalogue: public to signed-in users.
grant select on public.achievements to authenticated;
create policy "read achievements" on public.achievements
  for select to authenticated using (true);

grant select on public.student_achievements to authenticated;
create policy "read own badges" on public.student_achievements
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());

-- notifications: private to the owner; may mark read or delete.
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
--  Account creation
-- ════════════════════════════════════════════════════════════════════════════

/** Creates the student profile for every new auth user. The role is NEVER read
    from user metadata — everyone starts as a student. */
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name    text  := btrim(coalesce(meta ->> 'full_name', ''));
  v_user    text  := lower(btrim(coalesce(meta ->> 'username', '')));
  v_lang    text  := case when meta ->> 'language' in ('ar', 'en') then meta ->> 'language' else 'ar' end;
  v_tz      text  := coalesce(meta ->> 'timezone', 'Asia/Muscat');
  v_try     text;
  v_attempt integer := 0;
begin
  if char_length(v_name) < 2 then
    v_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Student');
    if char_length(v_name) < 2 then v_name := 'Student'; end if;
  end if;
  v_name := left(v_name, 80);
  if v_user !~ '^[a-z0-9_.]{3,20}$' then v_user := 'student'; end if;

  v_try := v_user;
  while exists (select 1 from public.student_profiles where lower(username) = v_try) loop
    v_attempt := v_attempt + 1;
    v_try := left(v_user, 15) || (floor(random() * 9000) + 1000)::int::text;
    exit when v_attempt > 20;
  end loop;

  insert into public.student_profiles (id, full_name, username, language, timezone)
  values (new.id, v_name, v_try, v_lang, v_tz);

  insert into public.notifications (user_id, kind, data, dedupe_key)
  values (new.id, 'welcome', jsonb_build_object('name', v_name), 'welcome');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

/** Lets the sign-up form check a username before submitting. */
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_username ~ '^[a-z0-9_.]{3,20}$'
     and not exists (select 1 from public.student_profiles where lower(username) = lower(p_username));
$$;

/** ADMIN ONLY (SQL editor / service role). Turns an existing account into a teacher.
    Removes the automatic student profile (a new teacher has no study data). */
create or replace function public.promote_to_teacher(p_email text, p_school text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id   uuid;
  v_name text;
begin
  select u.id into v_id from auth.users u where lower(u.email) = lower(p_email);
  if v_id is null then raise exception 'No account with email %', p_email; end if;
  select full_name into v_name from public.student_profiles where id = v_id;
  insert into public.teacher_profiles (id, full_name, school_name)
  values (v_id, coalesce(v_name, split_part(p_email, '@', 1)), p_school)
  on conflict (id) do update set school_name = coalesce(excluded.school_name, public.teacher_profiles.school_name);
  delete from public.student_profiles where id = v_id;
  return v_id;
end $$;

/** ADMIN ONLY. Removes the teacher role (the account can sign in again as a fresh student). */
create or replace function public.demote_teacher(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_name text;
begin
  select u.id into v_id from auth.users u where lower(u.email) = lower(p_email);
  if v_id is null then raise exception 'No account with email %', p_email; end if;
  delete from public.teacher_profiles where id = v_id returning full_name into v_name;
  insert into public.student_profiles (id, full_name, username)
  values (v_id, coalesce(v_name, 'Student'), 'student' || (floor(random() * 900000) + 100000)::int::text)
  on conflict (id) do nothing;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
--  Reward engine (internal — not callable by clients)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.student_timezone(p_student uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select timezone from public.student_profiles where id = p_student), 'Asia/Muscat');
$$;

/** Inserts a ledger entry once. Returns the points actually awarded (0 if it was already paid). */
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

/** Longest and current run of consecutive days with at least one completed study session. */
create or replace function public.study_streaks(p_student uuid)
returns table (best_days integer, current_days integer) language sql stable security definer set search_path = '' as $$
  with tz as (select public.student_timezone(p_student) as zone),
  days as (
    select distinct (s.completed_at at time zone (select zone from tz))::date as day
    from public.study_sessions s
    where s.student_id = p_student and s.status = 'completed'
  ),
  runs as (
    select day, day - (row_number() over (order by day))::integer as grp from days
  ),
  grouped as (
    select min(day) as first_day, max(day) as last_day, count(*)::integer as len from runs group by grp
  ),
  today as (select (now() at time zone (select zone from tz))::date as d)
  select
    coalesce((select max(len) from grouped), 0),
    coalesce((select len from grouped where last_day >= (select d from today) - 1 order by last_day desc limit 1), 0);
$$;

/** Unlocks every badge whose criteria the student now meets. Returns the new badge ids. */
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
  select count(*) into v_tasks from public.points_transactions
    where student_id = p_student and reason = 'task_completed';
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
      insert into public.student_achievements (student_id, achievement_id)
      values (p_student, a.id) on conflict do nothing;
      if found then
        v_new := v_new || a.id;
        insert into public.notifications (user_id, kind, data, dedupe_key)
        values (p_student, 'achievement', jsonb_build_object('achievement_id', a.id, 'icon', a.icon),
                'achievement:' || a.id)
        on conflict on constraint notifications_dedupe do nothing;
      end if;
    end if;
  end loop;
  return v_new;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
--  Client RPCs (student)
-- ════════════════════════════════════════════════════════════════════════════

/** Starts a timed study session. The server clock is the source of truth. */
create or replace function public.start_study_session(p_minutes integer, p_subject text default null, p_task_id uuid default null)
returns public.study_sessions language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.study_sessions;
begin
  if v_uid is null or not exists (select 1 from public.student_profiles where id = v_uid) then
    raise exception 'not_a_student' using errcode = '42501';
  end if;
  if p_minutes is null or p_minutes not between 10 and 120 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;
  if p_task_id is not null and not exists (select 1 from public.study_tasks where id = p_task_id and student_id = v_uid) then
    p_task_id := null;
  end if;
  update public.study_sessions set status = 'cancelled' where student_id = v_uid and status = 'active';
  insert into public.study_sessions (student_id, subject, task_id, planned_minutes)
  values (v_uid, nullif(left(btrim(coalesce(p_subject, '')), 40), ''), p_task_id, p_minutes)
  returning * into v_row;
  return v_row;
end $$;

/** Completes a session if enough real time has passed. Awards 10 points exactly once. */
create or replace function public.complete_study_session(p_session uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  s         public.study_sessions;
  v_elapsed numeric;
  v_needed  numeric;
  v_points  integer := 0;
  v_badges  text[] := '{}';
  v_total   integer;
begin
  select * into s from public.study_sessions where id = p_session and student_id = v_uid for update;
  if not found then raise exception 'session_not_found' using errcode = 'P0002'; end if;

  if s.status = 'completed' then
    select total_points into v_total from public.student_profiles where id = v_uid;
    return jsonb_build_object('status', 'already_completed', 'points_awarded', 0,
                              'new_achievements', '[]'::jsonb, 'total_points', v_total);
  end if;
  if s.status = 'cancelled' then raise exception 'session_cancelled' using errcode = '22023'; end if;

  v_elapsed := extract(epoch from now() - s.started_at);
  v_needed  := s.planned_minutes * 60 - 15;  -- 15 s tolerance for network delay
  if v_elapsed < v_needed then
    return jsonb_build_object('status', 'too_early', 'remaining_seconds', ceil(v_needed - v_elapsed));
  end if;

  update public.study_sessions set status = 'completed', completed_at = now() where id = s.id;
  v_points := public.award_points(v_uid, 10, 'study_session', s.id::text);
  insert into public.notifications (user_id, kind, data, dedupe_key)
  values (v_uid, 'session_complete',
          jsonb_build_object('minutes', s.planned_minutes, 'subject', s.subject, 'points', v_points),
          'session:' || s.id)
  on conflict on constraint notifications_dedupe do nothing;
  v_badges := public.check_achievements(v_uid);
  select total_points into v_total from public.student_profiles where id = v_uid;
  return jsonb_build_object('status', 'completed', 'points_awarded', v_points,
                            'new_achievements', to_jsonb(v_badges), 'total_points', v_total);
end $$;

create or replace function public.cancel_study_session(p_session uuid)
returns void language sql security definer set search_path = '' as $$
  update public.study_sessions set status = 'cancelled'
  where id = p_session and student_id = auth.uid() and status = 'active';
$$;

/** Marks a task done / not done. +5 once per task (max 20 paid tasks per day),
    +20 once per day when every task of that day (at least 2) is done. */
create or replace function public.set_task_completed(p_task uuid, p_completed boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid       uuid := auth.uid();
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
  select * into t from public.study_tasks where id = p_task and student_id = v_uid for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;

  if t.completed is distinct from p_completed then
    update public.study_tasks
       set completed = p_completed, completed_at = case when p_completed then now() else null end
     where id = t.id;
  end if;

  if p_completed then
    v_tz    := public.student_timezone(v_uid);
    v_today := (now() at time zone v_tz)::date;

    -- Remove any pending reminder for a finished task.
    delete from public.notifications
     where task_id = t.id and read_at is null and scheduled_for > now();

    select count(*) into v_paid from public.points_transactions
     where student_id = v_uid and reason = 'task_completed'
       and (created_at at time zone v_tz)::date = v_today;
    if v_paid < 20 then
      v_points := public.award_points(v_uid, 5, 'task_completed', t.id::text);
    end if;

    -- Daily bonus: only for today or yesterday, at least two tasks, all done.
    if t.task_date between v_today - 1 and v_today then
      select count(*), count(*) filter (where not completed) into v_day_count, v_day_open
        from public.study_tasks where student_id = v_uid and task_date = t.task_date;
      if v_day_count >= 2 and v_day_open = 0 then
        v_bonus := public.award_points(v_uid, 20, 'daily_bonus', t.task_date::text);
        if v_bonus > 0 then
          insert into public.notifications (user_id, kind, data, dedupe_key)
          values (v_uid, 'daily_bonus', jsonb_build_object('date', t.task_date, 'points', v_bonus),
                  'bonus:' || t.task_date)
          on conflict on constraint notifications_dedupe do nothing;
        end if;
      end if;
    end if;
    v_badges := public.check_achievements(v_uid);
  end if;

  select total_points into v_total from public.student_profiles where id = v_uid;
  return jsonb_build_object('completed', p_completed, 'points_awarded', v_points, 'bonus_awarded', v_bonus,
                            'new_achievements', to_jsonb(v_badges), 'total_points', v_total);
end $$;

/** Creates today's study reminder once per day (called when the app opens). */
create or replace function public.ensure_daily_reminder()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tz text; v_today date; v_open integer;
begin
  if not exists (select 1 from public.student_profiles where id = v_uid) then return; end if;
  v_tz := public.student_timezone(v_uid);
  v_today := (now() at time zone v_tz)::date;
  select count(*) into v_open from public.study_tasks
   where student_id = v_uid and task_date = v_today and not completed;
  insert into public.notifications (user_id, kind, data, dedupe_key)
  values (v_uid, 'daily_reminder', jsonb_build_object('date', v_today, 'open_tasks', v_open), 'daily:' || v_today)
  on conflict on constraint notifications_dedupe do nothing;
end $$;

-- ─── Task reminder scheduling (trigger) ───────────────────────────────────
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

  if new.completed or new.reminder_minutes is null or new.start_time is null then
    return new;
  end if;

  v_tz   := public.student_timezone(new.student_id);
  v_when := ((new.task_date + new.start_time) at time zone v_tz) - make_interval(mins => new.reminder_minutes);
  if v_when < now() - interval '1 minute' then return new; end if;

  v_kind := case new.task_type when 'test' then 'test_reminder' when 'homework' then 'homework_reminder' else 'task_reminder' end;
  insert into public.notifications (user_id, kind, data, task_id, scheduled_for, dedupe_key)
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
  if auth.uid() is null or (p_student <> auth.uid() and not public.is_teacher()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create or replace function public.get_student_stats(p_student uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_student, auth.uid());
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
    'today_planned',      (select count(*) from public.study_tasks where student_id = v_id and task_date = v_today),
    'today_completed',    (select count(*) from public.study_tasks where student_id = v_id and task_date = v_today and completed),
    'today_minutes',      (select coalesce(sum(planned_minutes), 0) from public.study_sessions
                            where student_id = v_id and status = 'completed' and (completed_at at time zone v_tz)::date = v_today),
    'best_streak',        (select best_days from public.study_streaks(v_id)),
    'current_streak',     (select current_days from public.study_streaks(v_id)),
    'last_active',        (select max(completed_at) from public.study_sessions where student_id = v_id and status = 'completed'),
    'today',              v_today
  ) into r;
  return r;
end $$;

/** Seven-day report starting on p_week_start (a Sunday). */
create or replace function public.get_weekly_report(p_week_start date, p_student uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_id  uuid := coalesce(p_student, auth.uid());
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
    where student_id = v_id and status = 'completed'
      and (completed_at at time zone v_tz)::date between p_week_start and v_end
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

/** Teacher overview of every registered student (optionally filtered by name/username). */
create or replace function public.teacher_list_students(p_search text default null)
returns table (
  id uuid, full_name text, username text, total_points integer,
  tasks_completed bigint, sessions_completed bigint, study_minutes bigint,
  week_minutes bigint, badges bigint, last_active timestamptz, joined_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select p.id, p.full_name, p.username, p.total_points,
    (select count(*) from public.study_tasks t where t.student_id = p.id and t.completed),
    (select count(*) from public.study_sessions s where s.student_id = p.id and s.status = 'completed'),
    (select coalesce(sum(s.planned_minutes), 0) from public.study_sessions s where s.student_id = p.id and s.status = 'completed'),
    (select coalesce(sum(s.planned_minutes), 0) from public.study_sessions s
      where s.student_id = p.id and s.status = 'completed' and s.completed_at >= now() - interval '7 days'),
    (select count(*) from public.student_achievements a where a.student_id = p.id),
    greatest((select max(s.completed_at) from public.study_sessions s where s.student_id = p.id),
             (select max(t.updated_at) from public.study_tasks t where t.student_id = p.id)),
    p.created_at
  from public.student_profiles p
  where p_search is null or btrim(p_search) = ''
     or p.full_name ilike '%' || btrim(p_search) || '%'
     or p.username  ilike '%' || btrim(p_search) || '%'
  order by p.full_name;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
--  Function permissions: deny by default, then whitelist.
-- ════════════════════════════════════════════════════════════════════════════
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.username_available(text)                         to anon, authenticated;
grant execute on function public.is_teacher()                                     to authenticated;
grant execute on function public.start_study_session(integer, text, uuid)         to authenticated;
grant execute on function public.complete_study_session(uuid)                     to authenticated;
grant execute on function public.cancel_study_session(uuid)                       to authenticated;
grant execute on function public.set_task_completed(uuid, boolean)                to authenticated;
grant execute on function public.ensure_daily_reminder()                          to authenticated;
grant execute on function public.get_student_stats(uuid)                          to authenticated;
grant execute on function public.get_weekly_report(date, uuid)                    to authenticated;
grant execute on function public.teacher_list_students(text)                      to authenticated;
-- Trigger functions run as their owner; internal helpers (award_points,
-- check_achievements, promote_to_teacher, …) stay private to the database owner.
