import { describe, it, expect } from 'vitest';
import { WORDS, WORD_BY_ID, MISSIONS } from '../src/game/words.js';
import { makeRng, options, distractors, buildQuiz, buildWordHunter, buildClues, buildTreasure, treasureReplacement, starsFor, QUIZ_TYPES, CORE_CLUES } from '../src/game/questions.js';
import { blankProgress, applyCorrect, applyWrong, applyLevelComplete, totalStars, isUnlocked, restoredIds } from '../src/game/store.js';
import { collide, nearestBuilding, CITY_LAYOUT, COINS, BUILDING_HALF } from '../src/game/city.js';

const rng = () => makeRng(1234);

describe('vocabulary', () => {
  it('has the 12 Unit 3 words', () => {
    expect(WORDS.map((w) => w.word)).toEqual([
      'Castle', 'Harbour', 'Stadium', 'Tower', 'Skyscraper', 'Factory', 'Hospital', 'Palace',
      'Swimming pool', 'Sports centre', 'Office building', 'Apartment building',
    ]);
  });
  it('every sentence has exactly one blank', () => {
    WORDS.forEach((w) => expect(w.sentence.split('___').length).toBe(2));
  });
  it('the 6 missions restore all 12 names exactly once', () => {
    const all = MISSIONS.flatMap((m) => m.restores).sort();
    expect(all).toEqual(WORDS.map((w) => w.id).sort());
  });
});

describe('question generation', () => {
  it('options contain the target once and 4 unique ids', () => {
    WORDS.forEach((w) => {
      const o = options(w.id, rng());
      expect(o).toHaveLength(4);
      expect(new Set(o).size).toBe(4);
      expect(o.filter((x) => x === w.id)).toHaveLength(1);
    });
  });
  it('distractors never include confusable places', () => {
    const d = distractors('castle', 11, rng());
    expect(d).not.toContain('palace');
    expect(d).not.toContain('tower');
  });
  it('quiz has 15 questions, 3 of each of the 5 types', () => {
    const q = buildQuiz(rng());
    expect(q).toHaveLength(15);
    QUIZ_TYPES.forEach((t) => expect(q.filter((x) => x.type === t)).toHaveLength(3));
    q.filter((x) => x.type !== 'match').forEach((x) => expect(x.options).toContain(x.answer));
  });
  it('quiz is deterministic for the same seed and different for another', () => {
    expect(buildQuiz(makeRng(7))).toEqual(buildQuiz(makeRng(7)));
    expect(buildQuiz(makeRng(7))).not.toEqual(buildQuiz(makeRng(8)));
  });
  it('word hunter covers all 12 words', () => {
    expect(buildWordHunter(rng()).map((r) => r.target).sort()).toEqual(WORDS.map((w) => w.id).sort());
  });
  it('clues always include the four textbook clues', () => {
    const c = buildClues(rng());
    expect(c).toHaveLength(8);
    CORE_CLUES.forEach((id) => expect(c.map((x) => x.target)).toContain(id));
    expect(WORD_BY_ID.hospital.clue).toBe('Doctors and nurses work here.');
    expect(WORD_BY_ID.harbour.clue).toBe('Ships stop here.');
  });
  it('treasure has 5 questions and replacements avoid used words', () => {
    const t = buildTreasure(rng());
    expect(t).toHaveLength(5);
    const r = treasureReplacement(t.map((x) => x.target), rng());
    expect(t.map((x) => x.target)).not.toContain(r.target);
  });
  it('stars from accuracy', () => {
    expect(starsFor(10, 10)).toBe(3);
    expect(starsFor(9, 10)).toBe(3);
    expect(starsFor(6, 10)).toBe(2);
    expect(starsFor(5, 10)).toBe(1);
  });
});

describe('scoring', () => {
  it('correct = +10, wrong = 0', () => {
    let p = applyCorrect(blankProgress());
    p = applyWrong(p);
    expect(p.points).toBe(10);
    expect(p.correct).toBe(1);
    expect(p.answered).toBe(2);
  });
  it('level bonus +20 only the first time, best stars kept', () => {
    let p = applyLevelComplete(blankProgress(), 1, 2);
    expect(p.points).toBe(20);
    p = applyLevelComplete(p, 1, 3);
    expect(p.points).toBe(20);
    expect(totalStars(p)).toBe(3);
    p = applyLevelComplete(p, 1, 1);
    expect(totalStars(p)).toBe(3);
  });
  it('missions unlock in order and trophy after all six', () => {
    let p = blankProgress();
    expect(isUnlocked(p, 1)).toBe(true);
    expect(isUnlocked(p, 2)).toBe(false);
    for (let id = 1; id <= 5; id++) p = applyLevelComplete(p, id, 3);
    expect(p.trophy).toBe(false);
    expect(restoredIds(p)).toHaveLength(10);
    p = applyLevelComplete(p, 6, 3);
    expect(p.trophy).toBe(true);
  });
});

describe('city', () => {
  it('player cannot walk into a building', () => {
    const b = CITY_LAYOUT[0];
    const [x, z] = collide(b.x, b.z + 1);
    expect(Math.abs(x - b.x) >= BUILDING_HALF || Math.abs(z - b.z) >= BUILDING_HALF).toBe(true);
  });
  it('standing at a building front detects it', () => {
    const b = CITY_LAYOUT[5];
    expect(nearestBuilding(b.x, b.z + BUILDING_HALF + 1)?.id).toBe(b.id);
    expect(nearestBuilding(0, 9)).toBe(null);
  });
  it('coins are on roads, not inside buildings', () => {
    COINS.forEach((c) => {
      const [x, z] = collide(c.x, c.z);
      expect([x, z]).toEqual([c.x, c.z]);
    });
  });
});
