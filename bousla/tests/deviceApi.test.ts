import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeviceApi } from '../src/api/deviceApi';
import { todayIso } from '../src/lib/dates';
import type { TaskInput } from '../src/api/types';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; }, clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k)! : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
  };
}

const task = (over: Partial<TaskInput> = {}): TaskInput => ({
  subject: 'Mathematics', title: 'Fractions', description: null, task_type: 'homework', task_date: todayIso(),
  start_time: null, duration_minutes: 30, priority: 'medium', reminder_minutes: null, ...over,
});

const login = (api: ReturnType<typeof createDeviceApi>, name = 'Alia Salim', grade = 5) => api.studentLogin(name, grade, 'en', 'Asia/Muscat');

describe('device backend rewards', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 10, 15, 0)); });
  afterEach(() => vi.useRealTimers());

  it('signs students in with name + grade and finds them again', async () => {
    const api = createDeviceApi(memoryStorage());
    await expect(api.studentLogin('A', 5, 'ar', 'Asia/Muscat')).rejects.toMatchObject({ code: 'invalid_name' });
    await expect(api.studentLogin('Alia', 13, 'ar', 'Asia/Muscat')).rejects.toMatchObject({ code: 'invalid_grade' });
    expect(await login(api)).toEqual({ created: true });
    await api.createTask(task());
    await api.signOut();
    expect(await api.getAccount()).toBeNull();
    expect(await login(api, '  alia   SALIM ')).toEqual({ created: false });
    expect(await api.listTasks('2000-01-01', '2100-01-01')).toHaveLength(1);
    expect((await api.getAccount())?.student).toMatchObject({ full_name: 'Alia Salim', grade: 5 });
    await api.signOut();
    expect(await login(api, 'Alia Salim', 6)).toEqual({ created: true });
    expect(await api.listTasks('2000-01-01', '2100-01-01')).toHaveLength(0);
  });

  it('checks the teacher code and blocks guessing', async () => {
    const api = createDeviceApi(memoryStorage(), '1993');
    await expect(api.teacherLogin('0000')).rejects.toMatchObject({ code: 'invalid_code' });
    for (let i = 0; i < 4; i++) await api.teacherLogin('1111').catch(() => {});
    await expect(api.teacherLogin('1993')).rejects.toMatchObject({ code: 'too_many_attempts' });
    vi.setSystemTime(new Date(2026, 10, 10, 15, 20));
    await api.teacherLogin('1993');
    expect((await api.getAccount())?.role).toBe('teacher');
  });

  it('pays +5 per task once and +20 when the whole day is done', async () => {
    const api = createDeviceApi(memoryStorage());
    await login(api);
    const a = await api.createTask(task());
    const b = await api.createTask(task({ title: 'Read' }));
    expect((await api.setTaskCompleted(a.id, true)).points_awarded).toBe(5);
    expect((await api.setTaskCompleted(a.id, true)).points_awarded).toBe(0);
    await api.setTaskCompleted(a.id, false);
    expect((await api.setTaskCompleted(a.id, true)).points_awarded).toBe(0);
    const r = await api.setTaskCompleted(b.id, true);
    expect(r).toMatchObject({ points_awarded: 5, bonus_awarded: 20, total_points: 30 });
    await api.setTaskCompleted(b.id, false);
    expect((await api.setTaskCompleted(b.id, true)).bonus_awarded).toBe(0);
  });

  it('pays a study session only after its time has passed, and only once', async () => {
    const api = createDeviceApi(memoryStorage());
    await login(api);
    await expect(api.startSession(5, null)).rejects.toMatchObject({ code: 'invalid_duration' });
    const s = await api.startSession(25, 'Science');
    expect((await api.completeSession(s.id)).status).toBe('too_early');
    vi.setSystemTime(new Date(2026, 10, 10, 15, 25));
    const done = await api.completeSession(s.id);
    expect(done).toMatchObject({ status: 'completed', points_awarded: 10 });
    expect(await api.completeSession(s.id)).toMatchObject({ status: 'already_completed', points_awarded: 0 });
    const report = await api.getWeeklyReport('2026-11-08');
    expect(report).toMatchObject({ study_minutes: 25, sessions_completed: 1, points_earned: 10, top_subject: 'Science' });
  });

  it('keeps students apart and shows the teacher who finishes planned tasks', async () => {
    const api = createDeviceApi(memoryStorage(), '1993');
    await login(api);
    const done = await api.createTask(task());
    await api.createTask(task({ title: 'Old homework', task_date: '2026-11-08' }));
    await api.createTask(task({ title: 'Next week', task_date: '2026-11-20' }));
    await api.setTaskCompleted(done.id, true);
    await api.signOut();
    await login(api, 'Badr Said', 5);
    expect(await api.listTasks('2000-01-01', '2100-01-01')).toHaveLength(0);
    await expect(api.listStudents()).rejects.toMatchObject({ code: 'forbidden' });
    await api.signOut();
    await api.teacherLogin('1993');
    const rows = await api.listStudents(undefined, 5);
    expect(rows.map((r) => r.full_name)).toEqual(['Alia Salim', 'Badr Said']);
    expect(rows[0]).toMatchObject({ tasks_planned: 3, tasks_due: 2, tasks_due_done: 1, overdue_tasks: 1, grade: 5 });
    expect(await api.listStudents(undefined, 6)).toHaveLength(0);
    expect(await api.listStudents('badr')).toHaveLength(1);

    // Teacher manages students: rename/move grade, refuse duplicates, delete with all data.
    const badr = (await api.listStudents('badr'))[0];
    expect(await api.teacherUpdateStudent(badr.id, ' Badr  Said Al-Harthy ', 6)).toMatchObject({ full_name: 'Badr Said Al-Harthy', grade: 6 });
    await expect(api.teacherUpdateStudent(badr.id, 'alia salim', 5)).rejects.toMatchObject({ code: 'name_taken' });
    await api.teacherDeleteStudent(rows[0].id);
    expect((await api.listStudents()).map((r) => r.full_name)).toEqual(['Badr Said Al-Harthy']);
    await api.signOut();
    await expect(api.teacherDeleteStudent(badr.id)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('schedules a reminder before the task start time', async () => {
    const api = createDeviceApi(memoryStorage());
    await login(api);
    await api.createTask(task({ task_type: 'test', start_time: '17:00', reminder_minutes: 30 }));
    const n = (await api.listNotifications()).find((x) => x.kind === 'test_reminder');
    expect(new Date(n!.scheduled_for).getHours()).toBe(16);
    expect(new Date(n!.scheduled_for).getMinutes()).toBe(30);
  });
});
