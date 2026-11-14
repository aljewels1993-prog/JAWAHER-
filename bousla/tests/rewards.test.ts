import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_RULES, LEVEL_THRESHOLDS, badgeProgress, breakMinutesFor, computeStreaks, levelFor, newlyEarned } from '../src/lib/rewards';

const zero = { sessions_completed: 0, study_minutes: 0, tasks_completed: 0, total_points: 0, study_streak_days: 0 };

describe('levels', () => {
  it('starts at level 0 and reaches the top', () => {
    expect(levelFor(0)).toMatchObject({ index: 0, min: 0, next: 50 });
    expect(levelFor(49).index).toBe(0);
    expect(levelFor(50).index).toBe(1);
    const top = levelFor(LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 500);
    expect(top.next).toBeNull();
    expect(top.progress).toBe(1);
  });
  it('reports progress inside a level', () => {
    expect(levelFor(100).progress).toBeCloseTo(0.5);
  });
});

describe('streaks', () => {
  it('counts the best and current run of consecutive days', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-06', '2026-11-07'];
    expect(computeStreaks(days, '2026-11-07')).toEqual({ best: 3, current: 2 });
    expect(computeStreaks(days, '2026-11-08')).toEqual({ best: 3, current: 2 });
    expect(computeStreaks(days, '2026-11-09')).toEqual({ best: 3, current: 0 });
  });
  it('ignores duplicates and handles month boundaries', () => {
    expect(computeStreaks(['2026-10-30', '2026-10-31', '2026-10-31', '2026-11-01'], '2026-11-01')).toEqual({ best: 3, current: 3 });
  });
  it('is zero without study days', () => {
    expect(computeStreaks([], '2026-11-01')).toEqual({ best: 0, current: 0 });
  });
});

describe('badges', () => {
  it('unlocks a badge exactly at its threshold, once', () => {
    expect(newlyEarned({ ...zero, sessions_completed: 2 }, ACHIEVEMENT_RULES, new Set())).toEqual([]);
    expect(newlyEarned({ ...zero, sessions_completed: 3 }, ACHIEVEMENT_RULES, new Set())).toEqual(['study_star']);
    expect(newlyEarned({ ...zero, sessions_completed: 3 }, ACHIEVEMENT_RULES, new Set(['study_star']))).toEqual([]);
  });
  it('awards Weekly Champion after a 5-day streak', () => {
    expect(newlyEarned({ ...zero, study_streak_days: 5 }, ACHIEVEMENT_RULES, new Set())).toContain('weekly_champion');
  });
  it('shows capped progress for locked badges', () => {
    const rule = ACHIEVEMENT_RULES.find((r) => r.id === 'super_achiever')!;
    expect(badgeProgress({ ...zero, total_points: 250 }, rule)).toBe(0.5);
    expect(badgeProgress({ ...zero, total_points: 9999 }, rule)).toBe(1);
  });
});

describe('breaks', () => {
  it('offers a longer break after long sessions', () => {
    expect(breakMinutesFor(25)).toBe(5);
    expect(breakMinutesFor(45)).toBe(10);
  });
});
