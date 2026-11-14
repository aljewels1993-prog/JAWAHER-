// BOUSLA live check against a real Supabase project (uses only the publishable key).
// Usage:  VITE_SUPABASE_URL=… VITE_SUPABASE_PUBLISHABLE_KEY=… TEACHER_CODE=<your code> npm run test:live
// Optional: WAIT_SESSION=1 waits 10 minutes to also test a real study session (+10).
// It creates two test students ("BOUSLA Test …", grade 12) and deletes them at the end.
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const teacherCode = process.env.TEACHER_CODE;
if (!teacherCode) { console.error('Set TEACHER_CODE (needed to view and remove the test students)'); process.exit(2); }
if (!url || !key) { console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY'); process.exit(2); }

let failed = 0;
const ok = (cond, msg, extra = '') => { console.log(`${cond ? '✅' : '❌'} ${msg}${extra ? ` — ${extra}` : ''}`); if (!cond) failed++; };
const device = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Muscat' }).format(new Date());
const tag = Math.random().toString(36).slice(2, 7);
const nameA = `BOUSLA Test ${tag} A`;
const nameB = `BOUSLA Test ${tag} B`;

async function signInDevice(label) {
  const c = device();
  const { error } = await c.auth.signInAnonymously();
  if (error) {
    ok(false, `${label}: anonymous sign-in`, error.message.includes('disabled')
      ? 'Turn ON "Allow anonymous sign-ins" (Authentication → Sign In / Providers)' : error.message);
    throw new Error('stop');
  }
  return c;
}

const ids = [];
try {
  // 0. Key valid and database installed?
  const probe = device();
  const { error: probeErr } = await probe.from('achievements').select('id').limit(1);
  const m = probeErr?.message?.toLowerCase() ?? '';
  if (/invalid api key|no api key|unregistered api key/.test(m) || probeErr?.code === '401') {
    ok(false, 'publishable key accepted', 'Check the key (Project Settings → API Keys → Publishable key)');
    throw new Error('stop');
  }
  if (/fetch failed|network/.test(m)) { ok(false, 'reach the Supabase project', probeErr.message); throw new Error('stop'); }
  ok(true, 'publishable key accepted');
  // Signed out, the tables must exist but refuse access ("permission denied" = installed and protected).
  const missing = /does not exist|schema cache/.test(m);
  ok(!missing, 'database tables installed', missing ? 'Run bousla_full_setup.sql in the SQL Editor' : '');
  ok(!probeErr || /permission denied/.test(m), 'signed-out visitors are refused by the database', probeErr ? '' : 'achievements were readable without signing in');
  if (missing) throw new Error('stop');

  // 1. Student A registers on phone 1
  const a1 = await signInDevice('student A');
  ok(true, 'anonymous sign-in works');
  const pinA = String(100000 + Math.floor(Math.random() * 899999));
  const { data: reg, error: regErr } = await a1.rpc('student_login', { p_name: nameA, p_grade: 12, p_pin: pinA, p_language: 'ar', p_timezone: 'Asia/Muscat' });
  ok(!regErr && reg?.status === 'ok' && reg?.created === true, 'student registration (name + grade + PIN)', regErr?.message);
  ids.push(reg?.profile?.id);

  // 2. Tasks + points
  const { data: tasks, error: tErr } = await a1.from('study_tasks')
    .insert([{ subject: 'Mathematics', title: 'Live check 1', task_date: today }, { subject: 'English', title: 'Live check 2', task_date: today }])
    .select('id');
  ok(!tErr && tasks?.length === 2, 'save tasks', tErr?.message);
  const r1 = await a1.rpc('set_task_completed', { p_task: tasks[0].id, p_completed: true });
  const r2 = await a1.rpc('set_task_completed', { p_task: tasks[1].id, p_completed: true });
  ok(r1.data?.points_awarded === 5 && r2.data?.points_awarded === 5 && r2.data?.bonus_awarded === 20, 'points: +5, +5 and +20 daily bonus', JSON.stringify(r2.data ?? r2.error?.message));
  const again = await a1.rpc('set_task_completed', { p_task: tasks[0].id, p_completed: true });
  ok(again.data?.points_awarded === 0, 'no duplicate points on a second click');
  const hack = await a1.from('points_transactions').insert({ student_id: ids[0], points: 100, reason: 'daily_bonus', ref_key: 'hack' });
  ok(!!hack.error, 'the app cannot write points directly (RLS)');
  const hack2 = await a1.from('student_profiles').update({ total_points: 9999 }).eq('id', ids[0]);
  ok(!!hack2.error, 'the app cannot change total points');

  // 3. Study session
  const { data: ses } = await a1.rpc('start_study_session', { p_minutes: 10, p_subject: 'Science' });
  const early = await a1.rpc('complete_study_session', { p_session: ses?.id });
  ok(early.data?.status === 'too_early', 'a session cannot finish early');
  if (process.env.WAIT_SESSION) {
    console.log('… waiting 10 minutes for the study session');
    await new Promise((r) => setTimeout(r, 10 * 60_000 + 5_000));
    const done = await a1.rpc('complete_study_session', { p_session: ses.id });
    ok(done.data?.status === 'completed' && done.data?.points_awarded === 10, 'finished study session +10');
  } else {
    await a1.rpc('cancel_study_session', { p_session: ses?.id });
    console.log('ℹ️  skipped waiting 10 minutes for +10 (set WAIT_SESSION=1 to include it)');
  }

  // 4. Restore on a new phone
  const a2 = await signInDevice('student A, phone 2');
  const { data: imp } = await a2.rpc('student_login', { p_name: nameA, p_grade: 12, p_pin: '000000' });
  ok(imp?.status === 'wrong_pin', 'wrong PIN refused (no impersonation)');
  const { data: impTasks } = await a2.from('study_tasks').select('id');
  ok(!impTasks || impTasks.length === 0, 'refused device sees none of her data');
  const { data: back } = await a2.rpc('student_login', { p_name: `  ${nameA.toLowerCase()} `, p_grade: 12, p_pin: pinA });
  ok(back?.status === 'ok' && back?.created === false, 'right PIN on another phone opens the same account');
  const { data: stats } = await a2.rpc('get_student_stats');
  const { data: restored } = await a2.from('study_tasks').select('id, completed');
  ok(stats?.total_points >= 30 && restored?.length === 2 && restored.every((t) => t.completed), 'all progress restored after login', `points ${stats?.total_points}`);
  const { data: badges, error: bErr } = await a2.from('achievements').select('id');
  ok(!bErr && badges?.length === 5, 'achievements catalogue readable');

  // 5. Another student is isolated
  const b1 = await signInDevice('student B');
  const { data: regB } = await b1.rpc('student_login', { p_name: nameB, p_grade: 12, p_pin: '424242' });
  ids.push(regB?.profile?.id);
  const { data: seen } = await b1.from('study_tasks').select('id');
  const { data: seenProfiles } = await b1.from('student_profiles').select('id');
  ok(seen?.length === 0 && seenProfiles?.length === 1, 'a student sees only their own records');
  const spy = await b1.rpc('get_weekly_report', { p_week_start: today, p_student: ids[0] });
  ok(!!spy.error, 'a student cannot open another student’s report');
  const notTeacher = await b1.rpc('teacher_list_students', { p_search: null, p_grade: null });
  ok(!!notTeacher.error, 'a student cannot open the teacher list');

  // 6. Signed-out visitors see nothing
  const { data: anonRows, error: anonErr } = await device().from('student_profiles').select('id');
  ok(!!anonErr || !anonRows || anonRows.length === 0, 'signed-out visitors see no student data');

  // 7. Teacher
  const t = await signInDevice('teacher');
  const wrong = await t.rpc('teacher_login', { p_code: 'wrong-code-0000' });
  ok(wrong.data === false, 'wrong teacher code refused');
  const { data: tOk } = await t.rpc('teacher_login', { p_code: teacherCode });
  ok(tOk === true, 'teacher code accepted', tOk === true ? '' : 'Set TEACHER_CODE to the current code');
  if (tOk) {
    const { data: list } = await t.rpc('teacher_list_students', { p_search: `BOUSLA Test ${tag}`, p_grade: 12 });
    const rowA = list?.find((r) => r.id === ids[0]);
    ok(rowA && Number(rowA.tasks_due_done) === 2 && rowA.total_points >= 30, 'teacher sees student progress and task completion');
    const edit = await t.rpc('teacher_update_student', { p_student: ids[1], p_name: `${nameB} edited`, p_grade: 12 });
    ok(!edit.error, 'teacher can correct a student name');
    const { data: hasPin } = await t.rpc('teacher_student_has_pin', { p_student: ids[0] });
    ok(hasPin === true, 'teacher sees the student has a PIN (never the PIN itself)');
    const secrets = await t.from('student_secrets').select('*');
    ok(!!secrets.error, 'PIN hashes are not readable, even by the teacher');
  }
} catch (e) {
  if (e.message !== 'stop') { console.log('❌ unexpected error:', e.message); failed++; }
} finally {
  // Clean up the test students (needs the teacher code).
  try {
    const t = device();
    await t.auth.signInAnonymously();
    const { data: tOk } = await t.rpc('teacher_login', { p_code: teacherCode });
    if (tOk) {
      for (const id of ids.filter(Boolean)) await t.rpc('teacher_delete_student', { p_student: id });
      console.log('🧹 test students removed');
    } else if (ids.filter(Boolean).length) {
      console.log(`⚠️  could not remove test students "BOUSLA Test ${tag}" — delete them from the teacher dashboard`);
    }
  } catch { /* ignore */ }
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll live checks passed ✅');
process.exit(failed ? 1 : 0);
