import {
  ApiError, type Account, type Achievement, type Api, type AppNotification, type NotificationKind,
  type PointsTransaction, type RewardResult, type StudentProfile, type StudySession, type Task, type TaskInput,
  type Lang, type TeacherProfile, type WeeklyReport,
} from './types';
import { ACHIEVEMENT_RULES, REWARDS, computeStreaks, newlyEarned } from '../lib/rewards';
import { addDays, isoDate, taskDateTime, todayIso, weekDays } from '../lib/dates';
import { ACHIEVEMENT_TEXT } from '../i18n/achievements';

/**
 * DEVICE MODE — used only when Supabase is not configured.
 * Data stays in this browser (localStorage). Students sign in with name +
 * grade; the teacher code is checked here on the device. It follows the same
 * reward rules as the server, but because everything runs on the device it is
 * meant for previews and single-device use, not for a class (the UI says so).
 */
type DeviceSessionInfo = { role: 'student' | 'teacher'; id: string };
interface DeviceSession extends StudySession { student_id: string }
interface DevicePoints extends PointsTransaction { student_id: string }
interface DeviceBadge { student_id: string; achievement_id: string; unlocked_at: string }
interface DeviceNotification extends AppNotification { user_id: string; dedupe_key: string | null }
interface DB {
  students: StudentProfile[];
  teachers: TeacherProfile[];
  tasks: Task[];
  sessions: DeviceSession[];
  points: DevicePoints[];
  badges: DeviceBadge[];
  notifications: DeviceNotification[];
  /** PIN hashes and wrong-PIN times per student (same rules as the server). */
  pins?: Record<string, { salt: string; hash: string | null; resetAt: number; fails: number[] }>;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const DB_KEY = 'bousla.device.db.v2';
const SESSION_KEY = 'bousla.device.session.v2';
const ATTEMPTS_KEY = 'bousla.device.teacherAttempts.v1';

/** Same rule as the SQL name_key(): case and extra spaces do not matter. */
export const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const tidyName = (name: string) => name.trim().replace(/\s+/g, ' ');
const empty = (): DB => ({ students: [], teachers: [], tasks: [], sessions: [], points: [], badges: [], notifications: [] });

const uuid = () => (typeof globalThis.crypto?.randomUUID === "function" ? crypto.randomUUID() : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const nowIso = () => new Date().toISOString();
const localDay = (ts: string) => isoDate(new Date(ts));

/** `teacherCode` is for device-only previews; empty = teacher sign-in disabled. The real site checks the code in Supabase. */
export function createDeviceApi(storage: Storage = localStorage, teacherCode = ''): Api {
  const listeners = new Set<(e: string) => void>();
  const emit = (e: string) => listeners.forEach((l) => l(e));

  const load = (): DB => {
    try { return { ...empty(), ...JSON.parse(storage.getItem(DB_KEY) || '{}') }; } catch { return empty(); }
  };
  const save = (db: DB) => storage.setItem(DB_KEY, JSON.stringify(db));
  const session = (): DeviceSessionInfo | null => {
    try { return JSON.parse(storage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  };
  const currentId = () => { const s = session(); return s?.role === 'student' ? s.id : null; };
  const me = (): string => {
    const id = currentId();
    if (!id) throw new ApiError('not_signed_in');
    return id;
  };
  const teacherSignedIn = () => session()?.role === 'teacher';
  const canView = (_db: DB, studentId: string) => {
    if (studentId !== currentId() && !teacherSignedIn()) throw new ApiError('forbidden');
  };
  const student = (db: DB, id: string) => {
    const s = db.students.find((p) => p.id === id);
    if (!s) throw new ApiError('forbidden');
    return s;
  };

  const notify = (db: DB, userId: string, kind: NotificationKind, data: Record<string, unknown>, dedupe: string | null, when = nowIso(), taskId: string | null = null) => {
    if (dedupe && db.notifications.some((n) => n.user_id === userId && n.dedupe_key === dedupe)) return;
    db.notifications.push({ id: uuid(), user_id: userId, kind, data, task_id: taskId, scheduled_for: when, read_at: null, created_at: nowIso(), dedupe_key: dedupe });
  };

  const award = (db: DB, studentId: string, points: number, reason: DevicePoints['reason'], ref: string): number => {
    if (db.points.some((p) => p.student_id === studentId && p.reason === reason && p.ref_key === ref)) return 0;
    db.points.push({ id: uuid(), student_id: studentId, points, reason, ref_key: ref, created_at: nowIso() });
    student(db, studentId).total_points += points;
    return points;
  };

  const progressStats = (db: DB, id: string) => {
    const done = db.sessions.filter((s) => s.student_id === id && s.status === 'completed');
    return {
      sessions_completed: done.length,
      study_minutes: done.reduce((a, s) => a + s.planned_minutes, 0),
      tasks_completed: db.points.filter((p) => p.student_id === id && p.reason === 'task_completed').length,
      total_points: student(db, id).total_points,
      study_streak_days: computeStreaks(done.map((s) => localDay(s.completed_at!)), todayIso()).best,
    };
  };

  const checkAchievements = (db: DB, id: string): string[] => {
    const unlocked = new Set(db.badges.filter((b) => b.student_id === id).map((b) => b.achievement_id));
    const fresh = newlyEarned(progressStats(db, id), ACHIEVEMENT_RULES, unlocked);
    for (const a of fresh) {
      db.badges.push({ student_id: id, achievement_id: a, unlocked_at: nowIso() });
      notify(db, id, 'achievement', { achievement_id: a, icon: ACHIEVEMENT_RULES.find((r) => r.id === a)?.icon }, `achievement:${a}`);
    }
    return fresh;
  };

  const scheduleReminder = (db: DB, t: Task) => {
    db.notifications = db.notifications.filter((n) => !(n.task_id === t.id && !n.read_at && new Date(n.scheduled_for) > new Date()));
    if (t.completed || t.reminder_minutes === null || !t.start_time) return;
    const when = new Date(taskDateTime(t.task_date, t.start_time).getTime() - t.reminder_minutes * 60_000);
    if (when.getTime() < Date.now() - 60_000) return;
    const kind: NotificationKind = t.task_type === 'test' ? 'test_reminder' : t.task_type === 'homework' ? 'homework_reminder' : 'task_reminder';
    notify(db, t.student_id, kind, { title: t.title, subject: t.subject, task_date: t.task_date, start_time: t.start_time, minutes_before: t.reminder_minutes },
      `task:${t.id}:${when.getTime()}`, when.toISOString(), t.id);
  };

  const validateTask = (input: TaskInput) => {
    if (!input.title.trim() || input.title.length > 120) throw new ApiError('invalid_task');
    if (!input.subject.trim() || input.subject.length > 40) throw new ApiError('invalid_task');
    if (input.duration_minutes < 5 || input.duration_minutes > 240) throw new ApiError('invalid_task');
  };

  const total = (db: DB, id: string) => student(db, id).total_points;

  const api = {
    mode: 'device' as const,

    async getAccount(): Promise<Account | null> {
      const ses = session();
      if (!ses) return null;
      const db = load();
      if (ses.role === 'teacher') {
        const teacher = db.teachers.find((t) => t.id === ses.id) ?? { id: ses.id, language: 'ar' as const };
        return { userId: ses.id, role: 'teacher', teacher, student: null };
      }
      const student = db.students.find((s) => s.id === ses.id);
      if (!student) { storage.removeItem(SESSION_KEY); return null; }
      return { userId: ses.id, role: 'student', teacher: null, student };
    },

    onAuthChange(cb: (e: string) => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async studentLogin(name: string, grade: number, pin: string, language: Lang, timezone: string) {
      const full = tidyName(name);
      if (full.length < 2 || full.length > 80) throw new ApiError('invalid_name');
      if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new ApiError('invalid_grade');
      if (!/^[0-9]{4,6}$/.test(pin)) throw new ApiError('invalid_pin');
      const db = load();
      db.pins ??= {};
      let s = db.students.find((x) => nameKey(x.full_name) === nameKey(full) && x.grade === grade);
      const created = !s;
      let pinSet = false;
      if (!s) {
        s = { id: uuid(), full_name: full, grade, language, timezone, custom_subjects: [], total_points: 0, last_seen_at: nowIso(), created_at: nowIso() };
        db.students.push(s);
        notify(db, s.id, 'welcome', { name: full }, 'welcome');
      }
      const now = Date.now();
      const rec = db.pins[s.id] ?? { salt: uuid(), hash: null, resetAt: 0, fails: [] };
      const since = Math.max(rec.resetAt, now - 86_400_000);
      const recent = rec.fails.filter((t) => t > since);
      if (recent.filter((t) => t > Math.max(since, now - 15 * 60_000)).length >= 5 || recent.length >= 20) throw new ApiError('pin_locked');
      if (!rec.hash) {
        rec.salt = uuid();
        rec.hash = await hashPin(pin, rec.salt);
        pinSet = true;
      } else if ((await hashPin(pin, rec.salt)) !== rec.hash) {
        rec.fails = [...recent, now];
        db.pins[s.id] = rec;
        save(db);
        throw new ApiError('wrong_pin');
      }
      db.pins[s.id] = rec;
      s.last_seen_at = nowIso();
      save(db);
      storage.setItem(SESSION_KEY, JSON.stringify({ role: 'student', id: s.id }));
      emit('SIGNED_IN');
      return { created, pinSet };
    },

    async teacherLogin(code: string) {
      const since = Date.now() - 15 * 60_000;
      let fails: number[] = [];
      try { fails = (JSON.parse(storage.getItem(ATTEMPTS_KEY) || '[]') as number[]).filter((x) => x > since); } catch { /* ignore */ }
      if (fails.length >= 5) throw new ApiError('too_many_attempts');
      if (!teacherCode || code.trim() !== teacherCode) {
        storage.setItem(ATTEMPTS_KEY, JSON.stringify([...fails, Date.now()]));
        throw new ApiError('invalid_code');
      }
      storage.removeItem(ATTEMPTS_KEY);
      const db = load();
      const id = uuid();
      db.teachers.push({ id, language: 'ar' });
      save(db);
      storage.setItem(SESSION_KEY, JSON.stringify({ role: 'teacher', id }));
      emit('SIGNED_IN');
    },

    async signOut() {
      storage.removeItem(SESSION_KEY);
      emit('SIGNED_OUT');
    },

    async updateProfile(patch: Parameters<Api['updateProfile']>[0]) {
      const db = load();
      const s = student(db, me());
      const nextName = patch.full_name !== undefined ? tidyName(patch.full_name) : s.full_name;
      const nextGrade = patch.grade ?? s.grade;
      if (nextName.length < 2 || nextName.length > 80) throw new ApiError('invalid_name');
      if (!Number.isInteger(nextGrade) || nextGrade < 1 || nextGrade > 12) throw new ApiError('invalid_grade');
      if (db.students.some((o) => o.id !== s.id && o.grade === nextGrade && nameKey(o.full_name) === nameKey(nextName))) throw new ApiError('name_taken');
      s.full_name = nextName;
      s.grade = nextGrade;
      if (patch.language) s.language = patch.language;
      if (patch.custom_subjects) s.custom_subjects = patch.custom_subjects.slice(0, 20);
      save(db);
      return { ...s };
    },

    async updateTeacherProfile(patch: Parameters<Api['updateTeacherProfile']>[0]) {
      const db = load();
      const ses = session();
      const t = db.teachers.find((x) => x.id === ses?.id);
      if (!t || ses?.role !== 'teacher') throw new ApiError('forbidden');
      Object.assign(t, patch);
      save(db);
      return { ...t };
    },

    async listTasks(from: string, to: string, studentId?: string) {
      const db = load();
      const id = studentId ?? me();
      canView(db, id);
      return db.tasks
        .filter((t) => t.student_id === id && t.task_date >= from && t.task_date <= to)
        .sort((a, b) => (a.task_date + (a.start_time ?? '99')).localeCompare(b.task_date + (b.start_time ?? '99')));
    },

    async createTask(input: TaskInput) {
      validateTask(input);
      const db = load();
      const id = me();
      student(db, id);
      const t: Task = { ...input, id: uuid(), student_id: id, completed: false, completed_at: null, created_at: nowIso() };
      db.tasks.push(t);
      scheduleReminder(db, t);
      save(db);
      return t;
    },

    async updateTask(taskId: string, input: TaskInput) {
      validateTask(input);
      const db = load();
      const t = db.tasks.find((x) => x.id === taskId && x.student_id === me());
      if (!t) throw new ApiError('not_found');
      Object.assign(t, input);
      scheduleReminder(db, t);
      save(db);
      return { ...t };
    },

    async deleteTask(taskId: string) {
      const db = load();
      const id = me();
      db.tasks = db.tasks.filter((t) => !(t.id === taskId && t.student_id === id));
      db.notifications = db.notifications.filter((n) => n.task_id !== taskId);
      save(db);
    },

    async setTaskCompleted(taskId: string, completed: boolean): Promise<RewardResult> {
      const db = load();
      const id = me();
      const t = db.tasks.find((x) => x.id === taskId && x.student_id === id);
      if (!t) throw new ApiError('not_found');
      t.completed = completed;
      t.completed_at = completed ? nowIso() : null;
      let points = 0;
      let bonus = 0;
      let badges: string[] = [];
      if (completed) {
        scheduleReminder(db, t);
        const today = todayIso();
        const paidToday = db.points.filter((p) => p.student_id === id && p.reason === 'task_completed' && localDay(p.created_at) === today).length;
        if (paidToday < REWARDS.dailyPaidTaskCap) points = award(db, id, REWARDS.taskPoints, 'task_completed', t.id);
        if (t.task_date >= addDays(today, -1) && t.task_date <= today) {
          const day = db.tasks.filter((x) => x.student_id === id && x.task_date === t.task_date);
          if (day.length >= REWARDS.dailyBonusMinTasks && day.every((x) => x.completed)) {
            bonus = award(db, id, REWARDS.dailyBonusPoints, 'daily_bonus', t.task_date);
            if (bonus) notify(db, id, 'daily_bonus', { date: t.task_date, points: bonus }, `bonus:${t.task_date}`);
          }
        }
        badges = checkAchievements(db, id);
      }
      save(db);
      return { points_awarded: points, bonus_awarded: bonus, new_achievements: badges, total_points: total(db, id) };
    },

    async startSession(minutes: number, subject: string | null) {
      if (minutes < REWARDS.minSessionMinutes || minutes > REWARDS.maxSessionMinutes) throw new ApiError('invalid_duration');
      const db = load();
      const id = me();
      student(db, id);
      db.sessions.forEach((s) => { if (s.student_id === id && s.status === 'active') s.status = 'cancelled'; });
      const s: DeviceSession = { id: uuid(), student_id: id, subject, planned_minutes: minutes, status: 'active', started_at: nowIso(), completed_at: null };
      db.sessions.push(s);
      save(db);
      return { ...s };
    },

    async completeSession(sessionId: string) {
      const db = load();
      const id = me();
      const s = db.sessions.find((x) => x.id === sessionId && x.student_id === id);
      if (!s) throw new ApiError('not_found');
      if (s.status === 'completed') return { status: 'already_completed' as const, points_awarded: 0, bonus_awarded: 0, new_achievements: [], total_points: total(db, id) };
      if (s.status === 'cancelled') throw new ApiError('session_cancelled');
      const needed = s.planned_minutes * 60 - REWARDS.completionToleranceSec;
      const elapsed = (Date.now() - new Date(s.started_at).getTime()) / 1000;
      if (elapsed < needed) return { status: 'too_early' as const, remaining_seconds: Math.ceil(needed - elapsed) };
      s.status = 'completed';
      s.completed_at = nowIso();
      const points = award(db, id, REWARDS.sessionPoints, 'study_session', s.id);
      notify(db, id, 'session_complete', { minutes: s.planned_minutes, subject: s.subject, points }, `session:${s.id}`);
      const badges = checkAchievements(db, id);
      save(db);
      return { status: 'completed' as const, points_awarded: points, bonus_awarded: 0, new_achievements: badges, total_points: total(db, id) };
    },

    async cancelSession(sessionId: string) {
      const db = load();
      const s = db.sessions.find((x) => x.id === sessionId && x.student_id === me() && x.status === 'active');
      if (s) { s.status = 'cancelled'; save(db); }
    },

    async listSessions(from: string, to: string, studentId?: string) {
      const db = load();
      const id = studentId ?? me();
      canView(db, id);
      return db.sessions.filter((s) => s.student_id === id && s.status === 'completed' && localDay(s.completed_at!) >= from && localDay(s.completed_at!) <= to);
    },

    async getStats(studentId?: string) {
      const db = load();
      const id = studentId ?? me();
      canView(db, id);
      const today = todayIso();
      const done = db.sessions.filter((s) => s.student_id === id && s.status === 'completed');
      const streak = computeStreaks(done.map((s) => localDay(s.completed_at!)), today);
      const todays = db.tasks.filter((t) => t.student_id === id && t.task_date === today);
      return {
        total_points: student(db, id).total_points,
        sessions_completed: done.length,
        study_minutes: done.reduce((a, s) => a + s.planned_minutes, 0),
        tasks_completed: db.tasks.filter((t) => t.student_id === id && t.completed).length,
        tasks_due: db.tasks.filter((t) => t.student_id === id && t.task_date <= today).length,
        tasks_due_done: db.tasks.filter((t) => t.student_id === id && t.task_date <= today && t.completed).length,
        today_planned: todays.length,
        today_completed: todays.filter((t) => t.completed).length,
        today_minutes: done.filter((s) => localDay(s.completed_at!) === today).reduce((a, s) => a + s.planned_minutes, 0),
        best_streak: streak.best,
        current_streak: streak.current,
        last_active: student(db, id).last_seen_at,
        today,
      };
    },

    async listAchievements(): Promise<Achievement[]> {
      return ACHIEVEMENT_RULES.map((r) => ({ ...r, ...ACHIEVEMENT_TEXT[r.id] }));
    },

    async listStudentAchievements(studentId?: string) {
      const db = load();
      const id = studentId ?? me();
      canView(db, id);
      return db.badges.filter((b) => b.student_id === id).map(({ achievement_id, unlocked_at }) => ({ achievement_id, unlocked_at }));
    },

    async listPoints(limit: number, studentId?: string) {
      const db = load();
      const id = studentId ?? me();
      canView(db, id);
      return db.points.filter((p) => p.student_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
    },

    async listNotifications() {
      const id = me();
      return load().notifications.filter((n) => n.user_id === id).sort((a, b) => b.scheduled_for.localeCompare(a.scheduled_for)).slice(0, 100);
    },

    async markNotificationsRead(ids: string[]) {
      const db = load();
      const id = me();
      db.notifications.forEach((n) => { if (n.user_id === id && ids.includes(n.id) && !n.read_at) n.read_at = nowIso(); });
      save(db);
    },

    async deleteNotification(nid: string) {
      const db = load();
      const id = me();
      db.notifications = db.notifications.filter((n) => !(n.id === nid && n.user_id === id));
      save(db);
    },

    async ensureDailyReminder() {
      const db = load();
      const id = currentId();
      if (!id || !db.students.some((s) => s.id === id)) return;
      const today = todayIso();
      const open = db.tasks.filter((t) => t.student_id === id && t.task_date === today && !t.completed).length;
      notify(db, id, 'daily_reminder', { date: today, open_tasks: open }, `daily:${today}`);
      save(db);
    },

    async getWeeklyReport(weekStart: string, studentId?: string): Promise<WeeklyReport> {
      const db = load();
      const id = studentId ?? me();
      canView(db, id);
      const days = weekDays(weekStart);
      const end = days[6];
      const inWeek = (ts: string | null) => !!ts && localDay(ts) >= weekStart && localDay(ts) <= end;
      const ses = db.sessions.filter((s) => s.student_id === id && s.status === 'completed' && inWeek(s.completed_at));
      const tsk = db.tasks.filter((t) => t.student_id === id && t.completed && inWeek(t.completed_at));
      const pts = db.points.filter((p) => p.student_id === id && inWeek(p.created_at));
      const subjectMinutes = new Map<string, number>();
      ses.forEach((s) => { if (s.subject) subjectMinutes.set(s.subject, (subjectMinutes.get(s.subject) ?? 0) + s.planned_minutes); });
      const weight = new Map(subjectMinutes);
      tsk.forEach((t) => weight.set(t.subject, (weight.get(t.subject) ?? 0) + 15));
      const top = [...weight.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
      return {
        week_start: weekStart,
        week_end: end,
        study_minutes: ses.reduce((a, s) => a + s.planned_minutes, 0),
        sessions_completed: ses.length,
        tasks_completed: tsk.length,
        tasks_planned: db.tasks.filter((t) => t.student_id === id && t.task_date >= weekStart && t.task_date <= end).length,
        points_earned: pts.reduce((a, p) => a + p.points, 0),
        top_subject: top,
        subjects: [...subjectMinutes.entries()].map(([subject, minutes]) => ({ subject, minutes })).sort((a, b) => b.minutes - a.minutes),
        days: days.map((d) => ({
          date: d,
          minutes: ses.filter((s) => localDay(s.completed_at!) === d).reduce((a, s) => a + s.planned_minutes, 0),
          sessions: ses.filter((s) => localDay(s.completed_at!) === d).length,
          tasks: tsk.filter((t) => localDay(t.completed_at!) === d).length,
          points: pts.filter((p) => localDay(p.created_at) === d).reduce((a, p) => a + p.points, 0),
        })),
        badges: db.badges.filter((b) => b.student_id === id && inWeek(b.unlocked_at)).map((b) => b.achievement_id),
      };
    },

    async listStudents(search?: string, grade?: number) {
      if (!teacherSignedIn()) throw new ApiError('forbidden');
      const db = load();
      const q = (search ?? '').trim().toLowerCase();
      const weekAgo = Date.now() - 7 * 86_400_000;
      const today = todayIso();
      const weekFrom = addDays(today, -6);
      return db.students
        .filter((s) => (!grade || s.grade === grade) && (!q || s.full_name.toLowerCase().includes(q)))
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map((s) => {
          const done = db.sessions.filter((x) => x.student_id === s.id && x.status === 'completed');
          const recent = done.filter((x) => new Date(x.completed_at!).getTime() >= weekAgo);
          const tasks = db.tasks.filter((t) => t.student_id === s.id);
          const due = tasks.filter((t) => t.task_date <= today);
          const week = tasks.filter((t) => t.task_date >= weekFrom && t.task_date <= today);
          const activeDays = new Set([
            ...recent.map((x) => localDay(x.completed_at!)),
            ...tasks.filter((t) => t.completed && new Date(t.completed_at!).getTime() >= weekAgo).map((t) => localDay(t.completed_at!)),
          ]);
          return {
            id: s.id, full_name: s.full_name, grade: s.grade, total_points: s.total_points,
            sessions_completed: done.length,
            study_minutes: done.reduce((a, x) => a + x.planned_minutes, 0),
            week_minutes: recent.reduce((a, x) => a + x.planned_minutes, 0),
            week_sessions: recent.length,
            active_days_week: activeDays.size,
            tasks_planned: tasks.length,
            tasks_done: tasks.filter((t) => t.completed).length,
            tasks_due: due.length,
            tasks_due_done: due.filter((t) => t.completed).length,
            week_tasks_due: week.length,
            week_tasks_done: week.filter((t) => t.completed).length,
            overdue_tasks: tasks.filter((t) => t.task_date < today && !t.completed).length,
            badges: db.badges.filter((b) => b.student_id === s.id).length,
            current_streak: computeStreaks(done.map((x) => localDay(x.completed_at!)), today).current,
            last_active: s.last_seen_at,
            joined_at: s.created_at,
          };
        });
    },

    async getStudentProfile(id: string) {
      const db = load();
      canView(db, id);
      return db.students.find((s) => s.id === id) ?? null;
    },

    async teacherUpdateStudent(id: string, name: string, grade: number) {
      if (!teacherSignedIn()) throw new ApiError('forbidden');
      const full = tidyName(name);
      if (full.length < 2 || full.length > 80) throw new ApiError('invalid_name');
      if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new ApiError('invalid_grade');
      const db = load();
      const s = db.students.find((x) => x.id === id);
      if (!s) throw new ApiError('not_found');
      if (db.students.some((o) => o.id !== id && o.grade === grade && nameKey(o.full_name) === nameKey(full))) throw new ApiError('name_taken');
      s.full_name = full;
      s.grade = grade;
      save(db);
      return { ...s };
    },

    async teacherStudentHasPin(id: string) {
      if (!teacherSignedIn()) throw new ApiError('forbidden');
      return !!load().pins?.[id]?.hash;
    },

    async teacherResetStudentPin(id: string) {
      if (!teacherSignedIn()) throw new ApiError('forbidden');
      const db = load();
      if (!db.students.some((x) => x.id === id)) throw new ApiError('not_found');
      db.pins ??= {};
      db.pins[id] = { salt: uuid(), hash: null, resetAt: Date.now(), fails: [] };
      save(db);
    },

    async teacherDeleteStudent(id: string) {
      if (!teacherSignedIn()) throw new ApiError('forbidden');
      const db = load();
      if (!db.students.some((x) => x.id === id)) throw new ApiError('not_found');
      db.students = db.students.filter((x) => x.id !== id);
      db.tasks = db.tasks.filter((x) => x.student_id !== id);
      db.sessions = db.sessions.filter((x) => x.student_id !== id);
      db.points = db.points.filter((x) => x.student_id !== id);
      db.badges = db.badges.filter((x) => x.student_id !== id);
      db.notifications = db.notifications.filter((x) => x.user_id !== id);
      if (db.pins) delete db.pins[id];
      save(db);
    },
  };
  return api;
}
