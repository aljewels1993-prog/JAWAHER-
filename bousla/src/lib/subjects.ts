/** Default school subjects (stored in English; displayed translated). */
export const DEFAULT_SUBJECTS = ['English', 'Mathematics', 'Science', 'Arabic', 'Islamic Education', 'Social Studies', 'Other'] as const;

const COLORS: Record<string, string> = {
  English: '#2f6aa8',
  Mathematics: '#e0a43a',
  Science: '#2a8a7d',
  Arabic: '#c9673f',
  'Islamic Education': '#6b8f3e',
  'Social Studies': '#5a6f8a',
  Other: '#9aa3b0',
};
const ICONS: Record<string, string> = {
  English: '🔤', Mathematics: '➗', Science: '🔬', Arabic: '📜', 'Islamic Education': '🕌', 'Social Studies': '🌍', Other: '📌',
};
const EXTRA = ['#7a9cc0', '#d08a5a', '#4f8f9a', '#a7894a', '#6f7fa8', '#8fa56a'];

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
