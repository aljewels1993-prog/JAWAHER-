import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { TeacherStudentRow } from '../../api/types';
import { useI18n, type MessageKey } from '../../i18n';
import { useAsync } from '../../state/useAsync';
import { Empty, LoadError, Spinner, Stat } from '../../components/ui';
import { useMinutesText } from '../../components/WeeklyReportView';
import { formatDateTime } from '../../lib/dates';

export type Engagement = 'high' | 'medium' | 'low';

/** Simple engagement signal from this week's study minutes and last activity. */
export function engagementOf(r: Pick<TeacherStudentRow, 'week_minutes' | 'last_active'>, now = Date.now()): Engagement {
  const daysIdle = r.last_active ? (now - new Date(r.last_active).getTime()) / 86_400_000 : Infinity;
  if (r.week_minutes >= 120 && daysIdle <= 2) return 'high';
  if (r.week_minutes > 0 || daysIdle <= 7) return 'medium';
  return 'low';
}

export function EngagementPill({ e }: { e: Engagement }) {
  const { t } = useI18n();
  const icon = e === 'high' ? '🚀' : e === 'medium' ? '🙂' : '💌';
  return <span className={`eng ${e}`}>{icon} {t(`teacher.engagement.${e}` as MessageKey)}</span>;
}

export default function TeacherHome() {
  const { t, lang } = useI18n();
  const mins = useMinutesText();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => { const id = window.setTimeout(() => setSearch(query), 300); return () => window.clearTimeout(id); }, [query]);
  const rows = useAsync(() => api.listStudents(search), [search]);
  const list = rows.data ?? [];
  const active = list.filter((r) => r.week_minutes > 0).length;
  const avg = list.length ? Math.round(list.reduce((a, r) => a + r.total_points, 0) / list.length) : 0;
  const week = list.reduce((a, r) => a + Number(r.week_minutes), 0);
  const initial = (n: string) => n.trim().charAt(0).toUpperCase();

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>👩‍🏫 {t('teacher.title')}</h1>
          <p>{t('teacher.sub')}</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <Stat icon="👧" tone="purple" value={list.length} label={t('teacher.totalStudents')} />
        <Stat icon="🔥" tone="pink" value={active} label={t('teacher.activeWeek')} />
        <Stat icon="⭐" tone="gold" value={avg} label={t('teacher.avgPoints')} />
        <Stat icon="⏱️" tone="blue" value={mins(week)} label={t('teacher.totalHours')} />
      </div>

      <section className="card">
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="search" className="sr-only">{t('teacher.search')}</label>
          <input id="search" className="input" type="search" placeholder={`🔎 ${t('teacher.search')}`} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {rows.error ? <LoadError error={rows.error} onRetry={rows.reload} /> : rows.loading && !rows.data ? <Spinner /> : !list.length ? (
          <Empty icon="🔍">{t('teacher.noStudents')}</Empty>
        ) : (
          <>
            <div className="table-wrap only-desktop">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">{t('teacher.col.name')}</th>
                    <th scope="col">{t('teacher.col.points')}</th>
                    <th scope="col">{t('teacher.col.tasks')}</th>
                    <th scope="col">{t('teacher.col.sessions')}</th>
                    <th scope="col">{t('teacher.col.week')}</th>
                    <th scope="col">{t('teacher.col.badges')}</th>
                    <th scope="col">{t('teacher.engagement')}</th>
                    <th scope="col">{t('teacher.col.lastActive')}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/teacher/students/${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit' }}>
                          <span className="avatar" aria-hidden="true">{initial(r.full_name)}</span>
                          <span>{r.full_name}<small style={{ display: 'block', color: 'var(--muted)' }} dir="ltr">@{r.username}</small></span>
                        </Link>
                      </td>
                      <td>⭐ {r.total_points}</td>
                      <td>{r.tasks_completed}</td>
                      <td>{r.sessions_completed}</td>
                      <td>{mins(Number(r.week_minutes))}</td>
                      <td>🏅 {r.badges}</td>
                      <td><EngagementPill e={engagementOf(r)} /></td>
                      <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.last_active ? formatDateTime(r.last_active, lang) : t('teacher.never')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="student-cards only-mobile">
              {list.map((r) => (
                <Link key={r.id} to={`/teacher/students/${r.id}`} className="student-card">
                  <span className="avatar" aria-hidden="true">{initial(r.full_name)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: 'block' }}>{r.full_name}</b>
                    <small style={{ color: 'var(--muted)', fontWeight: 700 }}>⭐ {r.total_points} · ✅ {r.tasks_completed} · ⏱️ {mins(Number(r.week_minutes))}</small>
                    <div style={{ marginTop: 4 }}><EngagementPill e={engagementOf(r)} /></div>
                  </span>
                  <span className="flip-rtl" aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
