import { useState } from 'react';
import { useI18n } from '../i18n';
import { useNotifications } from '../state/notifications';
import { Empty, LoadError, Spinner } from '../components/ui';
import { isDue, notificationText } from '../lib/notificationText';
import { formatDateTime } from '../lib/dates';
import { isIos, isStandalone, notifySupport, requestNotifyPermission, type NotifySupport } from '../lib/browserNotify';

export function AlertsPermission() {
  const { t } = useI18n();
  const [perm, setPerm] = useState<NotifySupport>(notifySupport());
  const iosNeedsInstall = isIos() && !isStandalone();
  return (
    <div>
      {perm === 'granted' && <div className="alert success">🔔 {t('notif.enabled')}</div>}
      {perm === 'denied' && <div className="alert warn">🔕 {t('notif.denied')}</div>}
      {perm === 'unsupported' && <div className="alert info">ℹ️ {iosNeedsInstall ? t('notif.iosHint') : t('notif.unsupported')}</div>}
      {perm === 'default' && (
        <button className="btn secondary" style={{ marginBottom: 12 }} onClick={async () => setPerm(await requestNotifyPermission())}>🔔 {t('notif.enable')}</button>
      )}
      <p style={{ color: 'var(--muted)', fontWeight: 700, fontSize: '0.85rem' }}>ℹ️ {t('notif.limitsNote')}</p>
    </div>
  );
}

export default function NotificationsPage() {
  const { t, lang } = useI18n();
  const { items, loading, error, reload, markRead, remove } = useNotifications();
  const now = Date.now();
  const due = items.filter((n) => isDue(n, now));
  const scheduled = items.filter((n) => !isDue(n, now)).sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
  const unreadIds = due.filter((n) => !n.read_at).map((n) => n.id);

  const row = (n: (typeof items)[number], upcoming = false) => {
    const { icon, title, body } = notificationText(n, lang);
    const unread = !n.read_at && !upcoming;
    return (
      <li key={n.id} className={`notif${unread ? ' unread' : ''}`}>
        <span className="n-ico" aria-hidden="true">{icon}</span>
        <div className="n-body">
          <div className="n-title">{unread && <span className="chip" style={{ marginInlineEnd: 6, background: 'var(--pink-deep)', color: '#fff', fontSize: '0.7rem' }}>{t('notif.new')}</span>}{title}</div>
          <div className="n-text">{body}</div>
          <div className="n-time">{upcoming ? `⏰ ${t('notif.scheduled')} · ` : ''}{formatDateTime(n.scheduled_for, lang)}</div>
        </div>
        <div className="task-actions">
          {unread && <button onClick={() => void markRead([n.id])} aria-label={`${t('notif.markRead')}: ${title}`}>✓</button>}
          <button onClick={() => void remove(n.id)} aria-label={`${t('notif.delete')}: ${title}`}>🗑️</button>
        </div>
      </li>
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow"><h1>🔔 {t('notif.title')}</h1></div>
        <button className="btn secondary" disabled={!unreadIds.length} onClick={() => void markRead(unreadIds)}>✓ {t('notif.markAllRead')}</button>
      </div>
      <section className="card tint-blue" style={{ marginBottom: 16 }}><AlertsPermission /></section>
      {error ? <LoadError error={error} onRetry={reload} /> : null}
      {loading && !items.length ? <Spinner /> : (
        <>
          {due.length ? <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>{due.map((n) => row(n))}</ul>
            : <section className="card"><Empty icon="🎈">{t('notif.empty')}</Empty></section>}
          {scheduled.length > 0 && (
            <>
              <h2 style={{ fontSize: '1.05rem', margin: '22px 4px 10px', color: 'var(--navy)' }}>⏰ {t('notif.scheduled')}</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>{scheduled.map((n) => row(n, true))}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
