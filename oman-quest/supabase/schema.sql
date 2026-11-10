-- OMAN ENGLISH QUEST 3D — Supabase schema
-- Run once in the Supabase SQL editor. Then:
--   1. Authentication → Providers → enable "Anonymous sign-ins" (students).
--   2. Authentication → Users → add each teacher (email + password).
--   3. Register teachers:  insert into public.teachers (user_id)
--        select id from auth.users where email = 'teacher@school.om';
-- The browser only ever uses the public anon key. Never put the service-role
-- key in the game's .env file.

create table if not exists public.students (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null check (char_length(display_name) between 1 and 24),
  progress         jsonb not null default '{}'::jsonb,
  total_score      int  not null default 0 check (total_score between 0 and 20000),
  coins            int  not null default 0 check (coins >= 0),
  stars            int  not null default 0 check (stars >= 0),
  stages_completed int  not null default 0 check (stages_completed between 0 and 10),
  questions_done   int  not null default 0 check (questions_done between 0 and 50),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.answer_log (
  id          bigint generated always as identity primary key,
  student_id  uuid not null references public.students (id) on delete cascade,
  question_id text not null check (question_id ~ '^q[0-9]{2}$'),
  chosen      int  not null check (chosen between 0 and 3),
  correct     boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists answer_log_student_idx on public.answer_log (student_id);

create table if not exists public.teachers (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- Is the signed-in user a teacher? (security definer so RLS on teachers
-- doesn't hide the row from the check itself)
create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teachers where user_id = auth.uid());
$$;

alter table public.students   enable row level security;
alter table public.answer_log enable row level security;
alter table public.teachers   enable row level security;

drop policy if exists students_select on public.students;
drop policy if exists students_insert on public.students;
drop policy if exists students_update on public.students;
create policy students_select on public.students for select using (id = auth.uid() or public.is_teacher());
create policy students_insert on public.students for insert with check (id = auth.uid());
create policy students_update on public.students for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists answers_insert on public.answer_log;
drop policy if exists answers_select on public.answer_log;
create policy answers_insert on public.answer_log for insert with check (student_id = auth.uid());
create policy answers_select on public.answer_log for select using (student_id = auth.uid() or public.is_teacher());

drop policy if exists teachers_self on public.teachers;
create policy teachers_self on public.teachers for select using (user_id = auth.uid());

-- Public leaderboard: only name + scores, never ids or answers.
create or replace function public.get_leaderboard()
returns table (display_name text, total_score int, stages_completed int, coins int)
language sql stable security definer set search_path = public as $$
  select s.display_name, s.total_score, s.stages_completed, s.coins
  from public.students s
  order by s.total_score desc, s.updated_at asc
  limit 20;
$$;

-- Teacher-only reset of one student's progress.
create or replace function public.reset_student(sid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then
    raise exception 'not authorised';
  end if;
  update public.students
     set progress = '{}'::jsonb, total_score = 0, coins = 0, stars = 0,
         stages_completed = 0, questions_done = 0, updated_at = now()
   where id = sid;
  delete from public.answer_log where student_id = sid;
end;
$$;

revoke all on function public.reset_student(uuid) from public;
grant execute on function public.get_leaderboard() to anon, authenticated;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.reset_student(uuid) to authenticated;
