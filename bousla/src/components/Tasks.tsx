import { useState, type FormEvent } from 'react';
import { api } from '../api';
import type { Task, TaskInput, Priority, TaskType } from '../api/types';
import { subjectLabel, useI18n, type MessageKey } from '../i18n';
import { formatDate, formatTime, taskDateTime, todayIso } from '../lib/dates';
import { allSubjects, subjectColor, subjectIcon } from '../lib/subjects';
import { useAuth } from '../state/auth';
import { useFeedback } from '../state/feedback';
import { Modal, errorText } from './ui';

const REMINDERS = [0, 5, 10, 15, 30, 60, 120, 1440];

export function TaskItem({ task, onToggle, onEdit, onDelete, compact }: {
  task: Task; onToggle?: (t: Task) => void; onEdit?: (t: Task) => void; onDelete?: (t: Task) => void; compact?: boolean;
}) {
  const { t, lang } = useI18n();
  const overdue = !task.completed && taskDateTime(task.task_date, task.start_time ?? '23:59') < new Date();
  return (
    <div className={`task${task.completed ? ' done' : ''}`} style={{ ['--subject' as string]: subjectColor(task.subject) }}>
      {onToggle ? (
        <button className="check" role="checkbox" aria-checked={task.completed} onClick={() => onToggle(task)}
          aria-label={`${task.completed ? t('planner.markUndone') : t('planner.markDone')}: ${task.title}`}>
          {task.completed ? '✓' : ''}
        </button>
      ) : (
        <span className="check" aria-checked={task.completed} role="img" style={{ cursor: 'default' }}
          aria-label={task.completed ? t('planner.markDone') : t('planner.markUndone')}>{task.completed ? '✓' : ''}</span>
      )}
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          <span>{subjectIcon(task.subject)} {subjectLabel(lang, task.subject)}</span>
          {task.start_time && <span>🕒 {formatTime(task.start_time, lang)}</span>}
          {!compact && <span>⏳ {t('common.minutes', { n: task.duration_minutes })}</span>}
          <span><span className={`prio ${task.priority}`} aria-hidden="true" /> {t(`planner.priority.${task.priority}` as MessageKey)}</span>
          {task.task_type !== 'study' && <span>{task.task_type === 'test' ? '🧪' : '📝'} {t(`planner.type.${task.task_type}` as MessageKey)}</span>}
          {task.reminder_minutes !== null && task.start_time && <span aria-label={t('planner.reminder')}>🔔</span>}
          {overdue && <span style={{ color: 'var(--danger)' }}>⚠️ {t('planner.overdue')}</span>}
        </div>
        {!compact && task.description && <div className="task-desc">{task.description}</div>}
      </div>
      {(onEdit || onDelete) && (
        <div className="task-actions">
          {onEdit && <button onClick={() => onEdit(task)} aria-label={`${t('common.edit')}: ${task.title}`}>✏️</button>}
          {onDelete && <button onClick={() => onDelete(task)} aria-label={`${t('common.delete')}: ${task.title}`}>🗑️</button>}
        </div>
      )}
    </div>
  );
}

/** Toggles a task through the server and celebrates the reward. */
export function useTaskToggle(onChanged: (t: Task) => void) {
  const { t } = useI18n();
  const { celebrate, toast, bump } = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = async (task: Task) => {
    if (busy) return;
    setBusy(task.id);
    const next = !task.completed;
    onChanged({ ...task, completed: next, completed_at: next ? new Date().toISOString() : null });
    try {
      const r = await api.setTaskCompleted(task.id, next);
      if (next) celebrate(r, 'task'); else bump();
    } catch (e) {
      onChanged(task);
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(null);
    }
  };
  return toggle;
}

const blank = (date: string): TaskInput => ({
  subject: 'Mathematics', title: '', description: '', task_type: 'homework', task_date: date,
  start_time: '16:00', duration_minutes: 30, priority: 'medium', reminder_minutes: 15,
});

