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

const signup = { fullName: 'Alia Salim', username: 'alia', email: 'alia@example.com', password: 'secret123', language: 'en' as const, timezone: 'Asia/Muscat' };

describe('device backend rewards', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 10, 15, 0)); });
  afterEach(() => vi.useRealTimers());

  it('never stores the password in plain text', async () => {
    const store = memoryStorage();
    const api = createDeviceApi(store);
    await api.signUp(signup);
    expect(JSON.stringify([...Array(store.length)].map((_, i) => store.getItem(store.key(i)!)))).not.toContain('secret123');
    await api.signOut();
    await expect(api.signIn('alia@example.com', 'wrong-pass')).rejects.toMatchObject({ code: 'invalid_credentials' });
    await api.signIn('alia@example.com', 'secret123');
    expect((await api.getAccount())?.student?.username).toBe('alia');
  });

  it('pays +5 per task once and +20 when the whole day is done', async () => {
    const api = createDeviceApi(memoryStorage());
    await api.signUp(signup);
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
    await api.signUp(signup);
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

  it('keeps students apart and the teacher list private', async () => {
    const store = memoryStorage();
    const api = createDeviceApi(store);
    await api.signUp(signup);
    await api.createTask(task());
    await api.signOut();
    await api.signUp({ ...signup, username: 'badr', email: 'badr@example.com' });
    expect(await api.listTasks('2000-01-01', '2100-01-01')).toHaveLength(0);
    await expect(api.listStudents()).rejects.toMatchObject({ code: 'forbidden' });
    api.promoteToTeacher('badr@example.com');
    expect((await api.listStudents()).map((s) => s.username)).toEqual(['alia']);
  });

  it('schedules a reminder before the task start time', async () => {
    const api = createDeviceApi(memoryStorage());
    await api.signUp(signup);
    await api.createTask(task({ task_type: 'test', start_time: '17:00', reminder_minutes: 30 }));
    const n = (await api.listNotifications()).find((x) => x.kind === 'test_reminder');
    expect(new Date(n!.scheduled_for).getHours()).toBe(16);
    expect(new Date(n!.scheduled_for).getMinutes()).toBe(30);
  });
});
