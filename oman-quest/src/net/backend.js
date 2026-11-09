import { newProfile, totals } from '../game/progress.js';

/**
 * Storage for student progress, the leaderboard and the teacher dashboard.
 *
 * - Cloud mode (Supabase): used when VITE_SUPABASE_URL and
 *   VITE_SUPABASE_ANON_KEY are set at build time. Each student is an
 *   anonymous Supabase user; Row Level Security (see supabase/schema.sql) lets
 *   a student touch only their own row. Teachers sign in with email/password
 *   and must be listed in the `teachers` table. Only the public anon key is
 *   ever shipped to the browser — never the service-role key.
 * - Local mode: everything is kept in this browser (great for one classroom
 *   iPad or offline use). The teacher dashboard is protected by a PIN.
 *
 * Profiles are always cached locally too, so the game keeps working offline.
 */
const LS = {
  profiles: 'oeq.profiles.v1',
  current: 'oeq.current.v1',
  sessions: 'oeq.sessions.v1',
  pin: 'oeq.teacherPin.v1',
};

function storage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* private mode */ }
  const mem = {};
  return { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
}

const readJSON = (s, k, fallback) => {
  try { const v = s.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const writeJSON = (s, k, v) => { try { s.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };

const uuid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const summary = (p) => {
  const t = totals(p);
  return { id: p.id, name: p.name, score: t.score, coins: t.coins, stars: t.stars, stages: t.stagesCompleted, questionsDone: t.questionsDone, correct: t.correct, wrongAnswers: t.wrongAnswers, updatedAt: p.savedAt };
};

/** Wrong answers of a profile, for the teacher view. */
export function wrongAnswerList(p) {
  return Object.entries(p.answers || {}).filter(([, a]) => a.wrong?.length).map(([qid, a]) => ({ questionId: qid, wrong: a.wrong, solved: a.rewarded }));
}

// ───────────────────────────── Local backend ─────────────────────────────
export function createLocalBackend(store = storage()) {
  const all = () => readJSON(store, LS.profiles, {});
  return {
    mode: 'local',
    async init() {},
    async listProfiles() {
      return Object.values(all()).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    },
    async createProfile(name) {
      const p = newProfile(name, uuid());
      const map = all(); map[p.id] = p; writeJSON(store, LS.profiles, map);
      store.setItem(LS.current, p.id);
      return p;
    },
    async openProfile(id) {
      const p = all()[id] || null;
      if (p) store.setItem(LS.current, id);
      return p;
    },
    currentId: () => store.getItem(LS.current),
    async saveProfile(p) {
      p.savedAt = new Date().toISOString();
      const map = all(); map[p.id] = p; writeJSON(store, LS.profiles, map);
    },
    async logAnswer() { /* answers are inside the profile in local mode */ },
    async leaderboard() {
      return Object.values(all()).map(summary).sort((a, b) => b.score - a.score).slice(0, 20)
        .map(({ name, score, stages, coins }) => ({ name, score, stages, coins }));
    },
    // Teacher (device PIN)
    teacherNeedsSetup: () => !store.getItem(LS.pin),
    async teacherSetup(pin) {
      if (String(pin).length < 4) throw new Error('PIN must be at least 4 digits');
      store.setItem(LS.pin, await sha256(`oeq:${pin}`));
      return true;
    },
    async teacherLogin(pin) {
      const ok = (await sha256(`oeq:${pin}`)) === store.getItem(LS.pin);
      if (!ok) throw new Error('Wrong PIN');
      return true;
    },
    async teacherLogout() {},
    async teacherStudents() {
      return Object.values(all()).map((p) => ({ ...summary(p), wrong: wrongAnswerList(p), stagesDetail: p.stages }));
    },
    async teacherReset(id) {
      const map = all();
      if (!map[id]) return;
      const fresh = newProfile(map[id].name, id);
      map[id] = fresh; writeJSON(store, LS.profiles, map);
    },
  };
}

// ───────────────────────────── Cloud backend ─────────────────────────────
export async function createCloudBackend(url, anonKey, store = storage()) {
  const { createClient } = await import('@supabase/supabase-js');
  const local = createLocalBackend(store);
  // Student client: we swap sessions per profile ourselves (shared iPads).
  const sb = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: true } });
  // Teacher client keeps its own session, separate from students.
  const tb = createClient(url, anonKey, { auth: { persistSession: true, storageKey: 'oeq-teacher-auth' } });
  const sessions = () => readJSON(store, LS.sessions, {});
  const saveSession = (pid, s) => {
    if (!s) return;
    const m = sessions(); m[pid] = { access_token: s.access_token, refresh_token: s.refresh_token }; writeJSON(store, LS.sessions, m);
  };
  let activeId = null;
  sb.auth.onAuthStateChange((_e, session) => { if (activeId && session) saveSession(activeId, session); });

  const rowOf = (p) => {
    const t = totals(p);
    return {
      id: p.id, display_name: p.name, progress: p, total_score: t.score, coins: t.coins, stars: t.stars,
      stages_completed: t.stagesCompleted, questions_done: t.questionsDone, updated_at: new Date().toISOString(),
    };
  };

  async function useProfileSession(pid) {
    const s = sessions()[pid];
    if (!s) return false;
    const { data, error } = await sb.auth.setSession(s);
    if (error || !data.session) return false;
    activeId = pid; saveSession(pid, data.session);
    return true;
  }

  return {
    mode: 'cloud',
    async init() {},
    listProfiles: local.listProfiles,
    currentId: local.currentId,
    async createProfile(name) {
      await sb.auth.signOut({ scope: 'local' }).catch(() => {});
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      const p = newProfile(name, data.user.id);
      activeId = p.id; saveSession(p.id, data.session);
      const { error: e2 } = await sb.from('students').insert(rowOf(p));
      if (e2) throw e2;
      await local.saveProfile(p);
      store.setItem(LS.current, p.id);
      return p;
    },
    async openProfile(id) {
      let p = await local.openProfile(id);
      if (await useProfileSession(id)) {
        // Pull the server copy — a teacher reset or another device may be newer.
        const { data } = await sb.from('students').select('progress, updated_at').eq('id', id).maybeSingle();
        if (data?.progress && (!p || (data.updated_at || '') > (p.savedAt || ''))) {
          p = data.progress?.id ? data.progress : newProfile(p?.name || 'Student', id);
          await local.saveProfile(p);
        }
      }
      return p;
    },
    async saveProfile(p) {
      await local.saveProfile(p);
      if (activeId !== p.id && !(await useProfileSession(p.id))) return;
      const row = rowOf(p);
      row.updated_at = p.savedAt;
      const { error } = await sb.from('students').update(row).eq('id', p.id);
      if (error) console.warn('Cloud save failed – kept on this device', error.message);
    },
    async logAnswer(p, questionId, chosen, correct) {
      if (activeId !== p.id) return;
      await sb.from('answer_log').insert({ student_id: p.id, question_id: questionId, chosen, correct }).then(() => {}, () => {});
    },
    async leaderboard() {
      const { data, error } = await sb.rpc('get_leaderboard');
      if (error) return local.leaderboard();
      return data.map((r) => ({ name: r.display_name, score: r.total_score, stages: r.stages_completed, coins: r.coins }));
    },
    teacherNeedsSetup: () => false,
    async teacherSetup() { return false; },
    async teacherLogin(email, password) {
      const { error } = await tb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: ok, error: e2 } = await tb.rpc('is_teacher');
      if (e2 || !ok) { await tb.auth.signOut(); throw new Error('This account is not registered as a teacher.'); }
      return true;
    },
    async teacherLogout() { await tb.auth.signOut(); },
    async teacherStudents() {
      const { data, error } = await tb.from('students').select('id, display_name, progress, total_score, coins, stars, stages_completed, questions_done, updated_at').order('total_score', { ascending: false });
      if (error) throw error;
      return data.map((r) => {
        const p = r.progress?.id ? r.progress : newProfile(r.display_name, r.id);
        return { ...summary(p), name: r.display_name, score: r.total_score, updatedAt: r.updated_at, wrong: wrongAnswerList(p), stagesDetail: p.stages };
      });
    },
    async teacherReset(id) {
      const { error } = await tb.rpc('reset_student', { sid: id });
      if (error) throw error;
    },
  };
}

/** Pick the backend from build-time env vars. */
export async function createBackend() {
  const env = import.meta.env || {};
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    try { return await createCloudBackend(url, key); } catch (e) { console.warn('Supabase unavailable, using this device', e); }
  }
  return createLocalBackend();
}
