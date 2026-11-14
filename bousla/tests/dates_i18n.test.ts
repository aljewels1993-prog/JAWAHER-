import { describe, expect, it } from 'vitest';
import { addDays, schoolDays, weekStart, splitMinutes } from '../src/lib/dates';
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';
import { translate, subjectLabel } from '../src/i18n';
import { MESSAGES, dailyIndex, pickMessage } from '../src/lib/motivation';
import { notificationText } from '../src/lib/notificationText';
import type { AppNotification } from '../src/api/types';

describe('school week', () => {
  it('starts on Sunday and runs Sunday to Thursday', () => {
    expect(weekStart('2026-11-10')).toBe('2026-11-08'); // Tuesday → Sunday
    expect(weekStart('2026-11-08')).toBe('2026-11-08');
    expect(schoolDays('2026-11-08')).toEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
  });
  it('adds days across months', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('splits minutes into hours', () => {
    expect(splitMinutes(135)).toEqual({ hours: 2, minutes: 15 });
  });
});

describe('translations', () => {
  it('Arabic has every English key and no empty text', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    for (const [k, v] of Object.entries(ar)) expect(v.trim(), k).not.toBe('');
  });
  it('keeps the same {placeholders} in both languages', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(ph(ar[k]), k).toBe(ph(en[k]));
  });
  it('fills parameters', () => {
    expect(translate('en', 'common.pts', { n: 10 })).toBe('10 pts');
    expect(translate('ar', 'home.morning', { name: 'سارة' })).toContain('سارة');
  });
  it('translates built-in subjects and keeps custom ones', () => {
    expect(subjectLabel('ar', 'Mathematics')).toBe('الرياضيات');
    expect(subjectLabel('ar', 'Robotics')).toBe('Robotics');
  });
  it('renders notifications in the reader language', () => {
    const n: AppNotification = { id: '1', kind: 'session_complete', data: { minutes: 25, points: 10 }, task_id: null, scheduled_for: '', read_at: null, created_at: '' };
    expect(notificationText(n, 'en').body).toBe('25 minutes of focus · +10 points');
    expect(notificationText(n, 'ar').title).toBe('انتهت جلسة المذاكرة');
  });
});

describe('motivational messages', () => {
  it('contains the requested Arabic and English messages', () => {
    expect(MESSAGES.en).toContain('You can do it!');
    expect(MESSAGES.ar).toContain('لا تستسلمي، أنتِ قادرة!');
  });
  it('message of the day is stable within a day', () => {
    expect(dailyIndex('2026-11-10', 6)).toBe(dailyIndex('2026-11-10', 6));
  });
  it('never repeats a recently shown message', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const { index } = pickMessage('en', [0, 1, 2], () => r);
      expect([0, 1, 2]).not.toContain(index);
    }
  });
});
