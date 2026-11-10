import { api } from '../api';
import type { Achievement, StudentStats } from '../api/types';
import { useI18n, type MessageKey } from '../i18n';
import { useStudent } from '../state/auth';
import { useFeedback } from '../state/feedback';
import { useAsync } from '../state/useAsync';
import { Bar, Empty, LoadError, ProgressRing, Spinner } from '../components/ui';
import { Mascot } from '../components/Mascot';
import { formatDate, formatDateTime } from '../lib/dates';
import { REWARDS, levelFor, badgeProgress, type ProgressStats } from '../lib/rewards';

export function progressStats(s: StudentStats): ProgressStats {
  return {
    sessions_completed: s.sessions_completed,
    study_minutes: s.study_minutes,
    tasks_completed: s.tasks_completed,
    total_points: s.total_points,
    study_streak_days: s.best_streak,
  };
}

export function BadgeCard({ a, unlockedAt, stats }: { a: Achievement; unlockedAt?: string; stats?: ProgressStats }) {
  const { t, lang } = useI18n();
  const p = stats ? badgeProgress(stats, a) : 0;
  return (
    <div className={`badge-card${unlockedAt ? '' : ' locked'}`}>
      <div className="badge-medal" aria-hidden="true">{unlockedAt ? a.icon : '🔒'}</div>
      <h3>{lang === 'ar' ? a.name_ar : a.name_en} {!unlockedAt && <span aria-hidden="true">{a.icon}</span>}</h3>
      <p>{lang === 'ar' ? a.description_ar : a.description_en}</p>
      {unlockedAt ? (
        <span className="chip" style={{ background: 'var(--gold-soft)', color: '#7a5a00' }}>✨ {t('ach.unlockedOn', { date: formatDate(unlockedAt.slice(0, 10), lang, { day: 'numeric', month: 'short' }) })}</span>
      ) : stats ? (
        <div style={{ width: '100%' }}>
          <Bar value={p} label={lang === 'ar' ? a.name_ar : a.name_en} />
          <p style={{ marginTop: 4 }}>{t('ach.progress', { v: Math.min(stats[a.criteria_type], a.threshold), t: a.threshold })}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function AchievementsPage() {
  const { t, lang } = useI18n();
  const student = useStudent();
  const { version } = useFeedback();
  const data = useAsync(() => Promise.all([api.listAchievements(), api.listStudentAchievements(), api.getStats(), api.listPoints(30)]), [version]);
  const level = levelFor(student.total_points);

  if (data.error) return <div className="page"><LoadError error={data.error} onRetry={data.reload} /></div>;
  if (!data.data) return <div className="page"><Spinner /></div>;
  const [catalogue, mine, stats, points] = data.data;
  const unlocked = new Map(mine.map((m) => [m.achievement_id, m.unlocked_at]));
  const earned = catalogue.filter((a) => unlocked.has(a.id));
  const locked = catalogue.filter((a) => !unlocked.has(a.id));
  const ps = progressStats(stats);

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>🏆 {t('ach.title')}</h1>
          <p>{t('ach.sub')}</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="card tint-cream" aria-labelledby="lvl-h" style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <ProgressRing value={level.progress} size={130} stroke={14} label={t('home.level')}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)' }}>{t('home.level')}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>{level.index + 1}</div>
            </div>
          </ProgressRing>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h2 id="lvl-h" style={{ marginBottom: 2 }}>{t(`level.${level.index}` as MessageKey)}</h2>
            <p style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1.2 }}>⭐ {student.total_points}</p>
            <p style={{ fontWeight: 700, color: 'var(--ink-2)' }}>
              {level.next ? t('level.next', { n: level.next - student.total_points, name: t(`level.${level.index + 1}` as MessageKey) }) : t('level.max')}
            </p>
          </div>
        </section>

        <section className="card tint-mint" aria-labelledby="how-h">
          <h2 id="how-h">💡 {t('ach.howTitle')}</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8, fontWeight: 700 }}>
            <li>⏱️ {t('ach.how.session')} <b style={{ color: 'var(--mint-deep)' }}>+{REWARDS.sessionPoints}</b></li>
            <li>✅ {t('ach.how.task')} <b style={{ color: 'var(--mint-deep)' }}>+{REWARDS.taskPoints}</b></li>
            <li>🎁 {t('ach.how.bonus')} <b style={{ color: 'var(--mint-deep)' }}>+{REWARDS.dailyBonusPoints}</b></li>
            <li>🔥 {t('ach.how.streak')}</li>
          </ul>
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }} aria-labelledby="earned-h">
        <div className="card-head"><h2 id="earned-h">🌟 {t('ach.earned')} ({earned.length}/{catalogue.length})</h2></div>
        {earned.length ? (
          <div className="badge-grid">{earned.map((a) => <BadgeCard key={a.id} a={a} unlockedAt={unlocked.get(a.id)} />)}</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 90 }}><Mascot mood="wink" /></div>
            <p style={{ fontWeight: 800, color: 'var(--ink-2)' }}>{t('ach.noneEarned')}</p>
          </div>
        )}
      </section>

      {locked.length > 0 && (
        <section className="card" style={{ marginTop: 16 }} aria-labelledby="locked-h">
          <div className="card-head"><h2 id="locked-h">🔒 {t('ach.locked')}</h2></div>
          <div className="badge-grid">{locked.map((a) => <BadgeCard key={a.id} a={a} stats={ps} />)}</div>
        </section>
      )}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card" aria-labelledby="hist-h">
          <h2 id="hist-h">📜 {t('ach.history')}</h2>
          {points.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {points.map((p) => (
                <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)', fontWeight: 700 }}>
                  <span>
                    {p.reason === 'study_session' ? '⏱️' : p.reason === 'daily_bonus' ? '🎁' : '✅'} {t(`ach.reason.${p.reason}` as MessageKey)}
                    <small style={{ display: 'block', color: 'var(--muted)' }}>{formatDateTime(p.created_at, lang)}</small>
                  </span>
                  <b style={{ color: 'var(--mint-deep)', whiteSpace: 'nowrap' }}>+{p.points}</b>
                </li>
              ))}
            </ul>
          ) : <Empty icon="⭐">{t('ach.noHistory')}</Empty>}
        </section>

        <section className="card" aria-labelledby="timeline-h">
          <h2 id="timeline-h">🗂️ {t('ach.badgeTimeline')}</h2>
          {mine.length ? (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[...mine].reverse().map((m) => {
                const a = catalogue.find((c) => c.id === m.achievement_id);
                if (!a) return null;
                return (
                  <li key={m.achievement_id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    <span className="badge-medal" style={{ width: 44, height: 44, fontSize: '1.3rem', borderWidth: 2 }} aria-hidden="true">{a.icon}</span>
                    <span style={{ fontWeight: 800 }}>
                      {lang === 'ar' ? a.name_ar : a.name_en}
                      <small style={{ display: 'block', color: 'var(--muted)' }}>{formatDateTime(m.unlocked_at, lang)}</small>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : <Empty icon="🏅">{t('ach.noneEarned')}</Empty>}
        </section>
      </div>
    </div>
  );
}
