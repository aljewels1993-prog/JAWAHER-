import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ApiError, type Account, type Api, type AppNotification, type CompleteSessionResult, type ProfilePatch,
  type RewardResult, type StudentProfile, type StudySession, type Task, type TaskInput,
  type TeacherPatch, type TeacherProfile,
} from './types';

/**
 * Cloud backend: Supabase Auth (anonymous device sessions) + Postgres.
 * Students sign in with name + grade, teachers with a code; both are
 * checked by SQL functions. All rules (ownership, points,
 * badges, roles) are enforced by RLS and SQL functions on the server; this
 * class only forwards requests. Only the public anon key is used here.
 */
export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const fail = (error: { message?: string; code?: string } | null): never => {
    const msg = (error?.message || '').toLowerCase();
    const code = error?.code || '';
    for (const known of ['invalid_name', 'invalid_grade', 'invalid_pin', 'pin_locked', 'too_many_attempts', 'name_taken', 'student_not_found']) if (msg.includes(known)) throw new ApiError(known);
    if (msg.includes('anonymous sign-ins are disabled')) throw new ApiError('anon_disabled');
    if (msg.includes('invalid api key') || msg.includes('no api key') || (error as { status?: number } | null)?.status === 401) throw new ApiError('bad_key');
    if (code.startsWith('over_') || msg.includes('rate limit')) throw new ApiError('rate_limited');
    if (code === '23505' || msg.includes('duplicate key')) throw new ApiError('name_taken');
    if (code === '42501' || msg.includes('forbidden') || msg.includes('permission denied')) throw new ApiError('forbidden');
    if (msg.includes('failed to fetch') || msg.includes('network')) throw new ApiError('network');
    throw new ApiError('unknown', error?.message);
  };

  /** Makes sure this device has a (private, anonymous) Supabase session. */
  const ensureSession = async () => {
    const { data } = await sb.auth.getSession();
    if (data.session) return;
    const { error } = await sb.auth.signInAnonymously();
    if (error) fail(error);
  };

  /** The signed-in student's id (a non-teacher can only read their own profile row). */
  const uid = async (): Promise<string> => {
    const { data, error } = await sb.rpc('current_student_id');
    if (error) fail(error);
    if (!data) throw new ApiError('not_signed_in');
    return data as string;
  };

  const normTask = (t: Task): Task => ({ ...t, start_time: t.start_time ? t.start_time.slice(0, 5) : null });

  const rpc = async <T>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) fail(error);
    return data as T;
  };

  return {
    mode: 'cloud',

    async getAccount(): Promise<Account | null> {
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      const { data: teacher } = await sb.from('teacher_profiles').select('*').eq('id', user.id).maybeSingle();
      let student: StudentProfile | null = null;
      if (!teacher) {
        const { data: sid } = await sb.rpc('current_student_id');
        if (!sid) return null; // device session exists but nobody has signed in on it
        const { data } = await sb.from('student_profiles').select('*').eq('id', sid).maybeSingle();
        student = (data as StudentProfile) ?? null;
        if (!student) return null;
      }
      return {
        userId: user.id,
        role: teacher ? 'teacher' : 'student',
        teacher: (teacher as TeacherProfile) ?? null,
        student: (student as StudentProfile) ?? null,
      };
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => cb(event));
      return () => data.subscription.unsubscribe();
    },

    async studentLogin(name, grade, pin, language, timezone) {
      await ensureSession();
      const r = await rpc<{ status: string; created?: boolean; pin_set?: boolean }>('student_login',
        { p_name: name, p_grade: grade, p_pin: pin, p_language: language, p_timezone: timezone });
      if (r.status === 'wrong_pin') throw new ApiError('wrong_pin');
      return { created: !!r.created, pinSet: !!r.pin_set };
    },

    async teacherLogin(code) {
      await ensureSession();
      const ok = await rpc<boolean>('teacher_login', { p_code: code });
      if (!ok) throw new ApiError('invalid_code');
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async updateProfile(patch: ProfilePatch) {
      const id = await uid();
      const { data, error } = await sb.from('student_profiles').update(patch).eq('id', id).select('*').single();
      if (error) fail(error);
      return data as StudentProfile;
    },

    async updateTeacherProfile(patch: TeacherPatch) {
      const { data: auth } = await sb.auth.getSession();
      const id = auth.session?.user.id;
      if (!id) throw new ApiError('not_signed_in');
      const { data, error } = await sb.from('teacher_profiles').update(patch).eq('id', id).select('*').single();
      if (error) fail(error);
      return data as TeacherProfile;
    },

    async listTasks(from, to, studentId) {
      const id = studentId ?? (await uid());
      const { data, error } = await sb.from('study_tasks').select('*').eq('student_id', id)
        .gte('task_date', from).lte('task_date', to)
        .order('task_date').order('start_time', { nullsFirst: false });
      if (error) fail(error);
      return (data as Task[]).map(normTask);
    },

    async createTask(input: TaskInput) {
      const { data, error } = await sb.from('study_tasks').insert(input).select('*').single();
      if (error) fail(error);
      return normTask(data as Task);
    },

    async updateTask(id, input: TaskInput) {
      const { data, error } = await sb.from('study_tasks').update(input).eq('id', id).select('*').single();
      if (error) fail(error);
      return normTask(data as Task);
    },

    async deleteTask(id) {
      const { error } = await sb.from('study_tasks').delete().eq('id', id);
      if (error) fail(error);
    },

    async setTaskCompleted(id, completed) {
      return rpc<RewardResult>('set_task_completed', { p_task: id, p_completed: completed });
    },

    async startSession(minutes, subject) {
      return rpc<StudySession>('start_study_session', { p_minutes: minutes, p_subject: subject });
    },

    async completeSession(id) {
      return rpc<CompleteSessionResult>('complete_study_session', { p_session: id });
    },

    async cancelSession(id) {
      await rpc('cancel_study_session', { p_session: id });
    },

    async listSessions(from, to, studentId) {
      const id = studentId ?? (await uid());
      const { data, error } = await sb.from('study_sessions').select('*').eq('student_id', id).eq('status', 'completed')
        .gte('completed_at', `${from}T00:00:00`).lte('completed_at', `${to}T23:59:59`).order('completed_at', { ascending: false });
      if (error) fail(error);
      return data as StudySession[];
    },

    async getStats(studentId) {
      return rpc('get_student_stats', { p_student: studentId ?? null });
    },

    async listAchievements() {
      const { data, error } = await sb.from('achievements').select('*').order('sort_order');
      if (error) fail(error);
      return data ?? [];
    },

    async listStudentAchievements(studentId) {
      const id = studentId ?? (await uid());
      const { data, error } = await sb.from('student_achievements').select('achievement_id, unlocked_at').eq('student_id', id).order('unlocked_at');
      if (error) fail(error);
      return data ?? [];
    },

    async listPoints(limit, studentId) {
      const id = studentId ?? (await uid());
      const { data, error } = await sb.from('points_transactions').select('id, points, reason, ref_key, created_at')
        .eq('student_id', id).order('created_at', { ascending: false }).limit(limit);
      if (error) fail(error);
      return data ?? [];
    },

    async listNotifications() {
      const { data, error } = await sb.from('notifications').select('*').order('scheduled_for', { ascending: false }).limit(100);
      if (error) fail(error);
      return (data ?? []) as AppNotification[];
    },

    async markNotificationsRead(ids) {
      if (!ids.length) return;
      const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
      if (error) fail(error);
    },

    async deleteNotification(id) {
      const { error } = await sb.from('notifications').delete().eq('id', id);
      if (error) fail(error);
    },

    async ensureDailyReminder() {
      await rpc('ensure_daily_reminder');
    },

    async getWeeklyReport(weekStart, studentId) {
      return rpc('get_weekly_report', { p_week_start: weekStart, p_student: studentId ?? null });
    },

    async listStudents(search, grade) {
      return rpc('teacher_list_students', { p_search: search?.trim() || null, p_grade: grade ?? null });
    },

    async getStudentProfile(id) {
      const { data, error } = await sb.from('student_profiles').select('*').eq('id', id).maybeSingle();
      if (error) fail(error);
      return (data as StudentProfile) ?? null;
    },

    async teacherUpdateStudent(id, name, grade) {
      return rpc<StudentProfile>('teacher_update_student', { p_student: id, p_name: name, p_grade: grade });
    },

    async teacherDeleteStudent(id) {
      await rpc('teacher_delete_student', { p_student: id });
    },

    async teacherStudentHasPin(id) {
      return rpc<boolean>('teacher_student_has_pin', { p_student: id });
    },

    async teacherResetStudentPin(id) {
      await rpc('teacher_reset_student_pin', { p_student: id });
    },
  };
}
