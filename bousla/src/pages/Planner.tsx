import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Task } from '../api/types';
import { useI18n } from '../i18n';
import { useFeedback } from '../state/feedback';
import { useAsync } from '../state/useAsync';
import { Empty, LoadError, Modal, Spinner, errorText } from '../components/ui';
import { TaskForm, TaskItem, useTaskToggle } from '../components/Tasks';
import { addDays, formatDate, schoolDays, todayIso, weekStart } from '../lib/dates';

type View = 'week' | 'day' | 'list';

export default function PlannerPage() {
  const { t, lang } = useI18n();
  const { toast, version, bump } = useFeedback();
  const navigate = useNavigate();
  const today = todayIso();
  const [view, setView] = useState<View>(() => (window.innerWidth < 760 ? 'day' : 'week'));
  const [start, setStart] = useState(() => weekStart(today));
  const [day, setDay] = useState(today);
  const [editing, setEditing] = useState<{ task?: Task; date?: string } | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const days = schoolDays(start);
  const range: [string, string] = view === 'list' ? [today, addDays(today, 60)] : view === 'day' ? [day, day] : [start, addDays(start, 6)];
  const tasks = useAsync(() => api.listTasks(range[0], range[1]), [range[0], range[1], version]);
  const list = tasks.data ?? [];
  const toggle = useTaskToggle((changed) => tasks.setData(list.map((x) => (x.id === changed.id ? changed : x))));

  const moveWeek = (n: number) => {
    const s = addDays(start, n * 7);
    setStart(s);
    setDay(s <= today && today <= addDays(s, 6) ? today : s);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const d = deleting;
    setDeleting(null);
    tasks.setData(list.filter((x) => x.id !== d.id));
    try {
      await api.deleteTask(d.id);
      toast(t('planner.deleted'), 'success', '🗑️');
      bump();
    } catch (e) {
      toast(errorText(t, e), 'error');
      void tasks.reload();
    }
  };

  const itemProps = (x: Task) => ({ task: x, onToggle: toggle, onEdit: (task: Task) => setEditing({ task }), onDelete: setDeleting });
  const weekLabel = `${formatDate(days[0], lang, { day: 'numeric', month: 'short' })} – ${formatDate(days[4], lang, { day: 'numeric', month: 'short' })}`;

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>🗓️ {t('planner.title')}</h1>
          <p>{t('planner.sub')}</p>
        </div>
        <button className="btn" onClick={() => setEditing({ date: view === 'week' ? (days.includes(today) ? today : days[0]) : day })}>＋ {t('planner.addTask')}</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div className="seg" role="group" aria-label={t('planner.title')}>
          {(['day', 'week', 'list'] as View[]).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
              {v === 'day' ? '📅' : v === 'week' ? '🗓️' : '📋'} {t(`planner.${v}`)}
            </button>
          ))}
        </div>
        {view !== 'list' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginInlineStart: 'auto' }}>
            <button className="icon-btn" onClick={() => moveWeek(-1)} aria-label={t('planner.prevWeek')}><span className="flip-rtl">◀</span></button>
            <button className="btn small secondary" onClick={() => { setStart(weekStart(today)); setDay(today); }}>{t('planner.thisWeek')}</button>
            <button className="icon-btn" onClick={() => moveWeek(1)} aria-label={t('planner.nextWeek')}><span className="flip-rtl">▶</span></button>
          </div>
        )}
      </div>
      {view !== 'list' && <p style={{ fontWeight: 800, color: 'var(--ink-2)', marginBottom: 10 }}>{weekLabel}</p>}

      {tasks.error ? <LoadError error={tasks.error} onRetry={tasks.reload} /> : null}

      {view === 'day' && (
        <>
          <div className="chips" role="tablist" style={{ marginBottom: 14 }}>
            {days.map((d) => (
              <button key={d} role="tab" aria-selected={d === day} className="btn small" onClick={() => setDay(d)}
                style={d === day ? undefined : { background: '#fff', color: 'var(--ink-2)', boxShadow: 'var(--shadow-sm)' }}>
                {formatDate(d, lang, { weekday: 'short' })} {formatDate(d, lang, { day: 'numeric' })}{d === today ? ' •' : ''}
              </button>
            ))}
          </div>
          <section className="card">
            <div className="card-head">
              <h2>{d2(day, today, lang, t)}</h2>
              <button className="btn small secondary" onClick={() => setEditing({ date: day })}>＋ {t('common.add')}</button>
            </div>
            {tasks.loading && !tasks.data ? <Spinner /> : list.length ? (
              <div className="task-list">{list.map((x) => <TaskItem key={x.id} {...itemProps(x)} />)}</div>
            ) : <Empty icon="✨">{t('planner.emptyDay')}</Empty>}
          </section>
        </>
      )}

      {view === 'week' && (
        tasks.loading && !tasks.data ? <Spinner /> : (
          <div className="week">
            {days.map((d) => {
              const dayTasks = list.filter((x) => x.task_date === d);
              const done = dayTasks.filter((x) => x.completed).length;
              return (
                <section key={d} className={`day-col${d === today ? ' today' : ''}`} aria-label={formatDate(d, lang)}>
                  <h3>
                    <span>{formatDate(d, lang, { weekday: 'long' })}</span>
                    <small>{formatDate(d, lang, { day: 'numeric', month: 'short' })}{dayTasks.length ? ` · ${done}/${dayTasks.length}` : ''}</small>
                  </h3>
                  <div className="task-list">
                    {dayTasks.length ? dayTasks.map((x) => <TaskItem key={x.id} {...itemProps(x)} compact />) : (
                      <p style={{ color: 'var(--muted)', fontWeight: 700, textAlign: 'center', padding: '8px 0' }}>{t('planner.emptyDay')}</p>
                    )}
                  </div>
                  <button className="add-mini" onClick={() => setEditing({ date: d })}>＋ {t('common.add')}</button>
                </section>
              );
            })}
          </div>
        )
      )}

      {view === 'list' && (
        <section className="card">
          <div className="card-head"><h2>📋 {t('planner.list')}</h2></div>
          {tasks.loading && !tasks.data ? <Spinner /> : list.filter((x) => !x.completed).length ? (
            <div className="task-list">
              {list.filter((x) => !x.completed).map((x, i, arr) => (
                <div key={x.id}>
                  {(i === 0 || arr[i - 1].task_date !== x.task_date) && (
                    <h3 style={{ fontSize: '0.92rem', color: 'var(--purple-deep)', margin: '8px 4px 6px' }}>{d2(x.task_date, today, lang, t)}</h3>
                  )}
                  <TaskItem {...itemProps(x)} />
                  {x.task_date === today && (
                    <button className="link-btn" style={{ fontSize: '0.82rem', margin: '4px 8px' }} onClick={() => navigate('/timer', { state: { subject: x.subject } })}>
                      ⏱️ {t('planner.studyThis')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : <Empty icon="🎈">{t('planner.emptyList')}</Empty>}
        </section>
      )}

      {editing && (
        <TaskForm task={editing.task} date={editing.date} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void tasks.reload(); bump(); }} />
      )}
      {deleting && (
        <Modal title={t('planner.deleteConfirm', { title: deleting.title })} onClose={() => setDeleting(null)}>
          <div className="actions">
            <button className="btn ghost" onClick={() => setDeleting(null)}>{t('common.cancel')}</button>
            <button className="btn pink" onClick={() => void confirmDelete()}>🗑️ {t('common.delete')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function d2(iso: string, today: string, lang: 'ar' | 'en', t: (k: 'common.today' | 'common.tomorrow') => string) {
  const label = formatDate(iso, lang, { weekday: 'long', day: 'numeric', month: 'long' });
  if (iso === today) return `${t('common.today')} · ${label}`;
  if (iso === addDays(today, 1)) return `${t('common.tomorrow')} · ${label}`;
  return label;
}
