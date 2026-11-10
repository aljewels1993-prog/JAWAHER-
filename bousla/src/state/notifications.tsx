import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { AppNotification } from '../api/types';
import { useI18n } from '../i18n';
import { isDue, notificationText } from '../lib/notificationText';
import { showSystemNotification } from '../lib/browserNotify';
import { playChime } from '../lib/sound';
import { useAuth } from './auth';
import { useFeedback } from './feedback';

interface NotificationsApi {
  items: AppNotification[];
  loading: boolean;
  error: unknown;
  unread: number;
  reload: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const Ctx = createContext<NotificationsApi | null>(null);
const FIRED_KEY = 'bousla.firedReminders.v1';

function firedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]')); } catch { return new Set(); }
}
function remember(id: string) {
  const s = [...firedSet(), id].slice(-200);
  try { localStorage.setItem(FIRED_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const { lang } = useI18n();
  const { version, toast } = useFeedback();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [now, setNow] = useState(Date.now());
  const timers = useRef<number[]>([]);
  const isStudent = account?.role === 'student' && !!account.student;

  const reload = useCallback(async () => {
    if (!account) { setItems([]); setLoading(false); return; }
    try {
      setItems(await api.listNotifications());
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
  }, [account]);

  // Daily reminder once per app start, then load.
  useEffect(() => {
    if (!account) return;
    (async () => {
      if (isStudent) { try { await api.ensureDailyReminder(); } catch { /* offline */ } }
      await reload();
    })();
  }, [account, isStudent, reload]);

  // Refresh after rewards (new achievement / session notifications) and every minute.
  useEffect(() => { if (version) void reload(); }, [version, reload]);
  useEffect(() => {
    if (!account) return;
    const id = window.setInterval(() => void reload(), 60_000);
    const onVis = () => { if (document.visibilityState === 'visible') void reload(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [account, reload]);

  // Pop reminders that become due while the app is open (in-app + system alert).
  useEffect(() => {
    timers.current.forEach((x) => window.clearTimeout(x));
    timers.current = [];
    const fired = firedSet();
    const fire = (n: AppNotification) => {
      if (fired.has(n.id) || n.read_at) return;
      remember(n.id);
      const { icon, title, body } = notificationText(n, lang);
      toast(`${title} — ${body}`, 'info', icon);
      playChime('reward');
      void showSystemNotification(title, body, '/notifications', n.id);
      setNow(Date.now());
    };
    for (const n of items) {
      if (!n.kind.endsWith('_reminder') || n.read_at) continue;
      const at = new Date(n.scheduled_for).getTime();
      const delay = at - Date.now();
      if (delay <= 0 && delay > -10 * 60_000) fire(n);
      else if (delay > 0 && delay < 24 * 3600_000) timers.current.push(window.setTimeout(() => fire(n), delay));
    }
    return () => timers.current.forEach((x) => window.clearTimeout(x));
  }, [items, lang, toast]);

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const at = new Date().toISOString();
    setItems((l) => l.map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at ?? at } : n)));
    try { await api.markNotificationsRead(ids); } catch (e) { setError(e); void reload(); }
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    setItems((l) => l.filter((n) => n.id !== id));
    try { await api.deleteNotification(id); } catch (e) { setError(e); void reload(); }
  }, [reload]);

  const unread = items.filter((n) => !n.read_at && isDue(n, now)).length;
  const value = useMemo(() => ({ items, loading, error, unread, reload, markRead, remove }), [items, loading, error, unread, reload, markRead, remove]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationsApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNotifications outside NotificationsProvider');
  return v;
}
