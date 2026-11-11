-- ════════════════════════════════════════════════════════════════════════════
--  BOUSLA – teachers can manage student accounts.
--  Run after 20261110000000_bousla_schema.sql.
--
--  A teacher device (signed in with the teacher code) can:
--    • correct a student's name or grade (the student's sign-in changes with it),
--    • delete a student account and all of its data.
--  Points and badges still cannot be edited by anyone from the app: they are
--  only paid by the reward functions.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.teacher_update_student(p_student uuid, p_name text, p_grade integer)
returns public.student_profiles language plpgsql security definer set search_path = '' as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_row  public.student_profiles;
begin
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if p_grade is null or p_grade not between 1 and 12 then raise exception 'invalid_grade' using errcode = '22023'; end if;
  if exists (select 1 from public.student_profiles
              where name_key = public.name_key(v_name) and grade = p_grade and id <> p_student) then
    raise exception 'name_taken' using errcode = '23505';
  end if;
  update public.student_profiles set full_name = v_name, grade = p_grade where id = p_student returning * into v_row;
  if v_row.id is null then raise exception 'student_not_found' using errcode = 'P0002'; end if;
  return v_row;
end $$;

create or replace function public.teacher_delete_student(p_student uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.student_profiles where id = p_student;  -- cascades to tasks, sessions, points, badges, notifications, devices
  if not found then raise exception 'student_not_found' using errcode = 'P0002'; end if;
end $$;

revoke execute on function public.teacher_update_student(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.teacher_delete_student(uuid)               from public, anon, authenticated;
grant  execute on function public.teacher_update_student(uuid, text, integer) to authenticated;
grant  execute on function public.teacher_delete_student(uuid)               to authenticated;
