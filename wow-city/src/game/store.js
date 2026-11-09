import { create } from 'zustand';
import { MISSIONS, SCORING } from './words.js';
import { starsFor } from './questions.js';

const SAVE_KEY = 'wowcity-save-v1';

export const blankProgress = () => ({ points: 0, correct: 0, answered: 0, coins: 0, levels: {}, trophy: false });

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* private mode / blocked storage: play without saving */ }
  return { current: null, profiles: {}, sound: true };
}

function writeSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

/** Pure scoring helpers (unit tested). */
export function applyCorrect(p) {
  return { ...p, points: p.points + SCORING.correct, correct: p.correct + 1, answered: p.answered + 1 };
}
export function applyWrong(p) {
  return { ...p, answered: p.answered + 1 };
}
export function applyLevelComplete(p, levelId, stars) {
  const prev = p.levels[levelId];
  const first = !prev;
  const levels = { ...p.levels, [levelId]: { stars: Math.max(stars, prev?.stars ?? 0) } };
  const trophy = MISSIONS.every((m) => levels[m.id]);
  return { ...p, levels, trophy, points: p.points + (first ? SCORING.levelBonus : 0) };
}
export const totalStars = (p) => Object.values(p.levels).reduce((s, l) => s + l.stars, 0);
export const missionsDone = (p) => MISSIONS.filter((m) => p.levels[m.id]).length;
export const isUnlocked = (p, id) => id === 1 || !!p.levels[id - 1];
export const restoredIds = (p) => MISSIONS.filter((m) => p.levels[m.id]).flatMap((m) => m.restores);

const save = readSave();

export const useGame = create((set, get) => ({
  screen: 'start', // start | story | hub | level | complete | final
  level: null,
  result: null, // last mission result for the complete screen
  player: save.current,
  profiles: save.profiles,
  progress: (save.current && save.profiles[save.current]) || blankProgress(),
  sound: save.sound !== false,

  // Shared state the 3D scenes read.
  stage: { building: null, mood: 'idle', celebrate: 0, keys: 0, open: false, spin: true },
  city: { target: null, found: [], coinsTaken: [], hint: false, visit: null, playing: false },
  bubble: null, // { text, mood }

  persist() {
    const { player, profiles, progress, sound } = get();
    const next = player ? { ...profiles, [player]: progress } : profiles;
    set({ profiles: next });
    writeSave({ current: player, profiles: next, sound });
  },

  login(name) {
    const clean = name.trim().slice(0, 20);
    const { profiles } = get();
    set({ player: clean, progress: profiles[clean] || blankProgress() });
    get().persist();
  },
  logout() { set({ player: null, screen: 'start' }); get().persist(); },

  go(screen, level = null) { set({ screen, level, bubble: null }); },
  setStage(patch) { set((s) => ({ stage: { ...s.stage, ...patch } })); },
  setCity(patch) { set((s) => ({ city: { ...s.city, ...patch } })); },
  say(text, mood = 'talk') { set({ bubble: text ? { text, mood, at: Date.now() } : null }); },
  celebrate() { set((s) => ({ stage: { ...s.stage, celebrate: s.stage.celebrate + 1 } })); },

  answerCorrect() { set((s) => ({ progress: applyCorrect(s.progress) })); get().persist(); },
  answerWrong() { set((s) => ({ progress: applyWrong(s.progress) })); get().persist(); },
  addCoin() { set((s) => ({ progress: { ...s.progress, coins: s.progress.coins + 1 } })); get().persist(); },

  finishLevel(levelId, firstTry, total, starsOverride) {
    const stars = starsOverride ?? starsFor(firstTry, total);
    const wasNew = !get().progress.levels[levelId];
    set((s) => ({
      progress: applyLevelComplete(s.progress, levelId, stars),
      result: { levelId, stars, firstTry, total, bonus: wasNew },
      screen: 'complete',
      bubble: null,
    }));
    get().persist();
  },

  restart() {
    set({ progress: blankProgress(), screen: 'story', level: null, result: null });
    get().persist();
  },

  toggleSound() { set((s) => ({ sound: !s.sound })); get().persist(); },
}));
