import { useState, type FormEvent } from 'react';
import { api, cloudConfigured } from '../api';
import { subjectLabel, useI18n, type MessageKey } from '../i18n';
import { useAuth } from '../state/auth';
import { useFeedback } from '../state/feedback';
import { errorText } from '../components/ui';
import { Mascot } from '../components/Mascot';
import { useInstall } from '../lib/install';
import { isIos } from '../lib/browserNotify';
import { AlertsPermission } from './Notifications';
import { GRADES } from './auth/AuthPages';

export default function ProfilePage() {
  const { t, lang } = useI18n();
  const { account, refresh, changeLanguage, signOut } = useAuth();
  const { toast } = useFeedback();
  const install = useInstall();
  const student = account?.student;
  const teacher = account?.role === 'teacher';
  const [name, setName] = useState(student?.full_name ?? '');
  const [grade, setGrade] = useState(String(student?.grade ?? ''));
  const [busy, setBusy] = useState(false);
  const [newSubject, setNewSubject] = useState('');

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast(t('login.nameRequired'), 'error'); return; }
    setBusy(true);
    try {
      await api.updateProfile({ full_name: name.trim().replace(/\s+/g, ' '), grade: Number(grade) });
      await refresh();
      toast(t('profile.saved'), 'success');
    } catch (err) {
      toast(errorText(t, err), 'error');
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

  return (
    <div className="page">
      <div className="page-head">
        <div className="avatar big" aria-hidden="true">{teacher ? '👩‍🏫' : (student?.full_name ?? '?').charAt(0)}</div>
        <div className="grow">
          <h1>{teacher ? t('profile.role.teacher') : student?.full_name}</h1>
          <p>{teacher ? `🔐 ${t('profile.teacherNote')}` : `🎒 ${t(`grade.${student?.grade}` as MessageKey)}`}</p>
        </div>
      </div>

      <div className="grid-2">
        {student && (
          <section className="card" aria-labelledby="acc-h">
            <h2 id="acc-h">👤 {t('profile.account')}</h2>
            <form onSubmit={saveProfile}>
              <div className="field">
                <label htmlFor="p-name">{t('login.name')}</label>
                <input id="p-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="p-grade">{t('profile.grade')}</label>
                <select id="p-grade" className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
                  {GRADES.map((g) => <option key={g} value={g}>{t(`grade.${g}` as MessageKey)}</option>)}
                </select>
                <span className="hint">{t('profile.nameHint')}</span>
              </div>
              <button className="btn" disabled={busy}>{busy ? t('common.saving') : t('profile.saveProfile')}</button>
            </form>
          </section>
        )}

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
