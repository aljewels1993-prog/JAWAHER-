-- ════════════════════════════════════════════════════════════════════════════
--  BOUSLA – read-only backup export
--
--  READ-ONLY: this is a single SELECT. It does not insert, update or delete
--  anything, and it is safe to run at any time.
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste → Run.
--  The result is ONE row with one cell ("backup") holding all student data as
--  JSON. Tap the cell, copy it, and save it as a file (e.g. in Notes or Files,
--  named bousla-backup-YYYY-MM-DD.json).
--
--  Included: students, tasks, study sessions, points, earned badges and
--  notifications, plus row counts so you can check the copy is complete.
--  Not included on purpose: the teacher code hash, device sign-in links and
--  sign-in attempt logs (they are security data, not student progress).
-- ════════════════════════════════════════════════════════════════════════════

select jsonb_build_object(
  'app',          'BOUSLA',
  'format',       1,
  'exported_at',  now(),
  'counts', jsonb_build_object(
    'students',             (select count(*) from public.student_profiles),
    'tasks',                (select count(*) from public.study_tasks),
    'study_sessions',       (select count(*) from public.study_sessions),
    'points_transactions',  (select count(*) from public.points_transactions),
    'student_achievements', (select count(*) from public.student_achievements),
    'notifications',        (select count(*) from public.notifications)
  ),
  'students',             coalesce((select jsonb_agg(to_jsonb(p) - 'name_key' order by p.grade, p.full_name) from public.student_profiles p), '[]'::jsonb),
  'tasks',                coalesce((select jsonb_agg(to_jsonb(t) order by t.student_id, t.task_date) from public.study_tasks t), '[]'::jsonb),
  'study_sessions',       coalesce((select jsonb_agg(to_jsonb(s) order by s.student_id, s.started_at) from public.study_sessions s), '[]'::jsonb),
  'points_transactions',  coalesce((select jsonb_agg(to_jsonb(x) order by x.student_id, x.created_at) from public.points_transactions x), '[]'::jsonb),
  'student_achievements', coalesce((select jsonb_agg(to_jsonb(a) order by a.student_id, a.unlocked_at) from public.student_achievements a), '[]'::jsonb),
  'notifications',        coalesce((select jsonb_agg(to_jsonb(n) order by n.student_id, n.created_at) from public.notifications n), '[]'::jsonb)
) as backup;
