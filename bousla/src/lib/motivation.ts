import type { Lang } from '../api/types';

/** Motivational messages, shown daily and after achievements. */
export const MESSAGES: Record<Lang, string[]> = {
  en: [
    'You can do it!',
    'Every small step brings you closer to success.',
    'Believe in yourself!',
    'Great job! Keep going!',
    'Your future starts with what you do today.',
    'You are stronger than you think!',
  ],
  ar: [
    'لا تستسلمي، أنتِ قادرة!',
    'كل دقيقة مذاكرة تقرّبك من حلمك.',
    'أنتِ بطلة، واصلي التقدم!',
    'النجاح يبدأ بخطوة صغيرة.',
    'ثقي بنفسك، فأنتِ تستطيعين!',
  ],
};

/** Deterministic message of the day (changes every day, same all day). */
export function dailyIndex(dateIso: string, count: number): number {
  let h = 0;
  for (const ch of dateIso) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % count;
}

export function messageOfTheDay(lang: Lang, dateIso: string): string {
  const list = MESSAGES[lang];
  return list[dailyIndex(dateIso, list.length)];
}

/**
 * Picks a message that is not among the recently shown ones.
 * `recent` holds indexes, newest last. `random` is injectable for tests.
 */
export function pickMessage(lang: Lang, recent: number[], random: () => number = Math.random): { index: number; text: string } {
  const list = MESSAGES[lang];
  const avoid = new Set(recent.slice(-Math.max(1, Math.floor(list.length / 2))));
  const pool = list.map((_, i) => i).filter((i) => !avoid.has(i));
  const choices = pool.length ? pool : list.map((_, i) => i);
  const index = choices[Math.floor(random() * choices.length) % choices.length];
  return { index, text: list[index] };
}

const KEY = 'bousla.recentMessages.v1';

/** Picks and remembers a fresh message (per device). */
export function nextMessage(lang: Lang): string {
  let recent: number[] = [];
  try { recent = JSON.parse(localStorage.getItem(KEY) || '{}')[lang] || []; } catch { /* ignore */ }
  const { index, text } = pickMessage(lang, recent);
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}');
    all[lang] = [...recent, index].slice(-6);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* storage blocked */ }
  return text;
}
