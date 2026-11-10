/** Default school subjects (stored in English; displayed translated). */
export const DEFAULT_SUBJECTS = ['English', 'Mathematics', 'Science', 'Arabic', 'Islamic Education', 'Social Studies', 'Other'] as const;

const COLORS: Record<string, string> = {
  English: '#8f78e8',
  Mathematics: '#4c8fd9',
  Science: '#2fae7d',
  Arabic: '#f07aa6',
  'Islamic Education': '#e0a325',
  'Social Studies': '#f0866a',
  Other: '#9aa0b8',
};
const ICONS: Record<string, string> = {
  English: '🔤', Mathematics: '➗', Science: '🔬', Arabic: '📜', 'Islamic Education': '🕌', 'Social Studies': '🌍', Other: '📌',
};
const EXTRA = ['#b07cd8', '#36b3c9', '#d9707f', '#7c9d3a', '#c98a3b', '#5e7ce2'];

export function subjectColor(subject: string): string {
  if (COLORS[subject]) return COLORS[subject];
  let h = 0;
  for (const ch of subject) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EXTRA[h % EXTRA.length];
}

export function subjectIcon(subject: string): string {
  return ICONS[subject] ?? '📘';
}

export function allSubjects(custom: string[]): string[] {
  return [...DEFAULT_SUBJECTS.filter((s) => s !== 'Other'), ...custom.filter((c) => !DEFAULT_SUBJECTS.includes(c as never)), 'Other'];
}