export function TaskForm({ task, date, onClose, onSaved }: { task?: Task; date?: string; onClose: () => void; onSaved: (t: Task) => void }) {
  const { t, lang } = useI18n();
  const { account, refresh } = useAuth();
  const { toast } = useFeedback();
  const custom = account?.student?.custom_subjects ?? [];
  const [form, setForm] = useState<TaskInput>(() => (task ? {
    subject: task.subject, title: task.title, description: task.description ?? '', task_type: task.task_type, task_date: task.task_date,
    start_time: task.start_time, duration_minutes: task.duration_minutes, priority: task.priority, reminder_minutes: task.reminder_minutes,
  } : blank(date ?? todayIso())));
  const [newSubject, setNewSubject] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const subjects = allSubjects(custom);
  if (!subjects.includes(form.subject)) subjects.splice(subjects.length - 1, 0, form.subject);
  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const addSubject = async () => {
    const name = newSubject.trim().slice(0, 40);
    if (!name) return;
    if (!custom.includes(name)) {
      try {
        await api.updateProfile({ custom_subjects: [...custom, name].slice(0, 20) });
        await refresh();
      } catch (e) {
        toast(errorText(t, e), 'error');
        return;
      }
    }
    set('subject', name);
    setNewSubject('');
    setAddingSubject(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError(t('planner.titleRequired'));
    setBusy(true);
    const input: TaskInput = {
      ...form,
      title: form.title.trim(),
      description: form.description?.trim() || null,
      start_time: form.start_time || null,
      reminder_minutes: form.start_time ? form.reminder_minutes : null,
      duration_minutes: Math.min(240, Math.max(5, Math.round(form.duration_minutes || 30))),
    };
    try {
      const saved = task ? await api.updateTask(task.id, input) : await api.createTask(input);
      toast(t('planner.saved'), 'success');
      onSaved(saved);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={task ? t('planner.editTask') : t('planner.addTask')} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {error && <div className="alert error" role="alert">⚠️ {error}</div>}
        <div className="field">
          <label htmlFor="tf-title">{t('planner.taskTitle')}</label>
          <input id="tf-title" className="input" maxLength={120} placeholder={t('planner.taskTitlePh')} value={form.title} onChange={(e) => set('title', e.target.value)} required />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="tf-subject">{t('planner.subject')}</label>
            <select id="tf-subject" className="input" value={form.subject} onChange={(e) => set('subject', e.target.value)}>
              {subjects.map((s) => <option key={s} value={s}>{subjectIcon(s)} {subjectLabel(lang, s)}</option>)}
            </select>
            {!addingSubject ? (
              <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: '0.85rem' }} onClick={() => setAddingSubject(true)}>＋ {t('planner.addSubject')}</button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" aria-label={t('planner.customSubject')} placeholder={t('planner.customSubject')} maxLength={40} value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addSubject(); } }} />
                <button type="button" className="btn small" onClick={() => void addSubject()}>{t('common.add')}</button>
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="tf-type">{t('planner.type')}</label>
            <select id="tf-type" className="input" value={form.task_type} onChange={(e) => set('task_type', e.target.value as TaskType)}>
              {(['homework', 'study', 'test'] as const).map((k) => <option key={k} value={k}>{t(`planner.type.${k}`)}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="tf-desc">{t('planner.description')} <span className="hint">({t('common.optional')})</span></label>
          <textarea id="tf-desc" className="input" maxLength={1000} placeholder={t('planner.descriptionPh')} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="tf-date">{t('planner.date')}</label>
            <input id="tf-date" className="input" type="date" value={form.task_date} onChange={(e) => set('task_date', e.target.value || todayIso())} required />
            <span className="hint">{formatDate(form.task_date, lang)}</span>
          </div>
          <div className="field">
            <label htmlFor="tf-time">{t('planner.startTime')}</label>
            <input id="tf-time" className="input" type="time" value={form.start_time ?? ''} onChange={(e) => set('start_time', e.target.value || null)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="tf-dur">{t('planner.duration')}</label>
            <input id="tf-dur" className="input" type="number" min={5} max={240} step={5} value={form.duration_minutes}
              onChange={(e) => set('duration_minutes', Number(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="tf-rem">{t('planner.reminder')}</label>
            <select id="tf-rem" className="input" disabled={!form.start_time} value={form.reminder_minutes ?? 'none'}
              onChange={(e) => set('reminder_minutes', e.target.value === 'none' ? null : Number(e.target.value))}>
              <option value="none">{t('planner.reminder.none')}</option>
              {REMINDERS.map((m) => <option key={m} value={m}>{t(`planner.reminder.${m}` as MessageKey)}</option>)}
            </select>
            {!form.start_time && <span className="hint">{t('planner.reminderNeedsTime')}</span>}
          </div>
        </div>
        <div className="field">
          <span className="label" id="tf-prio">{t('planner.priority')}</span>
          <div className="seg" role="group" aria-labelledby="tf-prio">
            {(['low', 'medium', 'high'] as Priority[]).map((p) => (
              <button type="button" key={p} aria-pressed={form.priority === p} onClick={() => set('priority', p)}>
                <span className={`prio ${p}`} aria-hidden="true" /> {t(`planner.priority.${p}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
        </div>
      </form>
    </Modal>
  );
}
