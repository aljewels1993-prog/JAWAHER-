import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { TeacherStudentRow } from '../../api/types';
import { useI18n, type MessageKey } from '../../i18n';
import { useAsync } from '../../state/useAsync';
import { Bar, Empty, LoadError, Spinner, Stat } from '../../components/ui';
import { useMinutesText } from '../../components/WeeklyReportView';
import { formatDateTime } from '../../lib/dates';
import { GRADES } from '../auth/AuthPages';

export type Engagement = 'high' | 'medium' | 'low';
type Sort = 'usage' | 'commitment' | 'points' | 'name';

/** Engagement from the last 7 days: study minutes and active days. */
export function engagementOf(r: Pick<TeacherStudentRow, 'week_minutes' | 'active_days_week'>): Engagement {
  if (r.week_minutes >= 120 || r.active_days_week >= 4) return 'high';
  if (r.week_minutes > 0 || r.active_days_week > 0) return 'medium';
  return 'low';
}

/** Share of planned tasks (dated today or earlier) that were completed, or null with nothing due. */
export function commitmentOf(r: Pick<TeacherStudentRow, 'tasks_due' | 'tasks_due_done'>): number | null {
  return r.tasks_due > 0 ? r.tasks_due_done / r.tasks_due : null;
}

/** Why a student needs follow-up (empty = on track). */
export function followUpReasons(r: TeacherStudentRow): { key: MessageKey; n?: number }[] {
  const out: { key: MessageKey; n?: number }[] = [];
  if (r.overdue_tasks > 0) out.push({ key: 'teacher.reason.overdue', n: r.overdue_tasks });
  if (r.active_days_week === 0) out.push({ key: 'teacher.reason.inactive' });
  if (r.tasks_planned === 0) out.push({ key: 'teacher.reason.noPlan' });
  return out;
}

export function EngagementPill({ e }: { e: Engagement }) {
  const { t } = useI18n();
  const icon = e === 'high' ? '🚀' : e === 'medium' ? '🙂' : '💌';
  return <span className={`eng ${e}`}>{icon} {t(`teacher.engagement.${e}` as MessageKey)}</span>;
}

export function CommitmentMeter({ row }: { row: Pick<TeacherStudentRow, 'tasks_due' | 'tasks_due_done' | 'overdue_tasks'> }) {
  const { t } = useI18n();
  const c = commitmentOf(row);
  if (c === null) return <span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: '0.85rem' }}>{t('teacher.noPlan')}</span>;
  const pct = Math.round(c * 100);
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.85rem' }}>
        <b style={{ color: pct >= 80 ? 'var(--mint-deep)' : pct >= 50 ? '#b98500' : 'var(--danger)' }}>{pct}%</b>
        <span style={{ color: 'var(--muted)' }}>{t('teacher.doneOf', { done: row.tasks_due_done, total: row.tasks_due })}</span>
      </div>
      <Bar value={c} tone="mint" label={t('teacher.commitment')} />
      {row.overdue_tasks > 0 && <small style={{ color: 'var(--danger)', fontWeight: 800 }}>⚠️ {t('teacher.overdue', { n: row.overdue_tasks })}</small>}
    </div>
  );
}

const initial = (n: string) => n.trim().charAt(0).toUpperCase();

