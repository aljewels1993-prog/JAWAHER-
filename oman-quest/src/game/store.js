import { create } from 'zustand';
import { createBackend } from '../net/backend.js';
import { recordAnswer, completeStage, refreshBadges, isStageUnlocked, totals, markHintUsed, claimStarReward, stageRating } from './progress.js';
import { applySettings, setMusicMode, sfx } from './audio.js';
import { STRINGS } from './i18n.js';
import { TOTAL_STAGES } from '../data/stages.js';

const PREFS = 'oeq.prefs.v1';
const loadPrefs = () => {
  try { return JSON.parse(localStorage.getItem(PREFS)) || {}; } catch { return {}; }
};
const savePrefs = (p) => { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* ignore */ } };

const prefs = loadPrefs();

/**
 * App-wide state. The live game world (physics etc.) is NOT in here — it's a
 * plain mutable object owned by the game scene for speed; the scene pushes
 * a small HUD snapshot into `hud` a few times per second.
 */
export const useGame = create((set, get) => ({
  backend: null,
  ready: false,
  lang: prefs.lang || 'en',
  settings: { muted: false, music: 0.6, sfx: 0.8, ...(prefs.settings || {}) },
  screen: 'welcome',
  overlay: null, // 'instructions' | 'leaderboard' | 'pause' | null
  profile: null,
  profiles: [],
  stageId: 1,
  mapSelected: 1,
  runKey: 0,
  question: null, // { questionId }
  results: null,
  gameOver: false,
  toasts: [],
  hud: { coins: 0, stars: 0, hearts: 3, progress: 0, power: null, powerT: 0, onPipe: false, runCoins: 0, runStars: 0 },

  t: () => STRINGS[get().lang],

  async init() {
    applySettings(get().settings);
    const backend = await createBackend();
    await backend.init();
    const profiles = await backend.listProfiles();
    set({ backend, profiles, ready: true });
  },

  setLang(lang) {
    set({ lang });
    savePrefs({ lang, settings: get().settings });
  },
  updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    applySettings(settings);
    savePrefs({ lang: get().lang, settings });
  },

  go(screen) {
    set({ screen, overlay: null });
    setMusicMode(screen === 'game' ? 'adventure' : screen === 'victory' ? 'victory' : 'menu');
  },
  setOverlay(overlay) { set({ overlay }); },
  selectOnMap(id) { set({ mapSelected: id }); },

  async createProfile(name) {
    const p = await get().backend.createProfile(name);
    refreshBadges(p);
    set({ profile: p, profiles: await get().backend.listProfiles() });
    get().go('map');
  },
  async openProfile(id) {
    const p = await get().backend.openProfile(id);
    if (!p) return;
    set({ profile: p });
    get().go('map');
  },
  async save() {
    const { profile, backend } = get();
    if (!profile) return;
    await backend.saveProfile(profile);
    set({ profile: { ...profile } });
  },
  logout() { set({ profile: null }); get().go('welcome'); },

  playStage(stageId) {
    const { profile } = get();
    if (!profile || !isStageUnlocked(profile, stageId)) return false;
    set({ stageId, runKey: get().runKey + 1, results: null, question: null, gameOver: false, overlay: null });
    get().go('game');
    return true;
  },

  openQuestion(questionId) { set({ question: { questionId } }); },
  closeQuestionPanel() { set({ question: null }); },

  /** Grade an answer, award coins (never twice) and save. */
  async answer(questionId, chosen, opts = {}) {
    const { profile, backend } = get();
    const r = recordAnswer(profile, questionId, chosen, opts);
    if (r.correct) { sfx.correct(); if (r.star) setTimeout(() => sfx.star(), 350); } else sfx.wrong();
    backend.logAnswer(profile, questionId, chosen, r.correct);
    refreshBadges(profile);
    await get().save();
    return r;
  },

  /** The student opened a hint before answering (no Knowledge Star for this one). */
  async requestHint(questionId) {
    markHintUsed(get().profile, questionId);
    await get().save();
  },

  /** Open a Star Treasury chest: bonus coins + a new title, once per milestone. */
  async claimReward(id) {
    const { profile } = get();
    const r = claimStarReward(profile, id);
    if (!r) return null;
    sfx.fanfare();
    refreshBadges(profile);
    await get().save();
    return r;
  },

  /** Stage finished: store best results, award badges, show results. */
  async finishStage(run) {
    const { profile, stageId } = get();
    const before = totals(profile);
    const badges = completeStage(profile, stageId, run);
    await get().save();
    const after = totals(get().profile);
    const ratingBefore = run.ratingBefore ?? 0;
    set({ results: { stageId, run, badges, gained: after.score - before.score, final: stageId === TOTAL_STAGES, rating: stageRating(get().profile, stageId), ratingBefore } });
  },

  toast(text, kind = 'info') {
    const id = Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts.slice(-2), { id, text, kind }] });
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== id) }), 2600);
  },
  setHud(hud) { set({ hud }); },
  setGameOver(v) { set({ gameOver: v }); },
}));
