/**
 * Reward rules shared by the UI and the on-device backend.
 * The cloud backend enforces the same numbers in SQL
 * (supabase/migrations/*_bousla_schema.sql) — keep them in sync.
 */
export const REWARDS = {
  sessionPoints: 10,
  taskPoints: 5,
  dailyBonusPoints: 20,
  /** Paid tasks per day (stops create/complete/delete farming). */
  dailyPaidTaskCap: 20,
  /** A day needs at least this many tasks for the "all done" bonus. */
  dailyBonusMinTasks: 2,
  /** Allowed study session lengths (minutes). */
  minSessionMinutes: 10,
  maxSessionMinutes: 120,
  /** Seconds of tolerance when the server checks a finished session. */
  completionToleranceSec: 15,
} as const;

export const TIMER_PRESETS = [25, 30, 45] as const;

/** Break length offered after a focus session. */
export function breakMinutesFor(focusMinutes: number): number {
  return focusMinutes >= 45 ? 10 : 5;
}

export interface Level {
  index: number;
  min: number;
  /** Points needed for the next level, or null at the top. */
  next: number | null;
  /** 0..1 progress towards the next level. */
  progress: number;
}

/** Level thresholds (points). Names live in the i18n files as level.N. */
export const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200] as const;

export function levelFor(points: number): Level {
  const p = Math.max(0, points);
  let index = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) if (p >= LEVEL_THRESHOLDS[i]) index = i;
  const min = LEVEL_THRESHOLDS[index];
  const next = index + 1 < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[index + 1] : null;
  const progress = next === null ? 1 : (p - min) / (next - min);
  return { index, min, next, progress };
}

/** Best and current runs of consecutive study days. `days` are ISO dates; `today` ISO. */
export function computeStreaks(days: string[], today: string): { best: number; current: number } {
  const unique = [...new Set(days)].sort();
  if (!unique.length) return { best: 0, current: 0 };
  const dayNum = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
  let best = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    run = dayNum(unique[i]) - dayNum(unique[i - 1]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const lastGap = dayNum(today) - dayNum(unique[unique.length - 1]);
  return { best, current: lastGap <= 1 ? run : 0 };
}

export type CriteriaType = 'sessions_completed' | 'study_minutes' | 'tasks_completed' | 'total_points' | 'study_streak_days';

export interface AchievementRule {
  id: string;
  icon: string;
  criteria_type: CriteriaType;
  threshold: number;
  sort_order: number;
}

/** Same catalogue as the SQL seed. */
export const ACHIEVEMENT_RULES: AchievementRule[] = [
  { id: 'study_star', icon: '⭐', criteria_type: 'sessions_completed', threshold: 3, sort_order: 1 },
  { id: 'time_master', icon: '⏰', criteria_type: 'study_minutes', threshold: 600, sort_order: 2 },
  { id: 'reading_hero', icon: '📖', criteria_type: 'tasks_completed', threshold: 15, sort_order: 3 },
  { id: 'super_achiever', icon: '🏆', criteria_type: 'total_points', threshold: 500, sort_order: 4 },
  { id: 'weekly_champion', icon: '👑', criteria_type: 'study_streak_days', threshold: 5, sort_order: 5 },
];

export type ProgressStats = Record<CriteriaType, number>;

/** Badges whose criteria are met and that are not yet unlocked. */
export function newlyEarned(stats: ProgressStats, rules: AchievementRule[], unlocked: Set<string>): string[] {
  return rules
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((r) => !unlocked.has(r.id) && stats[r.criteria_type] >= r.threshold)
    .map((r) => r.id);
}

/** 0..1 progress towards a badge, for the locked-badge progress bars. */
export function badgeProgress(stats: ProgressStats, rule: AchievementRule): number {
  return Math.min(1, stats[rule.criteria_type] / rule.threshold);
}
