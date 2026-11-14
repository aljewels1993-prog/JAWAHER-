import { useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { useFeedback } from '../state/feedback';
import { useAsync } from '../state/useAsync';
import { LoadError, Spinner } from '../components/ui';
import { WeeklyReportView } from '../components/WeeklyReportView';
import { addDays, formatDate, todayIso, weekStart } from '../lib/dates';

export function WeekNav({ start, onChange }: { start: string; onChange: (s: string) => void }) {
  const { t, lang } = useI18n();
  const current = weekStart(todayIso());
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      <button className="icon-btn" onClick={() => onChange(addDays(start, -7))} aria-label={t('reports.prev')}><span className="flip-rtl">◀</span></button>
      <strong style={{ color: 'var(--navy)', minWidth: 170, textAlign: 'center' }}>
        {formatDate(start, lang, { day: 'numeric', month: 'short' })} – {formatDate(addDays(start, 6), lang, { day: 'numeric', month: 'short', year: 'numeric' })}
      </strong>
      <button className="icon-btn" onClick={() => onChange(addDays(start, 7))} disabled={start >= current} aria-label={t('reports.next')}
        style={start >= current ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}><span className="flip-rtl">▶</span></button>
      {start !== current && <button className="btn small secondary" onClick={() => onChange(current)}>{t('reports.thisWeek')}</button>}
    </div>
  );
}

export default function ReportsPage() {
  const { t } = useI18n();
  const { version } = useFeedback();
  const [start, setStart] = useState(() => weekStart(todayIso()));
  const report = useAsync(() => api.getWeeklyReport(start), [start, version]);

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>📊 {t('reports.title')}</h1>
          <p>{t('reports.sub')}</p>
        </div>
      </div>
      <WeekNav start={start} onChange={setStart} />
      {report.error ? <LoadError error={report.error} onRetry={report.reload} /> : !report.data ? <Spinner /> : <WeeklyReportView report={report.data} />}
    </div>
  );
}
