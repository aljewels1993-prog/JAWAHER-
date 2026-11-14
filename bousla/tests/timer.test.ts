import { describe, expect, it } from 'vitest';
import { IDLE, elapsedMs, formatClock, isFinished, pause, progress, remainingMs, restore, resume, startPhase } from '../src/lib/timer';

const T0 = 1_700_000_000_000;
const MIN = 60_000;

describe('timestamp timer', () => {
  it('counts down from wall-clock time, not from ticks', () => {
    const s = startPhase('focus', 25, T0);
    expect(remainingMs(s, T0)).toBe(25 * MIN);
    // A sleeping tab that wakes 10 minutes later sees the correct value at once.
    expect(remainingMs(s, T0 + 10 * MIN)).toBe(15 * MIN);
  });

  it('pause freezes the remaining time and resume continues it', () => {
    let s = startPhase('focus', 25, T0);
    s = pause(s, T0 + 5 * MIN);
    expect(remainingMs(s, T0 + 30 * MIN)).toBe(20 * MIN);
    s = resume(s, T0 + 30 * MIN);
    expect(remainingMs(s, T0 + 31 * MIN)).toBe(19 * MIN);
    expect(elapsedMs(s, T0 + 31 * MIN)).toBe(6 * MIN);
  });

  it('finishes exactly at zero and never goes negative', () => {
    const s = startPhase('focus', 25, T0);
    expect(isFinished(s, T0 + 25 * MIN - 1)).toBe(false);
    expect(isFinished(s, T0 + 25 * MIN)).toBe(true);
    expect(remainingMs(s, T0 + 99 * MIN)).toBe(0);
    expect(progress(s, T0 + 99 * MIN)).toBe(1);
  });

  it('survives a page refresh through JSON persistence', () => {
    const s = pause(startPhase('focus', 45, T0, { sessionId: 'abc', subject: 'Science' }), T0 + MIN);
    const back = restore(JSON.parse(JSON.stringify(s)));
    expect(back).toEqual(s);
    expect(remainingMs(back, T0 + 50 * MIN)).toBe(44 * MIN);
  });

  it('rejects corrupted saved state', () => {
    expect(restore(null)).toEqual(IDLE);
    expect(restore({ phase: 'focus' })).toEqual(IDLE);
    expect(restore({ phase: 'hack', durationMs: 1, startedAt: 1 })).toEqual(IDLE);
  });

  it('formats the clock', () => {
    expect(formatClock(25 * MIN)).toBe('25:00');
    expect(formatClock(61_000)).toBe('01:01');
    expect(formatClock(500)).toBe('00:01');
    expect(formatClock(0)).toBe('00:00');
  });
});
