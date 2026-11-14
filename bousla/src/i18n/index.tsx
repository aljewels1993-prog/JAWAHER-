import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from '../api/types';
import { en, type MessageKey } from './en';
import { ar } from './ar';

export type { MessageKey };
export const DICTS = { en, ar } as const;
const KEY = 'bousla.lang';

export function translate(lang: Lang, key: MessageKey, params?: Record<string, string | number>): string {
  let text: string = DICTS[lang][key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

/** Subject names: built-in subjects are translated, custom ones shown as typed. */
export function subjectLabel(lang: Lang, subject: string): string {
  const key = `subject.${subject}` as MessageKey;
  return key in en ? translate(lang, key) : subject;
}

interface I18n {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang: (l: Lang) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  try { const v = localStorage.getItem(KEY); if (v === 'en' || v === 'ar') return v; } catch { /* blocked */ }
  return 'ar';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.title = lang === 'ar' ? 'بوصلة · BOUSLA' : 'BOUSLA · بوصلة';
    try { localStorage.setItem(KEY, lang); } catch { /* blocked */ }
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const t = useCallback((key: MessageKey, params?: Record<string, string | number>) => translate(lang, key, params), [lang]);
  const value = useMemo(() => ({ lang, dir, setLang, t }) as I18n, [lang, dir, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}
