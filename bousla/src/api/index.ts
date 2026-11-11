import type { Api } from './types';
import { createSupabaseApi } from './supabaseApi';
import { createDeviceApi } from './deviceApi';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Cloud when Supabase is configured at build time; otherwise device-only mode. */
export const cloudConfigured = !!(url && key && url.startsWith('https://'));

/** localStorage, or an in-memory store where the browser blocks it. */
function safeStorage(): Storage {
  try {
    const s = window.localStorage;
    s.setItem('bousla.probe', '1');
    s.removeItem('bousla.probe');
    return s;
  } catch {
    const m = new Map<string, string>();
    return {
      get length() { return m.size; }, clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null,
      getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); },
    };
  }
}

export const api: Api = cloudConfigured ? createSupabaseApi(url!, key!) : createDeviceApi(safeStorage(), (import.meta.env.VITE_TEACHER_CODE as string | undefined) || '1993');

