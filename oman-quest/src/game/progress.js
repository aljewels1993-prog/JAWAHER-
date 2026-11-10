import { TUNING } from '../data/tuning.js';
import { QUESTIONS, QUESTION_BY_ID } from '../data/questions.js';
import { STAGES, TOTAL_STAGES } from '../data/stages.js';

/**
 * Pure functions over a student profile. A profile is plain JSON so it can be
 * saved to localStorage and to Supabase unchanged.
 *
 * profile = {
 *   id, name, createdAt, savedAt,
 *   stages:  { [stageId]: { completed, bestCoins, bestStars, plays, secret } },
 *   answers: { [questionId]: { done, rewarded, attempts, wrong: [optionIndex], at } },
 *   badges:  [badgeId], finishedAt
 * }
 */
export const MAX_ATTEMPTS_BEFORE_REVEAL = 2;

export function newProfile(name, id) {
  const now = new Date().toISOString();
  return { id, name: cleanName(name), createdAt: now, savedAt: now, stages: {}, answers: {}, badges: [], finishedAt: null };
}

/** Trim, collapse spaces and cap the length of a student's display name. */
export function cleanName(name) {
  return String(name || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

/**
 * Record one answer attempt. Returns what the UI should show:
 *  - correct: the chosen option was right
 *  - reward: coins to award now (10 only the first time a question is solved
 *    within the allowed attempts; never twice for the same question)
 *  - done: the question is finished (solved, or revealed after too many tries)
 *  - revealed: the correct answer is now shown without a reward
 */
export function recordAnswer(profile, questionId, chosen) {
  const q = QUESTION_BY_ID[questionId];
  if (!q) throw new Error(`Unknown question ${questionId}`);
  const a = profile.answers[questionId] || { done: false, rewarded: false, attempts: 0, wrong: [] };
  profile.answers[questionId] = a;
  if (a.done) return { correct: chosen === q.answer, reward: 0, done: true, revealed: false, repeat: true };
  a.attempts += 1;
  a.at = new Date().toISOString();
  const correct = chosen === q.answer;
  let reward = 0;
  let revealed = false;
  if (correct) {
    a.done = true;
    if (!a.rewarded) { a.rewarded = true; reward = TUNING.rewards.questionCorrect; }
  } else {
    a.wrong.push(chosen);
    if (a.attempts >= MAX_ATTEMPTS_BEFORE_REVEAL) { a.done = true; revealed = true; }
  }
  return { correct, reward, done: a.done, revealed, attempts: a.attempts };
}

export const isQuestionDone = (profile, qid) => !!profile.answers[qid]?.done;

export function answeredIds(profile) {
  return Object.entries(profile.answers).filter(([, a]) => a.done).map(([id]) => id);
}

export function grammarCoins(profile) {
  return Object.values(profile.answers).filter((a) => a.rewarded).length * TUNING.rewards.questionCorrect;
}

export function totals(profile) {
  const st = Object.values(profile.stages);
  const worldCoins = st.reduce((n, s) => n + (s.bestCoins || 0), 0);
  const stars = st.reduce((n, s) => n + (s.bestStars || 0), 0);
  const gCoins = grammarCoins(profile);
  const coins = worldCoins + gCoins;
  const stagesCompleted = st.filter((s) => s.completed).length;
  const questionsDone = Object.values(profile.answers).filter((a) => a.done).length;
  const correct = Object.values(profile.answers).filter((a) => a.rewarded).length;
  const wrongAnswers = Object.values(profile.answers).reduce((n, a) => n + a.wrong.length, 0);
  const score = coins + stars * TUNING.rewards.star;
  return { coins, grammarCoins: gCoins, worldCoins, stars, stagesCompleted, questionsDone, correct, wrongAnswers, score };
}

/** A stage is playable if it's the first one or the previous one is complete. */
export function isStageUnlocked(profile, stageId) {
  if (stageId === 1) return true;
  return !!profile.stages[stageId - 1]?.completed;
}

/** The stage a returning student should continue with. */
export function currentStage(profile) {
  for (const s of STAGES) if (!profile.stages[s.id]?.completed) return s.id;
  return TOTAL_STAGES;
}

export const BADGES = [
  { id: 'first-steps', icon: '👣', en: 'First Steps', ar: 'الخطوات الأولى', test: (p) => !!p.stages[1]?.completed },
  { id: 'grammar-ace', icon: '🎯', en: 'Grammar Ace – 5 perfect answers in one stage', ar: 'نجمة القواعد – ٥ إجابات صحيحة في مرحلة', test: (p) => STAGES.some((s) => QUESTIONS.filter((q) => q.stage === s.id).every((q) => p.answers[q.id]?.rewarded && p.answers[q.id].attempts === 1)) },
  { id: 'coin-collector', icon: '🪙', en: 'Coin Collector – 150 coins', ar: 'جامعة العملات – ١٥٠ عملة', test: (p) => totals(p).coins >= 150 },
  { id: 'star-hunter', icon: '⭐', en: 'Star Hunter – 10 stars', ar: 'صائدة النجوم – ١٠ نجوم', test: (p) => totals(p).stars >= 10 },
  { id: 'secret-explorer', icon: '🗝️', en: 'Secret Explorer – found a hidden falaj', ar: 'المستكشفة – وجدتِ الفلج السري', test: (p) => Object.values(p.stages).some((s) => s.secret) },
  { id: 'southern-hero', icon: '🏝️', en: 'Hero of the South – World 1 complete', ar: 'بطلة الجنوب – أكملتِ العالم الأول', test: (p) => [1, 2, 3, 4, 5].every((i) => p.stages[i]?.completed) },
  { id: 'northern-hero', icon: '⛰️', en: 'Hero of the North – World 2 complete', ar: 'بطلة الشمال – أكملتِ العالم الثاني', test: (p) => [6, 7, 8, 9, 10].every((i) => p.stages[i]?.completed) },
  { id: 'champion', icon: '🏆', en: 'Oman English Champion', ar: 'بطلة تحدي اللغة الإنجليزية', test: (p) => STAGES.every((s) => p.stages[s.id]?.completed) },
];

/**
 * Save the result of a finished stage run. Keeps the BEST coins/stars per
 * stage so replaying can't farm points. Returns newly earned badge ids.
 */
export function completeStage(profile, stageId, run) {
  const prev = profile.stages[stageId] || { completed: false, bestCoins: 0, bestStars: 0, plays: 0, secret: false };
  profile.stages[stageId] = {
    completed: true,
    bestCoins: Math.max(prev.bestCoins || 0, run.coins || 0),
    bestStars: Math.max(prev.bestStars || 0, run.stars || 0),
    plays: (prev.plays || 0) + 1,
    secret: prev.secret || !!run.secret,
  };
  if (stageId === TOTAL_STAGES && !profile.finishedAt) profile.finishedAt = new Date().toISOString();
  return refreshBadges(profile);
}

export function refreshBadges(profile) {
  const earned = [];
  for (const b of BADGES) {
    if (!profile.badges.includes(b.id) && b.test(profile)) { profile.badges.push(b.id); earned.push(b.id); }
  }
  return earned;
}

/** Coins to show in the HUD during a run: saved total + anything above the stage's best. */
export function liveCoins(profile, stageId, runCoins) {
  const best = profile.stages[stageId]?.bestCoins || 0;
  return totals(profile).coins + Math.max(0, runCoins - best);
}
