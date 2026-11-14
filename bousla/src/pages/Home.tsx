import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Task } from '../api/types';
import { useI18n, type MessageKey } from '../i18n';
import { useStudent } from '../state/auth';
import { useFeedback } from '../state/feedback';
import { useTimer } from '../state/timer';
import { useAsync } from '../state/useAsync';
import { Mascot, type Mood } from '../components/Mascot';
import { Bar, Empty, LoadError, ProgressRing, Stat, Spinner } from '../components/ui';
import { TaskForm, TaskItem, useTaskToggle } from '../components/Tasks';
import { addDays, formatDate, splitMinutes, todayIso } from '../lib/dates';
import { levelFor, REWARDS } from '../lib/rewards';
import { messageOfTheDay, nextMessage } from '../lib/motivation';
import { formatClock } from '../lib/timer';

// Served from public/media. The framed preview page loads it from beside the page.
const MEDIA = import.meta.env.VITE_ROUTER === 'memory' ? 'media/' : '/media/';

export function HomePage() {
  const { t, lang } = useI18n();
  const student = useStudent();
  const { version } = useFeedback();
  const timer = useTimer();
  const today = todayIso();
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [tap, setTap] = useState<{ mood: Mood; text: string } | null>(null);

  const stats = useAsync(() => api.getStats(), [version]);
  const tasks = useAsync(() => api.listTasks(today, addDays(today, 14)), [version, today]);
  const toggle = useTaskToggle((changed) => tasks.setData((tasks.data ?? []).map((x) => (x.id === changed.id ? changed : x))));

  const hour = new Date().getHours();
  const greetKey: MessageKey = hour < 12 ? 'home.morning' : hour < 17 ? 'home.afternoon' : 'home.evening';
  const firstName = student.full_name.split(/\s+/)[0];
  const level = levelFor(student.total_points);
  const s = stats.data;
  const todayTasks = (tasks.data ?? []).filter((x) => x.task_date === today);
  const upcoming = (tasks.data ?? []).filter((x) => x.task_date > today && !x.completed).slice(0, 5);
  const done = todayTasks.filter((x) => x.completed).length;
  const pct = todayTasks.length ? done / todayTasks.length : 0;
  const study = splitMinutes(s?.study_minutes ?? 0);
  const studyText = study.hours ? t('common.hm', { h: study.hours, m: study.minutes }) : t('common.minutes', { n: study.minutes });

  const boost = () => {
    const moods: Mood[] = ['joy', 'wink', 'love', 'star'];
    setTap({ mood: moods[Math.floor(Math.random() * moods.length)], text: nextMessage(lang) });
  };

  const bonusLine = todayTasks.length < REWARDS.dailyBonusMinTasks
    ? t('home.bonusHint')
    : done === todayTasks.length ? t('home.bonusDone') : t('home.bonusReady');

  return (
    <div className="page">
      <section className="hero" aria-labelledby="greeting">
        <div className="hero-text">
          <p className="date">📅 {formatDate(today, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 id="greeting">{t(greetKey, { name: firstName })}</h1>
          <span className="level-pill">🏅 {t('level.number', { n: level.index + 1 })} · {t(`level.${level.index}` as MessageKey)}</span>
          {s && s.current_streak > 1 && <span className="level-pill" style={{ marginInlineStart: 6 }}>🔥 {t('home.streak', { n: s.current_streak })}</span>}
          <div><div className="bubble" key={tap?.text ?? 'hello'} aria-live="polite">{tap?.text ?? t('mascot.hello')}</div></div>
        </div>
        <Mascot mood={tap?.mood ?? 'idle'} onClick={boost} label={t('mascot.tap')} />
      </section>

      <section className="card about-card" aria-labelledby="about-h" style={{ marginTop: 16 }}>
        <h2 id="about-h">🧭 {t('home.aboutTitle')}</h2>
        <p className="about-sub">{t('home.aboutSub')}</p>
        <div className="video-frame">
          <video controls playsInline preload="none" poster={`${MEDIA}bousla-intro-poster.jpg`} aria-label={t('home.aboutVideo')}>
            <source src={`${MEDIA}bousla-intro.mp4`} type="video/mp4" />
            {t('home.videoUnsupported')}
          </video>
        </div>
      </section>

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <Stat icon="⭐" tone="gold" value={student.total_points} label={t('home.points')} />
        <Stat icon="✅" tone="mint" value={s ? s.tasks_completed : '…'} label={t('home.tasksDone')} />
        <Stat icon="⏱️" tone="blue" value={s ? studyText : '…'} label={t('home.studyHours')} />
        <Stat icon="🏅" tone="purple" value={level.index + 1} label={t(`level.${level.index}` as MessageKey)} />
      </div>

      {stats.error ? <div style={{ marginTop: 12 }}><LoadError error={stats.error} onRetry={stats.reload} /></div> : null}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card tint-purple" aria-labelledby="progress-h">
          <div className="card-head"><h2 id="progress-h">📈 {t('home.dailyProgress')}</h2></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <ProgressRing value={pct} size={118} label={t('home.dailyProgress')}>
              <div><div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--navy)' }}>{Math.round(pct * 100)}%</div></div>
            </ProgressRing>
            <div style={{ flex: 1, minWidth: 160 }}>
              <p style={{ fontWeight: 800, marginBottom: 6 }}>
                {todayTasks.length ? t('home.dailyProgressDetail', { done, total: todayTasks.length }) : t('home.noPlanToday')}
              </p>
              <p style={{ color: 'var(--ink-2)', fontSize: '0.9rem', fontWeight: 600, marginBottom: 10 }}>🎁 {bonusLine}</p>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>
                {level.next ? t('level.next', { n: level.next - student.total_points, name: t(`level.${level.index + 1}` as MessageKey) }) : t('level.max')}
              </p>
              <Bar value={level.progress} tone="gold" label={t('home.level')} />
            </div>
          </div>
        </section>

        <section className="card tint-pink" aria-labelledby="motd-h">
          <div className="card-head"><h2 id="motd-h">💌 {t('home.messageOfDay')}</h2></div>
          <div className="quote">
            <span className="q-ico" aria-hidden="true">🌸</span>
            <p>{messageOfTheDay(lang, today)}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            {timer.state.phase !== 'idle' ? (
              <Link className="btn mint" to="/timer">⏱️ {t('home.timerRunning')} · <span dir="ltr">{formatClock(timer.remaining)}</span></Link>
            ) : (
              <Link className="btn mint" to="/timer">⏱️ {t('home.startTimer')}</Link>
            )}
            <button className="btn secondary" onClick={() => setEditing('new')}>＋ {t('planner.addTask')}</button>
          </div>
        </section>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card" aria-labelledby="sched-h">
          <div className="card-head">
            <h2 id="sched-h">🗓️ {t('home.schedule')}</h2>
            <Link to="/planner" className="chip">{t('home.seeAll')}</Link>
          </div>
          {tasks.loading && !tasks.data ? <Spinner /> : tasks.error ? <LoadError error={tasks.error} onRetry={tasks.reload} /> : todayTasks.length ? (
            <div className="task-list">
              {todayTasks.map((x) => <TaskItem key={x.id} task={x} onToggle={toggle} onEdit={setEditing} compact />)}
            </div>
          ) : (
            <Empty icon="🌱" action={<button className="btn small" onClick={() => setEditing('new')}>{t('home.planNow')}</button>}>{t('home.noTasksToday')}</Empty>
          )}
        </section>

        <section className="card" aria-labelledby="up-h">
          <div className="card-head"><h2 id="up-h">🚀 {t('home.upcoming')}</h2></div>
          {tasks.loading && !tasks.data ? <Spinner /> : upcoming.length ? (
            <div className="task-list">
              {upcoming.map((x) => (
                <div key={x.id}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--muted)', margin: '0 4px 4px' }}>
                    {x.task_date === addDays(today, 1) ? t('common.tomorrow') : formatDate(x.task_date, lang, { weekday: 'long', day: 'numeric', month: 'short' })}
                  </div>
                  <TaskItem task={x} onToggle={toggle} onEdit={setEditing} compact />
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="🎈">{t('home.noUpcoming')}</Empty>
          )}
        </section>
      </div>

      {editing && (
        <TaskForm task={editing === 'new' ? undefined : editing} date={today} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void tasks.reload(); void stats.reload(); }} />
      )}
    </div>
  );
}
