-- ════════════════════════════════════════════════════════════════════════════
--  BOUSLA – individual student PINs.
--  Run after 20261111000000_teacher_manage_students.sql.
--
--  • Every student signs in with name + grade + a secret PIN (4–6 digits).
--  • PINs are stored only as bcrypt hashes in student_secrets, which no client
--    (student or teacher) can read.
--  • Wrong PINs are logged; 5 wrong in 15 minutes or 20 in 24 hours lock that
--    account until the time passes or the teacher resets the PIN.
--  • Existing students keep all their data. An account without a PIN (created
--    before this upgrade, or reset by the teacher) gets its PIN the next time
--    the student signs in.
--  • Devices that were signed in before this upgrade must sign in again with a
--    PIN (they are marked unverified — nothing is deleted).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── private tables ─────────────────────────────────────────────────────────
create table public.student_secrets (
  student_id uuid primary key references public.student_profiles (id) on delete cascade,
  pin_hash   text,                       -- null = PIN not chosen yet (or reset by the teacher)
  updated_at timestamptz not null default now()
);

create table public.student_login_attempts (
  id         bigint generated always as identity primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  auth_uid   uuid,
  ok         boolean not null,
  created_at timestamptz not null default now()
);
create index student_login_attempts_lookup_idx on public.student_login_attempts (student_id, created_at);

alter table public.student_secrets        enable row level security;
alter table public.student_login_attempts enable row level security;
revoke all on public.student_secrets, public.student_login_attempts from anon, authenticated;
-- No policies and no grants: only the SECURITY DEFINER functions below can use them.

-- ─── devices must be PIN-verified ──────────────────────────────────────────
-- Existing rows become false: those devices sign in again (no data is removed).
alter table public.student_devices add column pin_verified boolean not null default false;

create or replace function public.current_student_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select student_id from public.student_devices where auth_uid = auth.uid() and pin_verified;
$$;

-- ─── sign-in with PIN (replaces the name + grade only version) ────────────
drop function public.student_login(text, integer, text, text);

/** Student sign-in. Returns { status, created, pin_set, profile }.
    status 'ok'        → signed in on this device
    status 'wrong_pin' → refused (the attempt is logged)
    Raises: invalid_name, invalid_grade, invalid_pin, pin_locked. */
create or replace function public.student_login(
  p_name text, p_grade integer, p_pin text, p_language text default 'ar', p_timezone text default 'Asia/Muscat')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_name    text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_profile public.student_profiles;
  v_hash    text;
  v_since   timestamptz;
  v_created boolean := false;
  v_pin_set boolean := false;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if p_grade is null or p_grade not between 1 and 12 then raise exception 'invalid_grade' using errcode = '22023'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then raise exception 'invalid_pin' using errcode = '22023'; end if;

  select * into v_profile from public.student_profiles where name_key = public.name_key(v_name) and grade = p_grade;

  if not found then
    insert into public.student_profiles (full_name, grade, language, timezone)
    values (v_name, p_grade, case when p_language in ('ar', 'en') then p_language else 'ar' end, coalesce(p_timezone, 'Asia/Muscat'))
    on conflict (name_key, grade) do nothing
    returning * into v_profile;
    if v_profile.id is null then
      -- Created at the same moment by another device: treat as an existing account below.
      select * into v_profile from public.student_profiles where name_key = public.name_key(v_name) and grade = p_grade;
    else
      v_created := true;
      v_pin_set := true;
      insert into public.student_secrets (student_id, pin_hash) values (v_profile.id, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)));
      insert into public.notifications (student_id, kind, data, dedupe_key)
      values (v_profile.id, 'welcome', jsonb_build_object('name', v_name), 'welcome');
    end if;
  end if;

  if not v_created then
    select pin_hash, updated_at into v_hash, v_since from public.student_secrets where student_id = v_profile.id;
    v_since := greatest(coalesce(v_since, '-infinity'::timestamptz), now() - interval '24 hours');
    -- Lock after 5 wrong PINs in 15 minutes or 20 in 24 hours (counting since the last reset).
    if (select count(*) from public.student_login_attempts
         where student_id = v_profile.id and not ok and created_at > greatest(v_since, now() - interval '15 minutes')) >= 5
       or (select count(*) from public.student_login_attempts
         where student_id = v_profile.id and not ok and created_at > v_since) >= 20 then
      raise exception 'pin_locked' using errcode = '42501';
    end if;

    if v_hash is null then
      -- No PIN yet (account from before PINs, or reset by the teacher): this PIN becomes hers.
      insert into public.student_secrets (student_id, pin_hash, updated_at)
      values (v_profile.id, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), now())
      on conflict (student_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
      v_pin_set := true;
    elsif extensions.crypt(p_pin, v_hash) <> v_hash then
      -- Not raising, so the logged attempt is kept for the lock.
      insert into public.student_login_attempts (student_id, auth_uid, ok) values (v_profile.id, v_uid, false);
      return jsonb_build_object('status', 'wrong_pin');
    end if;
  end if;

  insert into public.student_login_attempts (student_id, auth_uid, ok) values (v_profile.id, v_uid, true);
  delete from public.teacher_profiles where id = v_uid;
  insert into public.student_devices (auth_uid, student_id, pin_verified) values (v_uid, v_profile.id, true)
  on conflict (auth_uid) do update set student_id = excluded.student_id, pin_verified = true, linked_at = now();
  update public.student_profiles set last_seen_at = now() where id = v_profile.id returning * into v_profile;
  return jsonb_build_object('status', 'ok', 'created', v_created, 'pin_set', v_pin_set,
                            'profile', to_jsonb(v_profile) - 'name_key');
end $$;

-- ─── teacher: PIN status and reset ────────────────────────────────────────
create or replace function public.teacher_student_has_pin(p_student uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  return exists (select 1 from public.student_secrets where student_id = p_student and pin_hash is not null);
end $$;

/** Forgotten PIN: clears it (the student chooses a new one at her next sign-in),
    unlocks the account and signs all of her devices out. No progress is touched. */
create or replace function public.teacher_reset_student_pin(p_student uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.student_profiles where id = p_student) then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;
  insert into public.student_secrets (student_id, pin_hash, updated_at) values (p_student, null, now())
  on conflict (student_id) do update set pin_hash = null, updated_at = now();
  update public.student_devices set pin_verified = false where student_id = p_student;
end $$;

-- ─── permissions ──────────────────────────────────────────────────────────
revoke execute on function public.student_login(text, integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.teacher_student_has_pin(uuid)                  from public, anon, authenticated;
revoke execute on function public.teacher_reset_student_pin(uuid)                from public, anon, authenticated;
grant  execute on function public.student_login(text, integer, text, text, text) to authenticated;
grant  execute on function public.teacher_student_has_pin(uuid)                  to authenticated;
grant  execute on function public.teacher_reset_student_pin(uuid)                to authenticated;
