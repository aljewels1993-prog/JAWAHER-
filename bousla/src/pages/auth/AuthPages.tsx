import { useState, type FormEvent, type ReactNode } from 'react';
import { api, cloudConfigured } from '../../api';
import { useI18n, type MessageKey } from '../../i18n';
import { useAuth } from '../../state/auth';
import { useFeedback } from '../../state/feedback';
import { Mascot } from '../../components/Mascot';
import { LangToggle } from '../../components/AppShell';
import { errorText } from '../../components/ui';
import logoUrl from '../../assets/logo.jpg';
import { Footer } from '../../components/Footer';

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <main className="auth">
      <div className="auth-top"><LangToggle /></div>
      <section className="auth-side" aria-hidden="true">
        <Mascot mood="joy" />
        <h2>{t('app.name')}</h2>
        <p>{t('app.tagline')} {t('auth.welcomeSub')}</p>
      </section>
      <section className="auth-card">
        <div className="auth-hero">
          <img className="logo" src={logoUrl} alt={t('app.name')} />
          <h1>{t('auth.welcomeTitle')}</h1>
          <p>{t('app.tagline')}</p>
        </div>
        {!cloudConfigured && <div className="alert warn" role="note">🧪 {t('device.banner')}</div>}
        {children}
      </section>
      <div className="auth-footer"><Footer light /></div>
    </main>
  );
}

/** One screen for everyone: students enter name + grade, teachers enter the code. */
export function LoginPage() {
  const { t, lang } = useI18n();
  const { refresh } = useAuth();
  const { toast } = useFeedback();
  const [tab, setTab] = useState<'student' | 'teacher'>('student');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const studentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < 2) return setError(t('login.nameRequired'));
    if (!grade) return setError(t('login.gradeRequired'));
    setBusy(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Muscat';
      const r = await api.studentLogin(clean, Number(grade), lang, timezone);
      await refresh();
      toast(t(r.created ? 'login.welcomeNew' : 'login.welcomeBack', { name: clean.split(' ')[0] }), 'success', r.created ? '🎉' : '👋');
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  const teacherSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!code.trim()) return setError(t('error.invalid_code'));
    setBusy(true);
    try {
      await api.teacherLogin(code.trim());
      await refresh();
    } catch (err) {
      setError(errorText(t, err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <div className="seg" role="tablist" aria-label={t('auth.welcomeTitle')} style={{ display: 'flex', marginBottom: 18 }}>
        {(['student', 'teacher'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} style={{ flex: 1 }}
            onClick={() => { setTab(k); setError(''); }}>
            {k === 'student' ? '🎒' : '👩‍🏫'} {t(`login.${k}` as MessageKey)}
          </button>
        ))}
      </div>

      {error && <div className="alert error" role="alert">⚠️ {error}</div>}

      {tab === 'student' ? (
        <form onSubmit={studentSubmit} noValidate>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--navy)', marginBottom: 4 }}>{t('login.studentTitle')}</h2>
          <p style={{ color: 'var(--ink-2)', fontWeight: 600, marginBottom: 14 }}>{t('login.studentSub')}</p>
          <div className="field">
            <label htmlFor="name">{t('login.name')}</label>
            <input id="name" className="input" autoComplete="name" maxLength={80} placeholder={t('login.namePh')}
              value={name} onChange={(e) => setName(e.target.value)} aria-describedby="name-hint" />
            <span id="name-hint" className="hint">{t('login.nameHint')}</span>
          </div>
          <div className="field">
            <label htmlFor="grade">{t('login.grade')}</label>
            <select id="grade" className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">{t('login.chooseGrade')}</option>
              {GRADES.map((g) => <option key={g} value={g}>{t(`grade.${g}` as MessageKey)}</option>)}
            </select>
          </div>
          <button className="btn block big" disabled={busy}>{busy ? t('common.loading') : `🚀 ${t('login.enter')}`}</button>
        </form>
      ) : (
        <form onSubmit={teacherSubmit} noValidate>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--navy)', marginBottom: 4 }}>{t('login.teacherTitle')}</h2>
          <p style={{ color: 'var(--ink-2)', fontWeight: 600, marginBottom: 14 }}>{t('login.teacherSub')}</p>
          <div className="field">
            <label htmlFor="code">{t('login.code')}</label>
            <input id="code" className="input" type="password" inputMode="numeric" autoComplete="off" dir="ltr"
              style={{ letterSpacing: 6, textAlign: 'center', fontSize: '1.3rem' }} maxLength={32}
              value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <button className="btn block big" disabled={busy || !code}>{busy ? t('common.loading') : `🔐 ${t('login.teacherEnter')}`}</button>
        </form>
      )}
    </AuthLayout>
  );
}
