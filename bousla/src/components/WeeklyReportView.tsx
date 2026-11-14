import type { WeeklyReport } from '../api/types';
import { subjectLabel, useI18n } from '../i18n';
import { ACHIEVEMENT_TEXT } from '../i18n/achievements';
import { ACHIEVEMENT_RULES } from '../lib/rewards';
import { formatDate, splitMinutes, todayIso } from '../lib/dates';
import { subjectColor, subjectIcon } from '../lib/subjects';
import { BarChart } from './BarChart';
import { Bar, Stat } from './ui';

export function useMinutesText() {
  const { t } = useI18n();
  return (min: number) => {
    const { hours, minutes } = splitMinutes(min);
    if (!hours) return t('common.minutes', { n: minutes });
    return minutes ? t('common.hm', { h: hours, m: minutes }) : t('common.h', { h: hours });
  };
}

/** Weekly report body, shared by the student report and the teacher view. */
export function WeeklyReportView({ report }: { report: WeeklyReport }) {
  const { t, lang } = useI18n();
  const mins = useMinutesText();
  const today = todayIso();
  const activeDays = report.days.filter((d) => d.minutes > 0 || d.tasks > 0).length;
  const maxSubject = Math.max(1, ...report.subjects.map((s) => s.minutes));
  const completion = report.tasks_planned ? Math.min(1, report.tasks_completed / report.tasks_planned) : 0;
  const summary = activeDays >= 5 ? t('reports.summaryGreat', { n: activeDays }) : activeDays > 0 ? t('reports.summaryGood', { n: activeDays }) : t('reports.summaryStart');

  return (
    <>
      <div className="stat-grid">
        <Stat icon="⏱️" tone="blue" value={mins(report.study_minutes)} label={t('reports.studyTime')} />
        <Stat icon="✅" tone="mint" value={report.tasks_completed} label={t('reports.tasksDone')} />
        <Stat icon="🎯" tone="purple" value={report.sessions_completed} label={t('reports.sessions')} />
        <Stat icon="⭐" tone="gold" value={report.points_earned} label={t('reports.points')} />
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card" aria-labelledby="daily-h">
          <h2 id="daily-h">📊 {t('reports.daily')}</h2>
          <BarChart
            title={t('reports.daily')}
            unitLabel={t('reports.dailyUnit')}
            data={report.days.map((d) => ({
              key: d.date,
              label: lang === 'ar' ? formatDate(d.date, lang, { weekday: 'long' }).replace(/^ال/, '') : formatDate(d.date, lang, { weekday: 'short' }),
              value: d.minutes,
              valueLabel: t('reports.minutesShort', { n: d.minutes }),
              highlight: d.date === today,
            }))}
          />
        </section>

        <section className="card tint-cream" aria-labelledby="sum-h">
          <h2 id="sum-h">🏅 {t('reports.summary')}</h2>
          <p style={{ fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>{summary}</p>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.9rem', marginBottom: 4 }}>
              <span>{t('reports.completion')}</span><span>{Math.round(completion * 100)}%</span>
            </div>
            <Bar value={completion} tone="mint" label={t('reports.completion')} />
            <small style={{ color: 'var(--muted)', fontWeight: 700 }}>{t('reports.completionDetail', { done: report.tasks_completed, total: report.tasks_planned })}</small>
          </div>
          <p style={{ fontWeight: 800, marginBottom: 6 }}>📚 {t('reports.topSubject')}: <span style={{ color: 'var(--purple-deep)' }}>
            {report.top_subject ? `${subjectIcon(report.top_subject)} ${subjectLabel(lang, report.top_subject)}` : t('reports.none')}</span></p>
          <p style={{ fontWeight: 800, marginBottom: 6 }}>{t('reports.badges')}:</p>
          {report.badges.length ? (
            <div className="chips">
              {report.badges.map((b) => (
                <span key={b} className="chip" style={{ background: 'var(--gold-soft)', color: '#7a5a00' }}>
                  {ACHIEVEMENT_RULES.find((r) => r.id === b)?.icon} {lang === 'ar' ? ACHIEVEMENT_TEXT[b]?.name_ar : ACHIEVEMENT_TEXT[b]?.name_en}
                </span>
              ))}
            </div>
          ) : <p style={{ color: 'var(--muted)', fontWeight: 700 }}>{t('reports.noBadges')}</p>}
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }} aria-labelledby="subj-h">
        <h2 id="subj-h">📚 {t('reports.subjects')}</h2>
        {report.subjects.length ? report.subjects.map((s) => (
          <div className="subject-row" key={s.subject}>
            <span>{subjectIcon(s.subject)} {subjectLabel(lang, s.subject)}</span>
            <div className="bar" aria-hidden="true"><span style={{ width: `${(s.minutes / maxSubject) * 100}%`, background: subjectColor(s.subject) }} /></div>
            <span style={{ whiteSpace: 'nowrap' }}>{mins(s.minutes)}</span>
          </div>
        )) : <p style={{ color: 'var(--muted)', fontWeight: 700 }}>{t('reports.noSubjects')}</p>}
      </section>
    </>
  );
}
