import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, cloudConfigured } from '../../api';
import { useI18n } from '../../i18n';
import { useAuth } from '../../state/auth';
import { Mascot } from '../../components/Mascot';
import { LangToggle } from '../../components/AppShell';
import { PasswordInput, errorText } from '../../components/ui';
import logoUrl from '../../assets/logo.jpg';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

function AuthLayout({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
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
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
        {!cloudConfigured && <div className="alert warn" role="note">🧪 {t('device.banner')}</div>}
        {children}
      </section>
    </main>
  );
}

export function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email.trim())) { setError(t('auth.emailInvalid')); return; }
    setBusy(true);
    try {
      await api.signIn(email, password);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('auth.welcomeTitle')} sub={t('app.tagline')}>
      <form onSubmit={submit} noValidate>
        {error && <div className="alert error" role="alert">⚠️ {error}</div>}
        <div className="field">
          <label htmlFor="email">{t('auth.email')}</label>
          <input id="email" className="input" type="email" dir="ltr" autoComplete="email" inputMode="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">{t('auth.password')}</label>
          <PasswordInput id="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} show={show} onToggle={() => setShow(!show)} toggleLabel={t('auth.showPassword')} />
        </div>
        <div style={{ textAlign: 'end', marginTop: -6, marginBottom: 14 }}>
          <Link to="/forgot-password" style={{ fontWeight: 700 }}>{t('auth.forgot')}</Link>
        </div>
        <button className="btn block big" disabled={busy || !email || !password}>{busy ? t('common.loading') : t('auth.login')}</button>
      </form>
      <p className="auth-foot">{t('auth.noAccount')} <Link to="/signup">{t('auth.signup')}</Link></p>
    </AuthLayout>
  );
}

export function SignupPage() {
  const { t, lang } = useI18n();
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const uname = form.username.trim().toLowerCase();
  const unameValid = USERNAME_RE.test(uname);

  // Debounced username availability check.
  useEffect(() => {
    setAvailable(null);
    if (!unameValid) return;
    const id = window.setTimeout(() => {
      api.usernameAvailable(uname).then(setAvailable).catch(() => setAvailable(null));
    }, 400);
    return () => window.clearTimeout(id);
  }, [uname, unameValid]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.fullName.trim().length < 2) return setError(t('auth.nameInvalid'));
    if (!unameValid) return setError(t('auth.usernameInvalid'));
    if (available === false) return setError(t('auth.usernameTaken'));
    if (!EMAIL_RE.test(form.email.trim())) return setError(t('auth.emailInvalid'));
    if (form.password.length < 8) return setError(t('error.weak_password'));
    if (form.password !== form.confirm) return setError(t('auth.passwordsDontMatch'));
    setBusy(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Muscat';
      const r = await api.signUp({ fullName: form.fullName, username: uname, email: form.email, password: form.password, language: lang, timezone });
      if (r.needsConfirmation) setSentTo(form.email.trim());
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout title={t('auth.signup')} sub={t('app.tagline')}>
        <div className="alert success" role="status">📬 {t('auth.checkEmail', { email: sentTo })}</div>
        <Link className="btn block" to="/login">{t('auth.backToLogin')}</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.signup')} sub={t('auth.welcomeSub')}>
      <form onSubmit={submit} noValidate>
        {error && <div className="alert error" role="alert">⚠️ {error}</div>}
        <div className="field">
          <label htmlFor="fullName">{t('auth.fullName')}</label>
          <input id="fullName" className="input" autoComplete="name" required maxLength={80} value={form.fullName} onChange={set('fullName')} />
        </div>
        <div className="field">
          <label htmlFor="username">{t('auth.username')}</label>
          <input id="username" className="input" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={20}
            value={form.username} onChange={set('username')} aria-describedby="username-hint" aria-invalid={!!uname && (!unameValid || available === false)} />
          <span id="username-hint" className={`hint ${uname && unameValid && available ? 'ok' : uname && (!unameValid || available === false) ? 'bad' : ''}`}>
            {!uname ? t('auth.usernameHint') : !unameValid ? t('auth.usernameInvalid') : available === false ? t('auth.usernameTaken') : available ? t('auth.usernameAvailable') : t('auth.usernameHint')}
          </span>
        </div>
        <div className="field">
          <label htmlFor="email">{t('auth.email')}</label>
          <input id="email" className="input" type="email" dir="ltr" autoComplete="email" inputMode="email" required value={form.email} onChange={set('email')} />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="password">{t('auth.password')}</label>
            <PasswordInput id="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')}
              show={show} onToggle={() => setShow(!show)} toggleLabel={t('auth.showPassword')} aria-describedby="pw-hint" />
            <span id="pw-hint" className="hint">{t('auth.passwordHint')}</span>
          </div>
          <div className="field">
            <label htmlFor="confirm">{t('auth.confirmPassword')}</label>
            <input id="confirm" className="input" dir="ltr" type={show ? 'text' : 'password'} autoComplete="new-password" required value={form.confirm} onChange={set('confirm')}
              aria-invalid={!!form.confirm && form.confirm !== form.password} />
          </div>
        </div>
        <button className="btn block big" disabled={busy}>{busy ? t('common.loading') : t('auth.signup')}</button>
      </form>
      <p className="auth-foot">{t('auth.haveAccount')} <Link to="/login">{t('auth.login')}</Link></p>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email.trim())) return setError(t('auth.emailInvalid'));
    setBusy(true);
    try {
      await api.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('auth.forgotTitle')} sub={t('auth.forgotSub')}>
      {sent ? (
        <div className="alert success" role="status">📬 {t('auth.resetSent', { email: email.trim() })}</div>
      ) : (
        <form onSubmit={submit} noValidate>
          {error && <div className="alert error" role="alert">⚠️ {error}</div>}
          <div className="field">
            <label htmlFor="email">{t('auth.email')}</label>
            <input id="email" className="input" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn block big" disabled={busy || !email}>{busy ? t('common.loading') : t('auth.sendReset')}</button>
        </form>
      )}
      <p className="auth-foot"><Link to="/login">{t('auth.backToLogin')}</Link></p>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { t } = useI18n();
  const { account } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError(t('error.weak_password'));
    if (password !== confirm) return setError(t('auth.passwordsDontMatch'));
    setBusy(true);
    try {
      await api.updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('auth.resetTitle')} sub={t('app.tagline')}>
      {done ? (
        <>
          <div className="alert success" role="status">✅ {t('auth.passwordUpdated')}</div>
          <a className="btn block" href="/">{t('nav.home')}</a>
        </>
      ) : !account ? (
        <>
          <div className="alert info">ℹ️ {t('auth.resetLinkInvalid')}</div>
          <Link className="btn block secondary" to="/forgot-password">{t('auth.forgotTitle')}</Link>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          {error && <div className="alert error" role="alert">⚠️ {error}</div>}
          <div className="field">
            <label htmlFor="password">{t('auth.newPassword')}</label>
            <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
              show={show} onToggle={() => setShow(!show)} toggleLabel={t('auth.showPassword')} />
            <span className="hint">{t('auth.passwordHint')}</span>
          </div>
          <div className="field">
            <label htmlFor="confirm">{t('auth.confirmPassword')}</label>
            <input id="confirm" className="input" dir="ltr" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button className="btn block big" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
        </form>
      )}
    </AuthLayout>
  );
}
