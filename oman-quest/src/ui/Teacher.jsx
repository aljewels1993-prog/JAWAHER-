import { Fragment, useState } from 'react';
import { useGame } from '../game/store.js';
import { QUESTION_BY_ID } from '../data/questions.js';
import { STAGES } from '../data/stages.js';
import { Btn, TopBar } from './Screens.jsx';
import { VoiceStudio } from './VoiceStudio.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Teacher dashboard. Cloud mode: Supabase email/password sign-in, and the
 * account must be in the `teachers` table (checked server-side by RLS).
 * Local mode: a device PIN, stored only as a SHA-256 hash.
 */
export function TeacherDashboard() {
  const { backend, t, go } = useGame();
  const T = t();
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState('');
  const [students, setStudents] = useState(null);
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('');
  const [studio, setStudio] = useState(false);
  const cloud = backend.mode === 'cloud';
  const needsSetup = !cloud && backend.teacherNeedsSetup();

  const load = async () => {
    try { setStudents(await backend.teacherStudents()); } catch (e) { setErr(e.message); }
  };
  const login = async (e) => {
    e.preventDefault(); setErr('');
    try {
      if (needsSetup) await backend.teacherSetup(secret);
      else if (cloud) await backend.teacherLogin(email, secret);
      else await backend.teacherLogin(secret);
      setAuthed(true); setSecret(''); load();
    } catch (ex) { setErr(ex.message || String(ex)); }
  };
  const reset = async (s) => {
    if (!window.confirm(T.resetConfirm(s.name))) return;
    try { await backend.teacherReset(s.id); await load(); } catch (e) { setErr(e.message); }
  };
  const logout = async () => { await backend.teacherLogout(); setAuthed(false); setStudents(null); go('welcome'); };

  if (!authed) {
    return (
      <div className="screen teacher">
        <TopBar />
        <form className="panel teacher-login" onSubmit={login}>
          <h2>👩‍🏫 {T.teacherLogin}</h2>
          {needsSetup && <p className="small">{T.createPin}</p>}
          {cloud && <input type="email" placeholder={T.email} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />}
          <input type="password" inputMode={cloud ? undefined : 'numeric'} placeholder={cloud ? T.password : T.pin} value={secret}
            onChange={(e) => setSecret(e.target.value)} autoComplete={cloud ? 'current-password' : 'off'} required minLength={4} />
          <button className="btn btn-primary big" type="submit">{T.signIn}</button>
          {err && <p className="error">{err}</p>}
          <Btn kind="ghost" onClick={() => go('welcome')}>← {T.back}</Btn>
        </form>
      </div>
    );
  }

  const list = (students || []).filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()));
  const ranked = [...(students || [])].sort((a, b) => b.score - a.score);
  return (
    <div className="screen teacher dash">
      <div className="dash-head">
        <h2>👩‍🏫 {T.teacherTitle}</h2>
        <div className="dash-actions">
          <input placeholder="🔎" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Btn kind="gold" onClick={() => setStudio(!studio)}>🎙️ {T.voiceStudio}</Btn>
          <Btn kind="secondary" onClick={load}>↻ {T.refresh}</Btn>
          <Btn kind="ghost" onClick={logout}>{T.signOut}</Btn>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      {studio && <VoiceStudio onClose={() => setStudio(false)} />}
      <div className="dash-summary">
        <div><b>{students?.length ?? 0}</b><span>{T.students}</span></div>
        <div><b>{students?.filter((s) => s.stages >= 10).length ?? 0}</b><span>🏆</span></div>
        <div><b>{students?.length ? Math.round(students.reduce((n, s) => n + s.correct, 0) / students.length) : 0}/50</b><span>📘 avg</span></div>
        <div><b>{ranked[0]?.name || '—'}</b><span>🥇</span></div>
      </div>
      {!students && <p>…</p>}
      {students && students.length === 0 && <p>{T.noStudents}</p>}
      {list.length > 0 && (
        <div className="table-wrap">
          <table className="board teacher-table">
            <thead><tr><th>#</th><th>{T.name}</th><th>{T.score}</th><th>{T.stagesDone}</th><th>🪙</th><th>⭐</th><th>📘 ✓</th><th>✗</th><th>{T.lastActive}</th><th /></tr></thead>
            <tbody>
              {list.map((s) => (
                <Fragment key={s.id}>
                  <tr className={open === s.id ? 'open' : ''} onClick={() => setOpen(open === s.id ? null : s.id)}>
                    <td>{ranked.indexOf(s) + 1}</td><td><b>{s.name}</b></td><td>{s.score}</td><td>{s.stages}/10</td><td>{s.coins}</td><td>{s.stars}</td>
                    <td>{s.correct}/{s.questionsDone}</td><td className={s.wrongAnswers ? 'bad' : ''}>{s.wrongAnswers}</td>
                    <td>{s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '—'}</td>
                    <td><Btn kind="danger" onClick={(e) => { e.stopPropagation(); reset(s); }}>{T.reset}</Btn></td>
                  </tr>
                  {open === s.id && (
                    <tr className="detail"><td colSpan={10}>
                      <div className="stage-chips">{STAGES.map((st) => <span key={st.id} className={s.stagesDetail?.[st.id]?.completed ? 'done' : ''}>{st.id}</span>)}</div>
                      <h4>{T.wrongAnswers}</h4>
                      {s.wrong.length === 0 ? <p className="small">—</p> : (
                        <ul className="wrong-list">
                          {s.wrong.map((w) => {
                            const q = QUESTION_BY_ID[w.questionId];
                            return (
                              <li key={w.questionId}>
                                <b>{w.questionId.toUpperCase()}</b> ({q.topic}) — {q.prompt}<br />
                                ✗ {w.wrong.map((i) => `${LETTERS[i]}. ${q.options[i]}`).join(', ')} · ✓ {LETTERS[q.answer]}. {q.options[q.answer]} {w.solved ? '(solved later)' : ''}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
