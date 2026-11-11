import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { Account, Lang } from '../api/types';
import { useI18n } from '../i18n';

interface AuthState {
  account: Account | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setPoints: (total: number) => void;
  changeLanguage: (lang: Lang) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setLang } = useI18n();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const a = await api.getAccount();
      setAccount(a);
      const l = a?.student?.language ?? a?.teacher?.language;
      if (l) setLang(l);
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [setLang]);

  useEffect(() => {
    void refresh();
    return api.onAuthChange((event) => {
      if (event === 'SIGNED_OUT') setAccount(null);
      else if (event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION') void refresh();
    });
  }, [refresh]);

  const setPoints = useCallback((total: number) => {
    setAccount((a) => (a?.student ? { ...a, student: { ...a.student, total_points: total } } : a));
  }, []);

  const changeLanguage = useCallback(async (lang: Lang) => {
    setLang(lang);
    if (!account) return;
    try {
      if (account.role === 'teacher') {
        const teacher = await api.updateTeacherProfile({ language: lang });
        setAccount((a) => (a ? { ...a, teacher } : a));
      } else if (account.student) {
        const student = await api.updateProfile({ language: lang });
        setAccount((a) => (a ? { ...a, student } : a));
      }
    } catch { /* the local preference is still applied */ }
  }, [account, setLang]);

  const signOut = useCallback(async () => {
    await api.signOut();
    setAccount(null);
  }, []);

  const value = useMemo(() => ({ account, loading, refresh, setPoints, changeLanguage, signOut }),
    [account, loading, refresh, setPoints, changeLanguage, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** The signed-in student's profile (only used under RequireStudent). */
export function useStudent() {
  const { account } = useAuth();
  return account!.student!;
}
