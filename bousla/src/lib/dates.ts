/** Calendar helpers. Dates are local ISO strings (YYYY-MM-DD) to avoid timezone drift. */
import type { Lang } from '../api/types';

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(now: Date = new Date()): string {
  return isoDate(now);
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** The Sunday that starts the week containing `iso`. */
export function weekStart(iso: string): string {
  const d = parseIsoDate(iso);
  return addDays(iso, -d.getDay());
}

/** Sunday → Thursday of the school week starting at `start`. */
export function schoolDays(start: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => addDays(start, i));
}

export function weekDays(start: string): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i));
}

export function locale(lang: Lang): string {
  return lang === 'ar' ? 'ar-OM-u-nu-latn' : 'en-GB';
}

export function formatDate(iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  return new Intl.DateTimeFormat(locale(lang), opts).format(parseIsoDate(iso));
}

export function formatDateTime(ts: string | number | Date, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
}

/** "16:30" → "4:30 PM" / "4:30 م" */
export function formatTime(hhmm: string | null | undefined, lang: Lang): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat(locale(lang), { hour: 'numeric', minute: '2-digit' }).format(d);
}

/** Minutes → { hours, minutes } for display. */
export function splitMinutes(total: number): { hours: number; minutes: number } {
  const t = Math.max(0, Math.round(total));
  return { hours: Math.floor(t / 60), minutes: t % 60 };
}

/** Local Date for a task's date + start time. */
export function taskDateTime(dateIso: string, hhmm: string | null | undefined): Date {
  const d = parseIsoDate(dateIso);
  if (hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}