export default function TeacherHome() {
  const { t, lang } = useI18n();
  const mins = useMinutesText();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [sort, setSort] = useState<Sort>('usage');
  useEffect(() => { const id = window.setTimeout(() => setSearch(query), 300); return () => window.clearTimeout(id); }, [query]);
  const rows = useAsync(() => api.listStudents(search, grade ? Number(grade) : undefined), [search, grade]);
  const list = useMemo(() => (rows.data ?? []).map((r) => ({
    ...r, week_minutes: Number(r.week_minutes), active_days_week: Number(r.active_days_week),
    tasks_due: Number(r.tasks_due), tasks_due_done: Number(r.tasks_due_done), overdue_tasks: Number(r.overdue_tasks),
    tasks_planned: Number(r.tasks_planned), badges: Number(r.badges), week_sessions: Number(r.week_sessions),
  })), [rows.data]);

  const sorted = useMemo(() => {
    const by: Record<Sort, (a: TeacherStudentRow, b: TeacherStudentRow) => number> = {
      usage: (a, b) => b.week_minutes - a.week_minutes || b.active_days_week - a.active_days_week,
      commitment: (a, b) => (commitmentOf(b) ?? -1) - (commitmentOf(a) ?? -1) || b.tasks_due_done - a.tasks_due_done,
      points: (a, b) => b.total_points - a.total_points,
      name: (a, b) => a.full_name.localeCompare(b.full_name, lang),
    };
    return [...list].sort(by[sort]);
  }, [list, sort, lang]);

  const top = [...list].filter((r) => r.week_minutes > 0 || r.active_days_week > 0)
    .sort((a, b) => b.week_minutes - a.week_minutes || b.active_days_week - a.active_days_week).slice(0, 3);
  const followUp = list.map((r) => ({ r, reasons: followUpReasons(r) })).filter((x) => x.reasons.length)
    .sort((a, b) => b.r.overdue_tasks - a.r.overdue_tasks).slice(0, 6);
  const active = list.filter((r) => r.active_days_week > 0).length;
  const due = list.reduce((a, r) => a + r.tasks_due, 0);
  const dueDone = list.reduce((a, r) => a + r.tasks_due_done, 0);
  const week = list.reduce((a, r) => a + r.week_minutes, 0);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>👩‍🏫 {t('teacher.title')}</h1>
          <p>{t('teacher.sub')}</p>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14, alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="grade-filter">{t('teacher.gradeFilter')}</label>
          <select id="grade-filter" className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">{t('teacher.allGrades')}</option>
            {GRADES.map((g) => <option key={g} value={g}>{t(`grade.${g}` as MessageKey)}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="search">{t('teacher.search')}</label>
          <input id="search" className="input" type="search" placeholder="🔎" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="sort">{t('teacher.sort')}</label>
          <select id="sort" className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {(['usage', 'commitment', 'points', 'name'] as Sort[]).map((s) => <option key={s} value={s}>{t(`teacher.sort.${s}` as MessageKey)}</option>)}
          </select>
        </div>
      </div>

      {rows.error ? <LoadError error={rows.error} onRetry={rows.reload} /> : rows.loading && !rows.data ? <Spinner /> : (
        <>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <Stat icon="🎒" tone="purple" value={list.length} label={t('teacher.totalStudents')} />
            <Stat icon="🔥" tone="pink" value={`${active}/${list.length}`} label={t('teacher.activeWeek')} />
            <Stat icon="✅" tone="mint" value={due ? `${Math.round((dueDone / due) * 100)}%` : '—'} label={t('teacher.commitmentAvg')} />
            <Stat icon="⏱️" tone="blue" value={mins(week)} label={t('teacher.totalHours')} />
          </div>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            <section className="card tint-cream" aria-labelledby="top-h">
              <h2 id="top-h">🏆 {t('teacher.topUsers')}</h2>
              {top.length ? (
                <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                  {top.map((r, i) => (
                    <li key={r.id}>
                      <Link to={`/teacher/students/${r.id}`} className="student-card" style={{ boxShadow: 'none' }}>
                        <span style={{ fontSize: '1.8rem' }} aria-hidden="true">{medals[i]}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ display: 'block' }}>{r.full_name}</b>
                          <small style={{ color: 'var(--muted)', fontWeight: 700 }}>
                            {t(`grade.${r.grade}` as MessageKey)} · ⏱️ {mins(r.week_minutes)} · 📅 {t('teacher.daysActive', { n: r.active_days_week })}
                          </small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : <Empty icon="🌱">{t('teacher.noActivity')}</Empty>}
            </section>

            <section className="card tint-pink" aria-labelledby="fu-h">
              <h2 id="fu-h">💌 {t('teacher.followUp')}</h2>
              <p style={{ color: 'var(--ink-2)', fontWeight: 600, fontSize: '0.88rem', marginBottom: 10 }}>{t('teacher.followUpHint')}</p>
              {followUp.length ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                  {followUp.map(({ r, reasons }) => (
                    <li key={r.id}>
                      <Link to={`/teacher/students/${r.id}`} className="student-card" style={{ boxShadow: 'none', padding: 10 }}>
                        <span className="avatar" aria-hidden="true">{initial(r.full_name)}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ display: 'block' }}>{r.full_name} <small style={{ color: 'var(--muted)' }}>· {t(`grade.${r.grade}` as MessageKey)}</small></b>
                          <small style={{ color: '#a9522f', fontWeight: 800 }}>{reasons.map((x) => t(x.key, { n: x.n ?? 0 })).join(' · ')}</small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <Empty icon="🎉">{t('teacher.noFollowUp')}</Empty>}
            </section>
          </div>

          <section className="card">
            <p className="alert info" style={{ marginBottom: 14 }}>ℹ️ {t('teacher.howRead')}</p>
            {!sorted.length ? <Empty icon="🔍">{t('teacher.noStudents')}</Empty> : (
              <>
                <div className="table-wrap only-desktop">
                  <table className="data">
                    <thead>
                      <tr>
                        <th scope="col">{t('teacher.col.name')}</th>
                        <th scope="col">{t('teacher.col.usage')}</th>
                        <th scope="col">{t('teacher.col.commitment')}</th>
                        <th scope="col">{t('teacher.col.benefit')}</th>
                        <th scope="col">{t('teacher.engagement')}</th>
                        <th scope="col">{t('teacher.col.lastActive')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <Link to={`/teacher/students/${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit' }}>
                              <span className="avatar" aria-hidden="true">{initial(r.full_name)}</span>
                              <span>{r.full_name}<small style={{ display: 'block', color: 'var(--muted)' }}>{t(`grade.${r.grade}` as MessageKey)}</small></span>
                            </Link>
                          </td>
                          <td>
                            ⏱️ {mins(r.week_minutes)}
                            <small style={{ display: 'block', color: 'var(--muted)' }}>📅 {t('teacher.daysActive', { n: r.active_days_week })}</small>
                          </td>
                          <td><CommitmentMeter row={r} /></td>
                          <td>
                            ⭐ {r.total_points}
                            <small style={{ display: 'block', color: 'var(--muted)' }}>🏅 {r.badges} · 🔥 {r.current_streak}</small>
                          </td>
                          <td><EngagementPill e={engagementOf(r)} /></td>
                          <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.last_active ? formatDateTime(r.last_active, lang) : t('teacher.never')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="student-cards only-mobile">
                  {sorted.map((r) => (
                    <Link key={r.id} to={`/teacher/students/${r.id}`} className="student-card" style={{ alignItems: 'flex-start' }}>
                      <span className="avatar" aria-hidden="true">{initial(r.full_name)}</span>
                      <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
                        <span><b>{r.full_name}</b> <small style={{ color: 'var(--muted)', fontWeight: 700 }}>· {t(`grade.${r.grade}` as MessageKey)}</small></span>
                        <small style={{ color: 'var(--ink-2)', fontWeight: 700 }}>
                          ⏱️ {mins(r.week_minutes)} · 📅 {t('teacher.daysActive', { n: r.active_days_week })} · ⭐ {r.total_points}
                        </small>
                        <CommitmentMeter row={r} />
                        <span><EngagementPill e={engagementOf(r)} /></span>
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
