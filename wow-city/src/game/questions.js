import { WORDS, WORD_BY_ID } from './words.js';

/** Small seeded RNG (mulberry32) so tests are deterministic. */
export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Distractor ids that cannot be confused with the target (e.g. no "palace" for "castle"). */
export function distractors(targetId, n, rng = Math.random) {
  const t = WORD_BY_ID[targetId];
  const pool = WORDS.filter(
    (w) => w.id !== targetId && !t.confuse.includes(w.id) && !w.confuse.includes(targetId),
  ).map((w) => w.id);
  return shuffle(pool, rng).slice(0, n);
}

/** Four shuffled option ids, exactly one of which is the target. */
export function options(targetId, rng = Math.random, n = 4) {
  return shuffle([targetId, ...distractors(targetId, n - 1, rng)], rng);
}

export const QUIZ_TYPES = ['choice', 'picture', 'truefalse', 'complete', 'match'];

/** Build one quiz question of a given type for a target word. */
export function makeQuestion(type, targetId, rng = Math.random) {
  const t = WORD_BY_ID[targetId];
  switch (type) {
    case 'choice':
      return { type, target: targetId, prompt: `Where can people ${t.activity}?`, options: options(targetId, rng), answer: targetId };
    case 'picture':
      return { type, target: targetId, prompt: 'Look at the picture. What is this place?', picture: targetId, options: options(targetId, rng), answer: targetId };
    case 'truefalse': {
      const truth = rng() < 0.5;
      const shown = truth ? targetId : distractors(targetId, 1, rng)[0];
      return {
        type, target: targetId, picture: targetId,
        prompt: `True or false? This is ${articled(shown)}.`,
        options: ['true', 'false'], answer: truth ? 'true' : 'false',
      };
    }
    case 'complete':
      return { type, target: targetId, prompt: 'Complete the sentence.', sentence: t.sentence, options: options(targetId, rng), answer: targetId };
    case 'match': {
      const ids = options(targetId, rng);
      return { type, target: targetId, prompt: 'Match each picture with its word.', pairs: ids, words: shuffle(ids, rng), answer: 'all' };
    }
    default:
      throw new Error(`Unknown question type: ${type}`);
  }
}

function articled(id) {
  const w = WORD_BY_ID[id].word.toLowerCase();
  return (/^[aeiou]/.test(w) ? 'an ' : 'a ') + w;
}

/** Level 4: 15 randomised questions, 3 of each of the 5 types, mixed order. */
export function buildQuiz(rng = Math.random, count = 15) {
  const targets = [];
  while (targets.length < count) targets.push(...shuffle(WORDS.map((w) => w.id), rng));
  const types = [];
  while (types.length < count) types.push(...QUIZ_TYPES);
  return shuffle(types.slice(0, count), rng).map((type, i) => makeQuestion(type, targets[i], rng));
}

/** Level 1: every word once, each with 4 word options. */
export function buildWordHunter(rng = Math.random) {
  return shuffle(WORDS.map((w) => w.id), rng).map((id) => ({ target: id, options: options(id, rng) }));
}

/** Level 2: the four textbook clues always appear, plus extra random clues. */
export const CORE_CLUES = ['hospital', 'harbour', 'swimming_pool', 'stadium'];
export function buildClues(rng = Math.random, n = 8) {
  const extra = shuffle(WORDS.map((w) => w.id).filter((id) => !CORE_CLUES.includes(id)), rng).slice(0, n - CORE_CLUES.length);
  return shuffle([...CORE_CLUES, ...extra], rng).map((id) => ({ target: id, clue: WORD_BY_ID[id].clue, options: options(id, rng) }));
}

/** Level 6: 5 harder questions (clues and sentences). */
export function buildTreasure(rng = Math.random, n = 5) {
  const ids = shuffle(WORDS.map((w) => w.id), rng).slice(0, n);
  return ids.map((id, i) => (i % 2 === 0
    ? { type: 'complete', target: id, prompt: 'Complete the sentence.', sentence: WORD_BY_ID[id].sentence, options: options(id, rng), answer: id }
    : { type: 'clue', target: id, prompt: WORD_BY_ID[id].clue, options: options(id, rng), answer: id }));
}

/** A spare question used when a treasure answer is wrong (so the key is still winnable). */
export function treasureReplacement(excludeIds, rng = Math.random) {
  const pool = WORDS.map((w) => w.id).filter((id) => !excludeIds.includes(id));
  const id = shuffle(pool.length ? pool : WORDS.map((w) => w.id), rng)[0];
  return { type: 'clue', target: id, prompt: WORD_BY_ID[id].clue, options: options(id, rng), answer: id };
}

/** Stars for a mission from first-try accuracy. */
export function starsFor(correct, total) {
  if (total <= 0) return 3;
  const r = correct / total;
  if (r >= 0.9) return 3;
  if (r >= 0.6) return 2;
  return 1;
}
