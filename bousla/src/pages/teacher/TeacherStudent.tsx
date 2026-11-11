import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useI18n, type MessageKey } from '../../i18n';
import { useAsync } from '../../state/useAsync';
import { Empty, LoadError, Modal, Spinner, Stat, errorText } from '../../components/ui';
import { useFeedback } from '../../state/feedback';
import { GRADES } from '../auth/AuthPages';
import { TaskItem } from '../../components/Tasks';
import { WeeklyReportView, useMinutesText } from '../../components/WeeklyReportView';
import { BadgeCard, progressStats } from '../Achievements';
import { WeekNav } from '../Reports';
import { addDays, formatDate, formatDateTime, todayIso, weekStart } from '../../lib/dates';
import { levelFor } from '../../lib/rewards';
import { CommitmentMeter, EngagementPill, engagementOf } from './TeacherHome';

export default function TeacherStudent() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const mins = useMinutesText();
  const [start, setStart] = useState(() => weekStart(todayIso()));
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const [editing, setEditing] = useState<{ name: string; grade: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resettingPin, setResettingPin] = useState(false);
  const pin = useAsync(() => api.teacherStudentHasPin(id), [id]);
  const base = useAsync(() => Promise.all([api.getStudentProfile(id), api.getStats(id), api.listAchievements(), api.listStudentAchievements(id)]), [id]);
  const week = useAsync(() => Promise.all([api.getWeeklyReport(start, id), api.listTasks(start, addDays(start, 6), id)]), [id, start]);

  if (base.error) return <div className="page"><LoadError error={base.error} onRetry={base.reload} /></div>;
  if (!base.data) return <div className="page"><Spinner /></div>;
  const [profile, stats, catalogue, badges] = base.data;
  if (!profile) return <div className="page"><Empty icon="🔍" action={<Link className="btn" to="/teacher">{t('teacher.backToList')}</Link>}>{t('teacher.studentNotFound')}</Empty></div>;
  const level = levelFor(profile.total_points);

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await api.teacherUpdateStudent(profile.id, editing.name, Number(editing.grade));
      toast(t('teacher.saved'), 'success');
      setEditing(null);
      await base.reload();
    } catch (err) {
      toast(errorText(t, err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmPinReset = async () => {
    setBusy(true);
    try {
      await api.teacherResetStudentPin(profile.id);
      toast(t('teacher.pinResetDone'), 'success', '🔐');
      setResettingPin(false);
      await pin.reload();
    } catch (err) {
      toast(errorText(t, err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.teacherDeleteStudent(profile.id);
      toast(t('teacher.deleted'), 'success', '🗑️');
      navigate('/teacher', { replace: true });
    } catch (err) {
      toast(errorText(t, err), 'error');
      setBusy(false);
      setDeleting(false);
    }
  };
  const unlocked = new Map(badges.map((b) => [b.achievement_id, b.unlocked_at]));
  const weekMinutes = week.data ? week.data[0].study_minutes : 0;

  return (
    <div className="page">
      <Link to="/teacher" className="chip" style={{ marginBottom: 12 }}><span className="flip-rtl">‹</span> {t('teacher.backToList')}</Link>
      <div className="page-head">
        <div className="avatar big" aria-hidden="true">{profile.full_name.charAt(0).toUpperCase()}</div>
        <div className="grow">
          <h1>{profile.full_name}</h1>
          <p>🎒 {t(`grade.${profile.grade}` as MessageKey)} · {t('teacher.joined', { date: formatDate(profile.created_at.slice(0, 10), lang, { day: 'numeric', month: 'short', year: 'numeric' }) })}</p>
        </div>
        <EngagementPill e={engagementOf({ week_minutes: weekMinutes, active_days_week: week.data ? week.data[0].days.filter((d) => d.minutes > 0 || d.tasks > 0).length : 0 })} />
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: 10, color: 'var(--navy)' }}>📈 {t('teacher.stats')}</h2>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <Stat icon="⭐" tone="gold" value={profile.total_points} label={`${t('home.points')} · ${t(`level.${level.index}` as MessageKey)}`} />
        <Stat icon="✅" tone="mint" value={stats.tasks_completed} label={t('home.tasksDone')} />
        <Stat icon="⏱️" tone="blue" value={mins(stats.study_minutes)} label={t('home.studyHours')} />
        <Stat icon="🔥" tone="pink" value={stats.current_streak} label={`${t('teacher.streak')} · ${t('teacher.col.lastActive')}: ${stats.last_active ? formatDateTime(stats.last_active, lang) : t('teacher.never')}`} />
      </div>

      <section className="card tint-mint" style={{ marginBottom: 16 }} aria-labelledby="commit-h">
        <h2 id="commit-h">✅ {t('teacher.commitmentStudent')}</h2>
        <CommitmentMeter row={{ tasks_due: stats.tasks_due, tasks_due_done: stats.tasks_due_done, overdue_tasks: stats.tasks_due - stats.tasks_due_done - (stats.today_planned - stats.today_completed) }} />
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>🏆 {t('teacher.badges')}</h2>
        <div className="badge-grid">{catalogue.map((a) => <BadgeCard key={a.id} a={a} unlockedAt={unlocked.get(a.id)} stats={progressStats(stats)} />)}</div>
      </section>

      <section className="card tint-cream" style={{ marginBottom: 16 }} aria-labelledby="manage-h">
        <h2 id="manage-h">🛠️ {t('teacher.manage')}</h2>
        <p style={{ color: 'var(--ink-2)', fontWeight: 600, fontSize: '0.9rem', marginBottom: 12 }}>{t('teacher.manageHint')}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn secondary" onClick={() => setEditing({ name: profile.full_name, grade: String(profile.grade) })}>✏️ {t('teacher.editStudent')}</button>
          <button className="btn secondary" onClick={() => setResettingPin(true)}>🔐 {t('teacher.resetPin')}</button>
          <button className="btn danger" onClick={() => setDeleting(true)}>🗑️ {t('teacher.deleteStudent')}</button>
        </div>
        <p style={{ marginTop: 10, fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink-2)' }}>
          🔐 {t('teacher.pinStatus')}: {pin.data === undefined ? '…' : pin.data ? t('teacher.pinSet') : t('teacher.pinNotSet')}
        </p>
      </section>

      {editing && (
        <Modal title={t('teacher.editStudent')} onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit}>
            <div className="field">
              <label htmlFor="ts-name">{t('login.name')}</label>
              <input id="ts-name" className="input" maxLength={80} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="ts-grade">{t('login.grade')}</label>
              <select id="ts-grade" className="input" value={editing.grade} onChange={(e) => setEditing({ ...editing, grade: e.target.value })}>
                {GRADES.map((g) => <option key={g} value={g}>{t(`grade.${g}` as MessageKey)}</option>)}
              </select>
            </div>
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
              <button className="btn" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}
      {resettingPin && (
        <Modal title={t('teacher.resetPin')} onClose={() => setResettingPin(false)}>
          <p style={{ fontWeight: 700, color: 'var(--ink-2)', marginBottom: 12 }}>{t('teacher.resetPinConfirm', { name: profile.full_name })}</p>
          <div className="actions">
            <button className="btn ghost" onClick={() => setResettingPin(false)}>{t('common.cancel')}</button>
            <button className="btn" disabled={busy} onClick={() => void confirmPinReset()}>🔐 {t('teacher.resetPin')}</button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal title={t('teacher.deleteStudent')} onClose={() => setDeleting(false)}>
          <p style={{ fontWeight: 700, color: 'var(--ink-2)', marginBottom: 12 }}>{t('teacher.deleteConfirm', { name: profile.full_name })}</p>
          <div className="actions">
            <button className="btn ghost" onClick={() => setDeleting(false)}>{t('common.cancel')}</button>
            <button className="btn pink" disabled={busy} onClick={() => void confirmDelete()}>🗑️ {t('common.delete')}</button>
          </div>
        </Modal>
      )}

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
