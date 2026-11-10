import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { subjectLabel, useI18n } from '../i18n';
import { useTimer } from '../state/timer';
import { useStudent } from '../state/auth';
import { Mascot, type Mood } from '../components/Mascot';
import { Modal, ProgressRing } from '../components/ui';
import { formatClock, progress } from '../lib/timer';
import { REWARDS, TIMER_PRESETS, breakMinutesFor } from '../lib/rewards';
import { allSubjects, subjectIcon } from '../lib/subjects';

export default function TimerPage() {
  const { t, lang } = useI18n();
  const timer = useTimer();
  const student = useStudent();
  const loc = useLocation() as { state?: { subject?: string } };
  const { state, now, remaining, running, finished } = timer;
  const [minutes, setMinutes] = useState<number>(state.focusMinutes || 25);
  const [custom, setCustom] = useState(!TIMER_PRESETS.includes(state.focusMinutes as 25));
  const [customValue, setCustomValue] = useState(String(state.focusMinutes || 40));
  const [subject, setSubject] = useState<string>(loc.state?.subject ?? state.subject ?? '');
  const [starting, setStarting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const idle = state.phase === 'idle';
  const paused = state.pausedAt !== null && !finished;

  const customNum = Number(customValue);
  const customOk = Number.isInteger(customNum) && customNum >= REWARDS.minSessionMinutes && customNum <= REWARDS.maxSessionMinutes;
  const chosen = custom ? customNum : minutes;

  const start = async () => {
    if (custom && !customOk) return;
    setStarting(true);
    await timer.startFocus(chosen, subject || null);
    setStarting(false);
  };

  const mood: Mood = finished ? (state.phase === 'focus' ? 'joy' : 'wink') : state.phase === 'break' ? 'sleepy' : running ? 'focus' : 'idle';
  const ringColor = state.phase === 'break' ? 'url(#ringMint)' : 'url(#ringGrad)';
  const phaseLabel = idle ? t('timer.ready') : paused ? t('timer.paused') : state.phase === 'focus' ? t('timer.focus') : t('timer.break');
  const display = idle ? formatClock((custom ? (customOk ? customNum : 0) : minutes) * 60_000) : formatClock(remaining);
  const ringSize = Math.min(300, Math.max(220, Math.floor((typeof window !== 'undefined' ? window.innerWidth : 360) - 120)));

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>⏱️ {t('timer.title')}</h1>
          <p>{t('timer.sub')}</p>
        </div>
        <label className="chip" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={timer.sound} onChange={(e) => timer.setSound(e.target.checked)} /> 🔊 {t('timer.sound')}
        </label>
      </div>

      <div className="grid-2">
        <section className={`card ${state.phase === 'break' ? 'tint-mint' : 'tint-purple'}`} aria-labelledby="clock-h" style={{ textAlign: 'center' }}>
          <h2 id="clock-h" className="sr-only">{t('timer.title')}</h2>
          <div className="timer-face">
            <ProgressRing value={idle ? 0 : progress(state, now)} size={ringSize} stroke={18} color={ringColor} label={phaseLabel}>
              <div>
                <div style={{ width: ringSize * 0.3, margin: '0 auto' }}><Mascot mood={mood} /></div>
                <div className="timer-clock" role="timer" aria-live="off">{display}</div>
                <div className="timer-phase">{phaseLabel}{state.subject && !idle ? ` · ${subjectLabel(lang, state.subject)}` : ''}</div>
              </div>
            </ProgressRing>
          </div>

          {finished && state.phase === 'focus' ? (
            <div className="bubble" style={{ marginBottom: 14 }} role="status">
              <h3 style={{ color: 'var(--navy)' }}>{t('timer.finishedTitle')}</h3>
              <p style={{ margin: '6px 0 12px' }}>{timer.saving ? t('timer.saving') : t('timer.finishedBody', { n: state.focusMinutes })}</p>
              <div className="timer-controls">
                <button className="btn mint" onClick={timer.startBreak}>☕ {t('timer.startBreak', { n: breakMinutesFor(state.focusMinutes) })}</button>
                <button className="btn ghost" onClick={timer.dismiss}>{t('timer.skipBreak')}</button>
              </div>
            </div>
          ) : finished && state.phase === 'break' ? (
            <div className="bubble" style={{ marginBottom: 14 }} role="status">
              <h3 style={{ color: 'var(--navy)' }}>{t('timer.breakDoneTitle')}</h3>
              <p style={{ margin: '6px 0 12px' }}>{t('timer.breakDoneBody')}</p>
              <button className="btn" onClick={timer.dismiss}>👍 {t('common.close')}</button>
            </div>
          ) : (
            <div className="timer-controls">
              {idle && <button className="btn big" onClick={() => void start()} disabled={starting || (custom && !customOk)}>▶ {starting ? t('common.loading') : t('timer.start')}</button>}
              {!idle && !paused && <button className="btn big secondary" onClick={timer.pause}>⏸ {t('timer.pause')}</button>}
              {!idle && paused && <button className="btn big" onClick={timer.resume}>▶ {t('timer.resume')}</button>}
              {!idle && <button className="btn big ghost" onClick={() => (state.phase === 'focus' ? setConfirmReset(true) : timer.reset())}>↺ {t('timer.reset')}</button>}
            </div>
          )}
          <p style={{ marginTop: 14, color: 'var(--muted)', fontWeight: 700, fontSize: '0.85rem' }}>ℹ️ {t('timer.keepsRunning')}</p>
        </section>

        <section className="card" aria-labelledby="setup-h">
          <h2 id="setup-h">⚙️ {t('timer.focus')}</h2>
          <fieldset disabled={!idle} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="sr-only">{t('timer.focus')}</legend>
            <div className="preset-grid" style={{ marginBottom: 14 }}>
              {TIMER_PRESETS.map((m) => (
                <button key={m} type="button" className="preset" aria-pressed={!custom && minutes === m} onClick={() => { setCustom(false); setMinutes(m); }}>
                  <b>{m}</b><small>{t('common.minutes', { n: '' }).trim()}</small>
                </button>
              ))}
              <button type="button" className="preset" aria-pressed={custom} onClick={() => setCustom(true)}>
                <b>✏️</b><small>{t('timer.custom')}</small>
              </button>
            </div>
            {custom && (
              <div className="field">
                <label htmlFor="custom-min">{t('timer.customMinutes')}</label>
                <input id="custom-min" className="input" type="number" inputMode="numeric" min={REWARDS.minSessionMinutes} max={REWARDS.maxSessionMinutes}
                  value={customValue} onChange={(e) => setCustomValue(e.target.value)} aria-invalid={!customOk} />
                {!customOk && <span className="hint bad">{t('timer.rangeHint')}</span>}
              </div>
            )}
            <div className="field">
              <label htmlFor="subject">{t('timer.subject')}</label>
              <select id="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">{t('timer.noSubject')}</option>
                {allSubjects(student.custom_subjects).map((s) => <option key={s} value={s}>{subjectIcon(s)} {subjectLabel(lang, s)}</option>)}
              </select>
            </div>
          </fieldset>
          <div className="alert info" style={{ marginBottom: 0 }}>⭐ {t('timer.pointsInfo')}</div>
        </section>
      </div>

      {confirmReset && (
        <Modal title={t('timer.resetConfirm')} onClose={() => setConfirmReset(false)}>
          <div className="actions">
            <button className="btn ghost" onClick={() => setConfirmReset(false)}>{t('common.cancel')}</button>
            <button className="btn pink" onClick={() => { timer.reset(); setConfirmReset(false); }}>↺ {t('timer.reset')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
