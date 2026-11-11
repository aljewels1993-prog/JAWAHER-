import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useI18n, type MessageKey } from '../i18n';
import { useAuth } from '../state/auth';
import { useNotifications } from '../state/notifications';
import { useTimer } from '../state/timer';
import { cloudConfigured } from '../api';
import { formatClock } from '../lib/timer';
import compassUrl from '../assets/compass.png';
import { Footer } from './Footer';

interface Item { to: string; icon: string; label: MessageKey; short?: MessageKey }

const STUDENT_NAV: Item[] = [
  { to: '/', icon: '🏠', label: 'nav.home' },
  { to: '/planner', icon: '🗓️', label: 'nav.planner', short: 'nav.plannerShort' },
  { to: '/timer', icon: '⏱️', label: 'nav.timer', short: 'nav.timerShort' },
  { to: '/achievements', icon: '🏆', label: 'nav.achievements', short: 'nav.achievementsShort' },
  { to: '/reports', icon: '📊', label: 'nav.reports' },
  { to: '/notifications', icon: '🔔', label: 'nav.notifications' },
  { to: '/profile', icon: '👤', label: 'nav.profile' },
];

const TEACHER_NAV: Item[] = [
  { to: '/teacher', icon: '👩‍🏫', label: 'nav.students' },
  { to: '/profile', icon: '👤', label: 'nav.profile' },
];

export function Brand() {
  const { t } = useI18n();
  return (
    <Link to="/" className="brand" aria-label={t('app.name')}>
      <img src={compassUrl} alt="" />
      <span className="brand-text">{t('app.name')}<small>{t('app.tagline')}</small></span>
    </Link>
  );
}

export function LangToggle({ className = 'icon-btn' }: { className?: string }) {
  const { t, lang } = useI18n();
  const { changeLanguage } = useAuth();
  return (
    <button className={className} onClick={() => void changeLanguage(lang === 'ar' ? 'en' : 'ar')}
      aria-label={`${t('lang.label')}: ${t('lang.switchTo')}`} lang={lang === 'ar' ? 'en' : 'ar'}
      style={className === 'icon-btn' ? { width: 'auto', padding: '0 12px', fontWeight: 800, fontSize: '0.9rem' } : undefined}>
      🌐 {t('lang.switchTo')}
    </button>
  );
}

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return online;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { account, signOut } = useAuth();
  const { unread } = useNotifications();
  const timer = useTimer();
  const online = useOnline();
  const loc = useLocation();
  const teacher = account?.role === 'teacher';
  const nav = teacher ? TEACHER_NAV : STUDENT_NAV;
  const bottom = teacher ? TEACHER_NAV : STUDENT_NAV.slice(0, 5);
  const timerActive = timer.state.phase !== 'idle' && !timer.finished;

  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  return (
    <div className="shell">
      <aside className="sidebar" aria-label={t('nav.main')}>
        <div style={{ marginBottom: 18 }}><Brand /></div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {nav.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="ico" aria-hidden="true">{i.icon}</span>{t(i.label)}
              {i.to === '/notifications' && unread > 0 && <span className="count">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <LangToggle className="btn secondary" />
          <button className="btn ghost" onClick={() => void signOut()}>🚪 {t('nav.signOut')}</button>
        </div>
      </aside>

      <div className="main">
        {!cloudConfigured && <div className="banner" role="note">🧪 {t('device.banner')}</div>}
        {!online && <div className="banner offline" role="alert">📡 {t('offline.banner')}</div>}
        <header className="topbar">
          <Brand />
          {!teacher && timerActive && loc.pathname !== '/timer' && (
            <Link to="/timer" className="mini-timer" aria-label={t('home.timerRunning')}>
              ⏱️ {formatClock(timer.remaining)}
            </Link>
          )}
          <LangToggle />
          {!teacher && (
            <Link to="/notifications" className="icon-btn" aria-label={`${t('nav.notifications')}${unread ? ` (${unread})` : ''}`}>
              🔔{unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          )}
          <Link to="/profile" className="icon-btn" aria-label={t('nav.profile')}>👤</Link>
        </header>
        {children}
        <Footer />
      </div>

      <nav className="bottom-nav" aria-label={t('nav.main')} style={teacher ? { gridTemplateColumns: 'repeat(2, 1fr)' } : undefined}>
        {bottom.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico" aria-hidden="true">{i.icon}</span>
            <span>{t(i.short ?? i.label)}</span>
            {i.to === '/timer' && timerActive && <span className="live" aria-hidden="true" />}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
