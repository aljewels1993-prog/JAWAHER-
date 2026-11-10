import { describe, it, expect } from 'vitest';
import { LINES, line } from '../src/game/lines.js';

describe('hero lines', () => {
  it('every line exists in English and Arabic with a mood', () => {
    for (const [kind, g] of Object.entries(LINES)) {
      expect(['happy', 'excited', 'sad', 'calm'], kind).toContain(g.mood);
      for (const [en, ar] of g.list) {
        expect(en.length, kind).toBeGreaterThan(2);
        expect(ar, kind).toMatch(/[؀-ۿ]/);
      }
    }
  });
  it('has lots of varied encouragement and sad lines for mistakes', () => {
    expect(LINES.correct.list.length).toBeGreaterThanOrEqual(12);
    expect(LINES.wrong.list.length).toBeGreaterThanOrEqual(8);
    expect(LINES.correct.mood).toBe('happy');
    expect(LINES.wrong.mood).toBe('sad');
    expect(new Set(LINES.correct.list.map(([en]) => en)).size).toBe(LINES.correct.list.length);
  });
  it('never says the same line twice in a row', () => {
    let prev = '';
    for (let i = 0; i < 200; i++) {
      const l = line('correct');
      expect(l.en).not.toBe(prev);
      prev = l.en;
    }
  });
  it('fills in streak numbers', () => {
    expect(line('streak', 4).en).toContain('4');
  });
});

import { encourageNow, resetEncouragePace } from '../src/game/lines.js';
describe('encouragement pacing', () => {
  it('appears about once every three answers, not every time', () => {
    resetEncouragePace();
    const shown = Array.from({ length: 9 }, () => encourageNow());
    expect(shown.filter(Boolean)).toHaveLength(3);
    expect(shown.slice(0, 3)).toEqual([false, false, true]);
  });
  it('always celebrates streak milestones', () => {
    resetEncouragePace();
    expect(encourageNow({ streak: 5 })).toBe(true);
    expect(encourageNow({ streak: 10 })).toBe(true);
    expect(encourageNow({ streak: 3 })).toBe(false);
  });
});
