-- Upgrade path: a database installed BEFORE student PINs, with a real student,
-- then upgrade_student_pins.sql. Everything must be kept.
create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'TEST FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
grant execute on function pg_temp.check(boolean, text) to authenticated;
