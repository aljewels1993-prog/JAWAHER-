import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useI18n, type MessageKey } from '../../i18n';
import { useAsync } from '../../state/useAsync';
import { Empty, LoadError, Spinner, Stat } from '../../components/ui';
import { TaskItem } from '../../components/Tasks';
import { WeeklyReportView, useMinutesText } from '../../components/WeeklyReportView';
import { BadgeCard, progressStats } from '../Achievements';
import { WeekNav } from '../Reports';
import { addDays, formatDate, formatDateTime, todayIso, weekStart } from '../../lib/dates';
import { levelFor } from '../../lib/rewards';
import { EngagementPill, engagementOf } from './TeacherHome';

export default function TeacherStudent() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const mins = useMinutesText();
  const [start, setStart] = useState(() => weekStart(todayIso()));
  const base = useAsync(() => Promise.all([api.getStudentProfile(id), api.getStats(id), api.listAchievements(), api.listStudentAchievements(id)]), [id]);
  const week = useAsync(() => Promise.all([api.getWeeklyReport(start, id), api.listTasks(start, addDays(start, 6), id)]), [id, start]);

  if (base.error) return <div className="page"><LoadError error={base.error} onRetry={base.reload} /></div>;
  if (!base.data) return <div className="page"><Spinner /></div>;
  const [profile, stats, catalogue, badges] = base.data;
  if (!profile) return <div className="page"><Empty icon="🔍" action={<Link className="btn" to="/teacher">{t('teacher.backToList')}</Link>}>{t('teacher.studentNotFound')}</Empty></div>;
  const level = levelFor(profile.total_points);
  const unlocked = new Map(badges.map((b) => [b.achievement_id, b.unlocked_at]));
  const weekMinutes = week.data ? week.data[0].study_minutes : 0;

  return (
    <div className="page">
      <Link to="/teacher" className="chip" style={{ marginBottom: 12 }}><span className="flip-rtl">‹</span> {t('teacher.backToList')}</Link>
      <div className="page-head">
        <div className="avatar big" aria-hidden="true">{profile.full_name.charAt(0).toUpperCase()}</div>
        <div className="grow">
          <h1>{profile.full_name}</h1>
          <p><span dir="ltr">@{profile.username}</span> · {t('teacher.joined', { date: formatDate(profile.created_at.slice(0, 10), lang, { day: 'numeric', month: 'short', year: 'numeric' }) })}</p>
        </div>
        <EngagementPill e={engagementOf({ week_minutes: weekMinutes, last_active: stats.last_active })} />
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: 10, color: 'var(--navy)' }}>📈 {t('teacher.stats')}</h2>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <Stat icon="⭐" tone="gold" value={profile.total_points} label={`${t('home.points')} · ${t(`level.${level.index}` as MessageKey)}`} />
        <Stat icon="✅" tone="mint" value={stats.tasks_completed} label={t('home.tasksDone')} />
        <Stat icon="⏱️" tone="blue" value={mins(stats.study_minutes)} label={t('home.studyHours')} />
        <Stat icon="🔥" tone="pink" value={stats.current_streak} label={`${t('teacher.streak')} · ${t('teacher.col.lastActive')}: ${stats.last_active ? formatDateTime(stats.last_active, lang) : t('teacher.never')}`} />
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>🏆 {t('teacher.badges')}</h2>
        <div className="badge-grid">{catalogue.map((a) => <BadgeCard key={a.id} a={a} unlockedAt={unlocked.get(a.id)} stats={progressStats(stats)} />)}</div>
      </section>

      <h2 style={{ fontSize: '1.1rem', margin: '8px 0 10px', color: 'var(--navy)' }}>📊 {t('teacher.weekReport')}</h2>
      <WeekNav start={start} onChange={setStart} />
      {week.error ? <LoadError error={week.error} onRetry={week.reload} /> : !week.data ? <Spinner /> : (
        <>
          <WeeklyReportView report={week.data[0]} />
          <section className="card" style={{ marginTop: 16 }}>
            <h2>🗓️ {t('teacher.weekTasks')}</h2>
            {week.data[1].length ? (
              <div className="task-list">{week.data[1].map((x) => <TaskItem key={x.id} task={x} />)}</div>
            ) : <Empty icon="📭">{t('teacher.noTasks')}</Empty>}
          </section>
        </>
      )}
    </div>
  );
}
