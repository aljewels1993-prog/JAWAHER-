import type { AppNotification, Lang } from '../api/types';
import { translate, subjectLabel } from '../i18n';
import { ACHIEVEMENT_TEXT } from '../i18n/achievements';
import { formatDate, formatTime } from './dates';

const ICONS: Record<AppNotification['kind'], string> = {
  welcome: '🧭', task_reminder: '📚', homework_reminder: '📝', test_reminder: '🧪', daily_reminder: '⏰',
  session_complete: '✅', daily_bonus: '🎁', achievement: '🏆',
};

/** Renders a stored notification (kind + params) in the reader's language. */
export function notificationText(n: AppNotification, lang: Lang): { icon: string; title: string; body: string } {
  const d = n.data as Record<string, string | number | null | undefined>;
  const tr = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);
  const icon = ICONS[n.kind] ?? '🔔';
  switch (n.kind) {
    case 'welcome':
      return { icon, title: tr('notif.welcome.title', { name: String(d.name ?? '') }), body: tr('notif.welcome.body') };
    case 'task_reminder':
    case 'homework_reminder':
    case 'test_reminder': {
      const key = `notif.${n.kind}.title` as const;
      return {
        icon,
        title: tr(key, { title: String(d.title ?? '') }),
        body: tr('notif.reminder.body', {
          subject: subjectLabel(lang, String(d.subject ?? '')),
          date: d.task_date ? formatDate(String(d.task_date), lang, { weekday: 'long', day: 'numeric', month: 'short' }) : '',
          time: formatTime(d.start_time ? String(d.start_time) : null, lang),
        }),
      };
    }
    case 'daily_reminder': {
      const open = Number(d.open_tasks ?? 0);
      return { icon, title: tr('notif.daily_reminder.title'), body: open > 0 ? tr('notif.daily_reminder.body', { n: open }) : tr('notif.daily_reminder.empty') };
    }
    case 'session_complete':
      return { icon, title: tr('notif.session_complete.title'), body: tr('notif.session_complete.body', { n: Number(d.minutes ?? 0), p: Number(d.points ?? 0) }) };
    case 'daily_bonus':
      return { icon, title: tr('notif.daily_bonus.title', { p: Number(d.points ?? 0) }), body: tr('notif.daily_bonus.body') };
    case 'achievement': {
      const a = ACHIEVEMENT_TEXT[String(d.achievement_id)];
      return {
        icon,
        title: tr('notif.achievement.title', { name: a ? (lang === 'ar' ? a.name_ar : a.name_en) : '', icon: String(d.icon ?? '') }),
        body: tr('notif.achievement.body', { desc: a ? (lang === 'ar' ? a.description_ar : a.description_en) : '' }),
      };
    }
    default:
      return { icon: '🔔', title: '', body: '' };
  }
}

export function isDue(n: AppNotification, now = Date.now()): boolean {
  return new Date(n.scheduled_for).getTime() <= now;
}
