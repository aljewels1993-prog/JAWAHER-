import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Confetti, Modal } from '../components/ui';
import { Mascot, type Mood } from '../components/Mascot';
import { useI18n } from '../i18n';
import { ACHIEVEMENT_TEXT } from '../i18n/achievements';
import { ACHIEVEMENT_RULES } from '../lib/rewards';
import { nextMessage } from '../lib/motivation';
import { playChime } from '../lib/sound';
import type { RewardResult } from '../api/types';
import { useAuth } from './auth';

type ToastKind = 'info' | 'success' | 'points' | 'error';
interface Toast { id: number; text: string; kind: ToastKind; icon: string }
interface Reaction { id: number; mood: Mood; text: string }

interface Feedback {
  toast: (text: string, kind?: ToastKind, icon?: string) => void;
  react: (mood: Mood, text: string, ms?: number) => void;
  /** Shows points, mascot reaction, motivation and badge unlocks for a reward. */
  celebrate: (result: RewardResult, source: 'task' | 'session') => void;
  /** Increments when study data changed, so pages can reload. */
  version: number;
  bump: () => void;
}

const Ctx = createContext<Feedback | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { t, lang } = useI18n();
  const { setPoints } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [confetti, setConfetti] = useState(0);
  const [version, setVersion] = useState(0);
  const seq = useRef(0);
  const reactTimer = useRef<number>();

  const toast = useCallback((text: string, kind: ToastKind = 'info', icon?: string) => {
    const id = ++seq.current;
    const ico = icon ?? (kind === 'success' ? '✅' : kind === 'points' ? '⭐' : kind === 'error' ? '⚠️' : '💜');
    setToasts((l) => [...l.slice(-2), { id, text, kind, icon: ico }]);
    window.setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 3200);
  }, []);

  const react = useCallback((mood: Mood, text: string, ms = 4800) => {
    const id = ++seq.current;
    setReaction({ id, mood, text });
    window.clearTimeout(reactTimer.current);
    reactTimer.current = window.setTimeout(() => setReaction((r) => (r?.id === id ? null : r)), ms);
  }, []);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const celebrate = useCallback((r: RewardResult, source: 'task' | 'session') => {
    setPoints(r.total_points);
    const motivation = nextMessage(lang);
    if (source === 'session') {
      toast(r.points_awarded ? t('timer.sessionEarned', { n: r.points_awarded }) : t('timer.sessionAlready'), r.points_awarded ? 'points' : 'success');
    } else if (r.points_awarded) {
      toast(t('planner.completedToast', { n: r.points_awarded }), 'points');
    } else {
      toast(t('planner.doneNoPoints'), 'success');
    }
    if (r.bonus_awarded) {
      window.setTimeout(() => toast(t('planner.bonusToast', { n: r.bonus_awarded }), 'points', '🎁'), 600);
      setConfetti((c) => c + 1);
    }
    if (r.new_achievements.length) {
      setBadges((b) => [...b, ...r.new_achievements]);
      setConfetti((c) => c + 1);
      react('star', `${t('mascot.badge')} ${motivation}`);
      playChime('reward');
    } else if (r.bonus_awarded) {
      react('love', `${t('mascot.bonus')} ${motivation}`);
    } else {
      react('joy', `${t(source === 'session' ? 'mascot.session' : 'mascot.task')} ${motivation}`);
    }
    bump();
  }, [bump, lang, react, setPoints, t, toast]);

  const value = useMemo(() => ({ toast, react, celebrate, version, bump }), [toast, react, celebrate, version, bump]);
  const current = badges[0];
  const rule = ACHIEVEMENT_RULES.find((r) => r.id === current);
  const text = current ? ACHIEVEMENT_TEXT[current] : null;

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" role="status">
        {toasts.map((x) => (
          <div key={x.id} className={`toast ${x.kind}`}><span className="t-ico" aria-hidden="true">{x.icon}</span><span>{x.text}</span></div>
        ))}
      </div>
      {reaction && !current && (
        <div className="companion" role="status" aria-live="polite" key={reaction.id}>
          <div className="bubble">{reaction.text}</div>
          <Mascot mood={reaction.mood} label={t('mascot.name')} onClick={() => setReaction(null)} />
        </div>
      )}
      {confetti > 0 && <Confetti key={confetti} />}
      {current && text && (
        <Modal title={t('ach.newBadge')} onClose={() => setBadges((b) => b.slice(1))}>
          <div style={{ textAlign: 'center' }}>
            <div className="rays"><div className="badge-medal unlock-medal" aria-hidden="true">{rule?.icon}</div></div>
            <h3 style={{ fontSize: '1.5rem', color: 'var(--navy)' }}>{lang === 'ar' ? text.name_ar : text.name_en}</h3>
            <p style={{ color: 'var(--ink-2)', fontWeight: 700, margin: '6px 0 16px' }}>{lang === 'ar' ? text.description_ar : text.description_en}</p>
            <div style={{ width: 110, margin: '0 auto 12px' }}><Mascot mood="star" /></div>
            <button className="btn gold big" onClick={() => setBadges((b) => b.slice(1))}>{t('ach.awesome')} 🎉</button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function useFeedback(): Feedback {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFeedback outside FeedbackProvider');
  return v;
}
