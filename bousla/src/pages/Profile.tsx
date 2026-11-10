import { useState, type FormEvent } from 'react';
import { api, cloudConfigured } from '../api';
import { subjectLabel, useI18n } from '../i18n';
import { useAuth } from '../state/auth';
import { useFeedback } from '../state/feedback';
import { PasswordInput, errorText } from '../components/ui';
import { Mascot } from '../components/Mascot';
import { useInstall } from '../lib/install';
import { isIos } from '../lib/browserNotify';
import { AlertsPermission } from './Notifications';

export default function ProfilePage() {
  const { t, lang } = useI18n();
  const { account, refresh, changeLanguage, signOut } = useAuth();
  const { toast } = useFeedback();
  const install = useInstall();
  const student = account?.student;
  const teacher = account?.teacher;
  const [name, setName] = useState(student?.full_name ?? teacher?.full_name ?? '');
  const [username, setUsername] = useState(student?.username ?? '');
  const [school, setSchool] = useState(teacher?.school_name ?? '');
  const [busy, setBusy] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast(t('error.invalid_name'), 'error'); return; }
    setBusy(true);
    try {
      if (teacher) await api.updateTeacherProfile({ full_name: name.trim(), school_name: school.trim() || null });
      else {
        const u = username.trim().toLowerCase();
        if (!/^[a-z0-9_.]{3,20}$/.test(u)) throw new Error('invalid');
        await api.updateProfile({ full_name: name.trim(), username: u });
      }
      await refresh();
      toast(t('profile.saved'), 'success');
    } catch (err) {
      toast(err instanceof Error && err.message === 'invalid' ? t('error.invalid_username') : errorText(t, err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const setSubjects = async (list: string[]) => {
    try {
      await api.updateProfile({ custom_subjects: list });
      await refresh();
    } catch (err) {
      toast(errorText(t, err), 'error');
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { toast(t('error.weak_password'), 'error'); return; }
    try {
      await api.updatePassword(pw);
      setPw('');
      toast(t('profile.passwordSaved'), 'success');
    } catch (err) {
      toast(errorText(t, err), 'error');
    }
  };

  const initial = (name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="page">
      <div className="page-head">
        <div className="avatar big" aria-hidden="true">{initial}</div>
        <div className="grow">
          <h1>{name}</h1>
          <p>{teacher ? `👩‍🏫 ${t('profile.role.teacher')}` : `🎒 ${t('profile.role.student')} · @${student?.username}`}</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="acc-h">
          <h2 id="acc-h">👤 {t('profile.account')}</h2>
          <form onSubmit={saveProfile}>
            <div className="field">
              <label htmlFor="p-name">{t('auth.fullName')}</label>
              <input id="p-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {student && (
              <div className="field">
                <label htmlFor="p-user">{t('auth.username')}</label>
                <input id="p-user" className="input" dir="ltr" autoCapitalize="none" maxLength={20} value={username} onChange={(e) => setUsername(e.target.value)} />
                <span className="hint">{t('auth.usernameHint')}</span>
              </div>
            )}
            {teacher && (
              <div className="field">
                <label htmlFor="p-school">{t('profile.school')}</label>
                <input id="p-school" className="input" maxLength={120} value={school} onChange={(e) => setSchool(e.target.value)} />
              </div>
            )}
            <div className="field">
              <span className="label">{t('profile.email')}</span>
              <span dir="ltr" style={{ fontWeight: 700, color: 'var(--ink-2)', textAlign: 'start' }}>{account?.email}</span>
            </div>
            <button className="btn" disabled={busy}>{busy ? t('common.saving') : t('profile.saveProfile')}</button>
          </form>
        </section>

        <section className="card tint-purple" aria-labelledby="lang-h">
          <h2 id="lang-h">🌐 {t('lang.label')}</h2>
          <div className="seg" role="group" aria-labelledby="lang-h">
            <button aria-pressed={lang === 'ar'} onClick={() => void changeLanguage('ar')} lang="ar">العربية</button>
            <button aria-pressed={lang === 'en'} onClick={() => void changeLanguage('en')} lang="en">English</button>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 18 }}>
            <div style={{ width: 70 }}><Mascot mood="wink" /></div>
            <p style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{cloudConfigured ? t('profile.mode.cloud') : t('profile.mode.device')}</p>
          </div>
        </section>

        {student && (
          <section className="card" aria-labelledby="subj-h">
            <h2 id="subj-h">📚 {t('profile.subjects')}</h2>
            <p className="hint" style={{ color: 'var(--muted)', fontWeight: 600, marginBottom: 10 }}>{t('profile.subjectsHint')}</p>
            <div className="chips" style={{ marginBottom: 12 }}>
              {student.custom_subjects.length ? student.custom_subjects.map((s) => (
                <span key={s} className="chip">{subjectLabel(lang, s)}
                  <button className="link-btn" aria-label={t('profile.removeSubject', { name: s })} onClick={() => void setSubjects(student.custom_subjects.filter((x) => x !== s))}>✕</button>
                </span>
              )) : <span style={{ color: 'var(--muted)', fontWeight: 700 }}>{t('profile.noSubjects')}</span>}
            </div>
            <form style={{ display: 'flex', gap: 8 }} onSubmit={(e) => {
              e.preventDefault();
              const v = newSubject.trim().slice(0, 40);
              if (v && !student.custom_subjects.includes(v)) void setSubjects([...student.custom_subjects, v].slice(0, 20));
              setNewSubject('');
            }}>
              <input className="input" aria-label={t('planner.customSubject')} placeholder={t('planner.customSubject')} maxLength={40} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
              <button className="btn">{t('common.add')}</button>
            </form>
          </section>
        )}

        <section className="card" aria-labelledby="pw-h">
          <h2 id="pw-h">🔑 {t('profile.password')}</h2>
          <form onSubmit={changePassword}>
            <div className="field">
              <label htmlFor="p-pw">{t('auth.newPassword')}</label>
              <PasswordInput id="p-pw" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} show={showPw} onToggle={() => setShowPw(!showPw)} toggleLabel={t('auth.showPassword')} />
              <span className="hint">{t('auth.passwordHint')}</span>
            </div>
            <button className="btn secondary" disabled={!pw}>{t('common.save')}</button>
          </form>
        </section>

        <section className="card tint-mint" aria-labelledby="inst-h">
          <h2 id="inst-h">📲 {t('profile.install')}</h2>
          {install.installed ? <div className="alert success">✅ {t('profile.installDone')}</div>
            : install.canPrompt ? <button className="btn mint" onClick={() => void install.prompt()}>📲 {t('profile.installBtn')}</button>
            : <p style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{isIos() ? t('profile.installIos') : t('profile.installOther')}</p>}
        </section>

        {student && (
          <section className="card tint-blue" aria-labelledby="alerts-h">
            <h2 id="alerts-h">🔔 {t('profile.alerts')}</h2>
            <AlertsPermission />
          </section>
        )}
      </div>

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button className="btn ghost" onClick={() => void signOut()}>🚪 {t('nav.signOut')}</button>
      </div>
    </div>
  );
}
