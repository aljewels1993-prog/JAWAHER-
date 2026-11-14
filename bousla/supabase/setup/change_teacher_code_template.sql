-- BOUSLA: change the teacher code.
-- The setup helper page puts a bcrypt hash made on your phone in the line below,
-- so the code itself never appears in Supabase. Run in the SQL Editor.
do $$
declare h text := 'HASH_HERE';
begin
  if h !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$' then
    raise exception 'This is not a valid code hash. Make a new one in the setup helper.';
  end if;
  update public.app_settings set value = h where key = 'teacher_code_hash';
  if not found then
    insert into public.app_settings (key, value) values ('teacher_code_hash', h);
  end if;
  delete from public.teacher_profiles;  -- every teacher device signs in again with the new code
end $$;
select 'Teacher code changed ✅ — teacher devices were signed out' as result;
