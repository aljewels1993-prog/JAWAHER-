/**
 * Timestamp-based countdown. The remaining time is always derived from
 * wall-clock timestamps, so it stays correct when the tab sleeps, the
 * student changes pages, or the page reloads (state is persisted).
 */
export type TimerPhase = 'idle' | 'focus' | 'break';

export interface TimerState {
  phase: TimerPhase;
  /** Total length of the current phase. */
  durationMs: number;
  /** Epoch ms when the phase started (null while idle). */
  startedAt: number | null;
  /** Epoch ms when paused, or null while running. */
  pausedAt: number | null;
  /** Sum of all finished pauses. */
  pausedTotalMs: number;
  /** Minutes chosen for the focus session (used for the break offer + reports). */
  focusMinutes: number;
  subject: string | null;
  /** Server session id for the focus phase. */
  sessionId: string | null;
  /** True once the focus session was reported to the server successfully. */
  reported: boolean;
  /** True once the end-of-phase sound/notification was played. */
  alerted: boolean;
}

export const IDLE: TimerState = {
  phase: 'idle', durationMs: 0, startedAt: null, pausedAt: null, pausedTotalMs: 0,
  focusMinutes: 25, subject: null, sessionId: null, reported: false, alerted: false,
};

export function startPhase(phase: 'focus' | 'break', minutes: number, now: number, extra: Partial<TimerState> = {}): TimerState {
  return { ...IDLE, ...extra, phase, durationMs: Math.round(minutes * 60_000), startedAt: now, pausedAt: null, pausedTotalMs: 0, reported: false, alerted: false };
}

export function elapsedMs(s: TimerState, now: number): number {
  if (s.startedAt === null) return 0;
  const end = s.pausedAt ?? now;
  return Math.max(0, end - s.startedAt - s.pausedTotalMs);
}

export function remainingMs(s: TimerState, now: number): number {
  if (s.phase === 'idle') return 0;
  return Math.max(0, s.durationMs - elapsedMs(s, now));
}

export function progress(s: TimerState, now: number): number {
  if (s.phase === 'idle' || s.durationMs <= 0) return 0;
  return Math.min(1, elapsedMs(s, now) / s.durationMs);
}

export function isRunning(s: TimerState): boolean {
  return s.phase !== 'idle' && s.pausedAt === null;
}

export function isFinished(s: TimerState, now: number): boolean {
  return s.phase !== 'idle' && remainingMs(s, now) === 0;
}

export function pause(s: TimerState, now: number): TimerState {
  if (!isRunning(s)) return s;
  return { ...s, pausedAt: now };
}

export function resume(s: TimerState, now: number): TimerState {
  if (s.pausedAt === null) return s;
  return { ...s, pausedTotalMs: s.pausedTotalMs + (now - s.pausedAt), pausedAt: null };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Restores a persisted state, rejecting anything malformed. */
export function restore(raw: unknown): TimerState {
  if (!raw || typeof raw !== 'object') return IDLE;
  const s = raw as Partial<TimerState>;
  if (s.phase !== 'focus' && s.phase !== 'break') return IDLE;
  if (typeof s.durationMs !== 'number' || typeof s.startedAt !== 'number') return IDLE;
  return { ...IDLE, ...s } as TimerState;
}
