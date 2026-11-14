import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../api';
import { ApiError } from '../api/types';
import {
  IDLE, isFinished, isRunning, pause as pauseState, remainingMs, restore, resume as resumeState, startPhase, type TimerState,
} from '../lib/timer';
import { breakMinutesFor } from '../lib/rewards';
import { playChime, unlockAudio } from '../lib/sound';
import { showSystemNotification } from '../lib/browserNotify';
import { useI18n } from '../i18n';
import { errorText } from '../components/ui';
import { useAuth } from './auth';
import { useFeedback } from './feedback';

const KEY = 'bousla.timer.v1';
const SOUND_KEY = 'bousla.sound.v1';

interface TimerApi {
  state: TimerState;
  now: number;
  remaining: number;
  running: boolean;
  finished: boolean;
  saving: boolean;
  sound: boolean;
  setSound: (on: boolean) => void;
  startFocus: (minutes: number, subject: string | null) => Promise<boolean>;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  startBreak: () => void;
  dismiss: () => void;
}

const Ctx = createContext<TimerApi | null>(null);

function load(userId: string | undefined): TimerState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.userId === userId) return restore(raw.state);
  } catch { /* ignore */ }
  return IDLE;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { account } = useAuth();
  const { celebrate, toast, react } = useFeedback();
  const userId = account?.userId;
  const [state, setState] = useState<TimerState>(() => load(userId));
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [sound, setSoundState] = useState(() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } });
  const retryAt = useRef(0);
  const inFlight = useRef(false);
  const warned = useRef(false);

  // Reload when the signed-in user changes.
  useEffect(() => { setState(load(userId)); }, [userId]);

  // Persist every change, so a refresh or a crash recovers the session.
  useEffect(() => {
    if (!userId) return;
    try { localStorage.setItem(KEY, JSON.stringify({ userId, state })); } catch { /* storage blocked */ }
  }, [state, userId]);

  // Tick while running; catch up instantly when the tab becomes visible again.
  useEffect(() => {
    const sync = () => setNow(Date.now());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    const id = state.phase !== 'idle' ? window.setInterval(sync, 250) : undefined;
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      if (id) window.clearInterval(id);
    };
  }, [state.phase]);

  const finished = isFinished(state, now);

  const report = useCallback(async (s: TimerState) => {
    if (!s.sessionId || inFlight.current || Date.now() < retryAt.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      const r = await api.completeSession(s.sessionId);
      if (r.status === 'too_early') {
        // The device clock ran ahead of the server: try again when the server agrees.
        retryAt.current = Date.now() + (r.remaining_seconds + 1) * 1000;
        return;
      }
      setState((cur) => (cur.sessionId === s.sessionId ? { ...cur, reported: true } : cur));
      celebrate(r, 'session');
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'not_found' || e.code === 'session_cancelled')) {
        setState((cur) => (cur.sessionId === s.sessionId ? { ...cur, reported: true } : cur));
        toast(errorText(t, e), 'error');
        return;
      }
      if (!warned.current) { toast(t('timer.saveFailed'), 'error'); warned.current = true; }
      retryAt.current = Date.now() + 15_000;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [celebrate, t, toast]);

  // End of a phase: sound + notification once, and report focus sessions.
  useEffect(() => {
    if (!finished) return;
    if (!state.alerted) {
      setState((s) => ({ ...s, alerted: true }));
      if (sound) playChime(state.phase === 'focus' ? 'finish' : 'break');
      if (state.phase === 'focus') {
        void showSystemNotification(t('timer.notifyTitle'), t('timer.notifyBody'), '/timer', 'bousla-timer');
      } else {
        void showSystemNotification(t('timer.breakDoneTitle'), t('timer.breakNotifyBody'), '/timer', 'bousla-timer');
        react('wink', t('timer.breakDoneBody'));
      }
    }
    if (state.phase === 'focus' && !state.reported) void report(state);
  }, [finished, now, state, sound, report, t, react]);

  const startFocus = useCallback(async (minutes: number, subject: string | null) => {
    unlockAudio();
    warned.current = false;
    retryAt.current = 0;
    try {
      const s = await api.startSession(minutes, subject);
      setState(startPhase('focus', minutes, Date.now(), { focusMinutes: minutes, subject, sessionId: s.id }));
      setNow(Date.now());
      react('focus', t('mascot.focus'), 3500);
      return true;
    } catch (e) {
      toast(e instanceof ApiError && e.code !== 'unknown' ? errorText(t, e) : t('timer.startFailed'), 'error');
      return false;
    }
  }, [react, t, toast]);

  const pause = useCallback(() => setState((s) => pauseState(s, Date.now())), []);
  const resume = useCallback(() => { unlockAudio(); setState((s) => resumeState(s, Date.now())); }, []);
  const reset = useCallback(() => {
    setState((s) => {
      if (s.phase === 'focus' && s.sessionId && !s.reported) void api.cancelSession(s.sessionId).catch(() => {});
      return { ...IDLE, focusMinutes: s.focusMinutes, subject: s.subject };
    });
  }, []);
  const startBreak = useCallback(() => {
    unlockAudio();
    setState((s) => startPhase('break', breakMinutesFor(s.focusMinutes), Date.now(), { focusMinutes: s.focusMinutes, subject: s.subject }));
    setNow(Date.now());
    react('sleepy', t('mascot.break'), 3500);
  }, [react, t]);
  const dismiss = useCallback(() => setState((s) => ({ ...IDLE, focusMinutes: s.focusMinutes, subject: s.subject })), []);
  const setSound = useCallback((on: boolean) => {
    setSoundState(on);
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
  }, []);

  const value = useMemo<TimerApi>(() => ({
    state, now, remaining: remainingMs(state, now), running: isRunning(state) && !finished, finished, saving, sound,
    setSound, startFocus, pause, resume, reset, startBreak, dismiss,
  }), [state, now, finished, saving, sound, setSound, startFocus, pause, resume, reset, startBreak, dismiss]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTimer(): TimerApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTimer outside TimerProvider');
  return v;
}
