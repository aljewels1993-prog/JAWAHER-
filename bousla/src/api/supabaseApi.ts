import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ApiError, type Account, type Api, type AppNotification, type CompleteSessionResult, type ProfilePatch,
  type RewardResult, type SignUpInput, type StudentProfile, type StudySession, type Task, type TaskInput,
  type TeacherPatch, type TeacherProfile,
} from './types';

/**
 * Cloud backend: Supabase Auth + Postgres. All rules (ownership, points,
 * badges, roles) are enforced by RLS and SQL functions on the server; this
 * class only forwards requests. Only the public anon key is used here.
 */
export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });

  const fail = (error: { message?: string; code?: string } | null): never => {
    const msg = (error?.message || '').toLowerCase();
    const code = error?.code || '';
    if (code === 'invalid_credentials' || msg.includes('invalid login')) throw new ApiError('invalid_credentials');
    if (code === 'email_not_confirmed' || msg.includes('not confirmed')) throw new ApiError('email_not_confirmed');
    if (code === 'user_already_exists' || msg.includes('already registered')) throw new ApiError('email_taken');
    if (code === 'weak_password' || msg.includes('password should')) throw new ApiError('weak_password');
    if (code.startsWith('over_') || msg.includes('rate limit')) throw new ApiError('rate_limited');
    if (code === '23505' || msg.includes('duplicate key')) throw new ApiError('username_taken');
    if (code === '42501' || msg.includes('forbidden') || msg.includes('permission denied')) throw new ApiError('forbidden');
    if (msg.includes('failed to fetch') || msg.includes('network')) throw new ApiError('network');
    throw new ApiError('unknown', error?.message);
  };

  const uid = async (): Promise<string> => {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new ApiError('not_signed_in');
    return id;
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
      const [{ data: teacher }, { data: student }] = await Promise.all([
        sb.from('teacher_profiles').select('*').eq('id', user.id).maybeSingle(),
        sb.from('student_profiles').select('*').eq('id', user.id).maybeSingle(),
      ]);
      return {
        userId: user.id,
        email: user.email ?? null,
        role: teacher ? 'teacher' : 'student',
        teacher: (teacher as TeacherProfile) ?? null,
        student: (student as StudentProfile) ?? null,
      };
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => cb(event));
      return () => data.subscription.unsubscribe();
    },

    async signUp(input: SignUpInput) {
      const { data, error } = await sb.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          emailRedirectTo: `${location.origin}/login`,
          data: { full_name: input.fullName.trim(), username: input.username.trim().toLowerCase(), language: input.language, timezone: input.timezone },
        },
      });
      if (error) fail(error);
      // With e-mail confirmation on, an existing address returns a user without identities.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new ApiError('email_taken');
      return { needsConfirmation: !data.session };
    },

    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) fail(error);
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async requestPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/reset-password` });
      if (error) fail(error);
    },

    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) fail(error);
    },

    async usernameAvailable(username) {
      return rpc<boolean>('username_available', { p_username: username.trim().toLowerCase() });
    },

    async updateProfile(patch: ProfilePatch) {
      const id = await uid();
      const { data, error } = await sb.from('student_profiles').update(patch).eq('id', id).select('*').single();
      if (error) fail(error);
      return data as StudentProfile;
    },

    async updateTeacherProfile(patch: TeacherPatch) {
      const id = await uid();
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

    async listStudents(search) {
      return rpc('teacher_list_students', { p_search: search?.trim() || null });
    },

    async getStudentProfile(id) {
      const { data, error } = await sb.from('student_profiles').select('*').eq('id', id).maybeSingle();
      if (error) fail(error);
      return (data as StudentProfile) ?? null;
    },
  };
}
