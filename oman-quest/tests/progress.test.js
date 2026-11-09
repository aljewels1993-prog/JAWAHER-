import { describe, it, expect } from 'vitest';
import { newProfile, recordAnswer, totals, completeStage, isStageUnlocked, currentStage, liveCoins, cleanName } from '../src/game/progress.js';
import { QUESTIONS } from '../src/data/questions.js';
import { createLocalBackend } from '../src/net/backend.js';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const memStore = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };

describe('grammar scoring', () => {
  it('awards 10 coins for a correct answer, only once', () => {
    const p = newProfile('Aisha', 'id1');
    const q = QUESTIONS[0];
    expect(recordAnswer(p, q.id, q.answer).reward).toBe(10);
    expect(recordAnswer(p, q.id, q.answer).reward).toBe(0);
    expect(totals(p).grammarCoins).toBe(10);
  });
  it('wrong answer: no coins, can try again, correct second try still earns 10', () => {
    const p = newProfile('Aisha', 'id1');
    const q = QUESTIONS[1];
    const wrong = (q.answer + 1) % 4;
    const r1 = recordAnswer(p, q.id, wrong);
    expect(r1).toMatchObject({ correct: false, reward: 0, done: false });
    const r2 = recordAnswer(p, q.id, q.answer);
    expect(r2).toMatchObject({ correct: true, reward: 10, done: true });
    expect(p.answers[q.id].wrong).toEqual([wrong]);
  });
  it('after two wrong tries the answer is revealed with no coins', () => {
    const p = newProfile('Aisha', 'id1');
    const q = QUESTIONS[2];
    recordAnswer(p, q.id, (q.answer + 1) % 4);
    const r = recordAnswer(p, q.id, (q.answer + 2) % 4);
    expect(r).toMatchObject({ revealed: true, done: true, reward: 0 });
    expect(recordAnswer(p, q.id, q.answer).reward).toBe(0);
  });
  it('the maximum grammar score is exactly 500', () => {
    const p = newProfile('Aisha', 'id1');
    for (const q of QUESTIONS) { recordAnswer(p, q.id, q.answer); recordAnswer(p, q.id, q.answer); }
    expect(totals(p).grammarCoins).toBe(500);
    expect(totals(p).questionsDone).toBe(50);
  });
});

describe('stages and progress', () => {
  it('unlocks stages in order and remembers where to continue', () => {
    const p = newProfile('Aisha', 'id1');
    expect(isStageUnlocked(p, 1)).toBe(true);
    expect(isStageUnlocked(p, 2)).toBe(false);
    completeStage(p, 1, { coins: 30, stars: 2 });
    expect(isStageUnlocked(p, 2)).toBe(true);
    expect(isStageUnlocked(p, 3)).toBe(false);
    expect(currentStage(p)).toBe(2);
  });
  it('keeps only the best coins per stage so replays cannot farm points', () => {
    const p = newProfile('Aisha', 'id1');
    completeStage(p, 1, { coins: 30, stars: 2 });
    completeStage(p, 1, { coins: 20, stars: 3 });
    completeStage(p, 1, { coins: 25, stars: 1 });
    expect(totals(p).worldCoins).toBe(30);
    expect(totals(p).stars).toBe(3);
    expect(liveCoins(p, 1, 35)).toBe(35);
    expect(liveCoins(p, 1, 10)).toBe(30);
  });
  it('awards badges', () => {
    const p = newProfile('Aisha', 'id1');
    const earned = completeStage(p, 1, { coins: 10, stars: 1, secret: true });
    expect(earned).toContain('first-steps');
    expect(earned).toContain('secret-explorer');
    for (let s = 2; s <= 10; s++) completeStage(p, s, { coins: 20, stars: 2 });
    expect(p.badges).toContain('champion');
    expect(p.finishedAt).toBeTruthy();
  });
  it('cleans unsafe names', () => {
    expect(cleanName('  <b>Aisha</b>   Al  Balushi ')).toBe('bAisha/b Al Balushi');
    expect(cleanName('x'.repeat(40))).toHaveLength(24);
  });
});

describe('local backend', () => {
  it('saves and restores progress across sessions', async () => {
    const store = memStore();
    const b1 = createLocalBackend(store);
    const p = await b1.createProfile('Maryam');
    recordAnswer(p, 'q01', QUESTIONS[0].answer);
    completeStage(p, 1, { coins: 12, stars: 1 });
    await b1.saveProfile(p);
    const b2 = createLocalBackend(store); // "student leaves and comes back"
    expect(b2.currentId()).toBe(p.id);
    const again = await b2.openProfile(p.id);
    expect(again.name).toBe('Maryam');
    expect(again.stages[1].completed).toBe(true);
    expect(totals(again).coins).toBe(22);
  });
  it('leaderboard shows top 20 by score with only public fields', async () => {
    const b = createLocalBackend(memStore());
    for (let i = 0; i < 25; i++) {
      const p = await b.createProfile(`S${i}`);
      completeStage(p, 1, { coins: i, stars: 0 });
      await b.saveProfile(p);
    }
    const lb = await b.leaderboard();
    expect(lb).toHaveLength(20);
    expect(lb[0]).toEqual({ name: 'S24', score: 24, stages: 1, coins: 24 });
    expect(Object.keys(lb[0]).sort()).toEqual(['coins', 'name', 'score', 'stages']);
  });
  it('teacher PIN protects the dashboard and reset clears a student', async () => {
    const b = createLocalBackend(memStore());
    expect(b.teacherNeedsSetup()).toBe(true);
    await b.teacherSetup('2468');
    await expect(b.teacherLogin('1111')).rejects.toThrow();
    await expect(b.teacherLogin('2468')).resolves.toBe(true);
    const p = await b.createProfile('Huda');
    recordAnswer(p, 'q01', (QUESTIONS[0].answer + 1) % 4);
    completeStage(p, 1, { coins: 12, stars: 1 });
    await b.saveProfile(p);
    const list = await b.teacherStudents();
    expect(list[0].wrong[0]).toMatchObject({ questionId: 'q01' });
    await b.teacherReset(p.id);
    const after = await b.teacherStudents();
    expect(after[0].score).toBe(0);
    expect(after[0].name).toBe('Huda');
  });
});
