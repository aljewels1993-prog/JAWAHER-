import { useEffect, useState } from 'react';
import { useGame } from '../game/store.js';
import { initAudio, sfx } from '../game/audio.js';
import { STAGES, WORLDS } from '../data/stages.js';
import { questionsForStage } from '../data/questions.js';
import { BADGES, isStageUnlocked, totals, currentStage } from '../game/progress.js';
import heroImg from '../assets/hero-full.png';

const click = () => { initAudio(); sfx.click(); };

export function Btn({ children, onClick, kind = 'primary', className = '', ...rest }) {
  return <button type="button" className={`btn btn-${kind} ${className}`} onClick={(e) => { click(); onClick?.(e); }} {...rest}>{children}</button>;
}

export function TopBar() {
  const { lang, setLang, settings, updateSettings, setOverlay, go, screen, t } = useGame();
  const T = t();
  return (
    <div className="topbar">
      <Btn kind="chip" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} aria-label="language">🌐 {T.language}</Btn>
      <Btn kind="chip" onClick={() => updateSettings({ muted: !settings.muted })} aria-label={T.sound}>{settings.muted ? '🔇' : '🔊'}</Btn>
      <Btn kind="chip" onClick={() => setOverlay('instructions')} aria-label={T.instructions}>❔</Btn>
      <Btn kind="chip" onClick={() => setOverlay('leaderboard')} aria-label={T.leaderboard}>🏆</Btn>
      {screen !== 'teacher' && <Btn kind="chip" onClick={() => go('teacher')}>👩‍🏫 {T.teacher}</Btn>}
    </div>
  );
}

export function Welcome() {
  const { t, go, profiles, openProfile, backend } = useGame();
  const T = t();
  return (
    <div className="screen welcome">
      <div className="title-card">
        <div className="title-flag" aria-hidden>🇴🇲</div>
        <h1 className="game-title">OMAN ENGLISH QUEST <span className="three-d">3D</span></h1>
        <h2 className="game-title-ar" dir="rtl">رحلة التحدي: كنوز عُمان</h2>
        <p className="tagline">{T.tagline}</p>
        <div className="welcome-actions">
          <Btn className="big pulse" onClick={() => go('name')}>▶ {T.start}</Btn>
          {profiles[0] && <Btn kind="secondary" onClick={() => openProfile(profiles[0].id)}>{T.continue}: {profiles[0].name}</Btn>}
        </div>
        <p className="save-mode">💾 {T.playerMode[backend?.mode || 'local']}</p>
      </div>
    </div>
  );
}

export function NameEntry() {
  const { t, createProfile, profiles, openProfile, go } = useGame();
  const T = t();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    initAudio(); sfx.click(); setBusy(true); setErr('');
    try { await createProfile(name); } catch (ex) { setErr(ex.message || String(ex)); setBusy(false); }
  };
  return (
    <div className="screen name-entry">
      <div className="panel">
        <img className="hero-portrait" src={heroImg} alt="" />
        <form onSubmit={submit}>
          <label htmlFor="student-name"><h2>{T.enterName}</h2></label>
          <input id="student-name" autoFocus maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder={T.namePlaceholder} autoComplete="off" />
          <button className="btn btn-primary big" type="submit" disabled={!name.trim() || busy}>{T.letsGo} 🚀</button>
          {err && <p className="error">{err}</p>}
        </form>
        {profiles.length > 0 && (
          <div className="profiles">
            <h3>{T.chooseProfile}</h3>
            <div className="profile-list">
              {profiles.slice(0, 12).map((p) => {
                const tt = totals(p);
                return (
                  <Btn key={p.id} kind="secondary" className="profile" onClick={() => openProfile(p.id)}>
                    <b>{p.name}</b><small>🪙 {tt.coins} · ⭐ {tt.stars} · 🏁 {tt.stagesCompleted}/10</small>
                  </Btn>
                );
              })}
            </div>
          </div>
        )}
        <Btn kind="ghost" onClick={() => go('welcome')}>← {T.back}</Btn>
      </div>
    </div>
  );
}

export function MapPanel() {
  const { t, lang, profile, playStage, mapSelected, selectOnMap, go, logout } = useGame();
  const T = t();
  const ar = lang === 'ar';
  useEffect(() => { if (profile) selectOnMap(currentStage(profile)); }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!profile) return null;
  const tt = totals(profile);
  const st = STAGES[mapSelected - 1];
  const unlocked = isStageUnlocked(profile, st.id);
  const rec = profile.stages[st.id];
  const topics = [...new Set(questionsForStage(st.id).map((q) => q.topic))];
  const qDone = questionsForStage(st.id).filter((q) => profile.answers[q.id]?.done).length;
  return (
    <div className="screen map-ui">
      <div className="player-card">
        <img src={heroImg} alt="" />
        <div>
          <b>{profile.name}</b>
          <div className="stats"><span>🪙 {tt.coins}</span><span>⭐ {tt.stars}</span><span>📘 {tt.questionsDone}/50</span><span>🏁 {tt.stagesCompleted}/10</span></div>
          <div className="badges">{profile.badges.map((b) => { const d = BADGES.find((x) => x.id === b); return d ? <span key={b} title={ar ? d.ar : d.en}>{d.icon}</span> : null; })}</div>
        </div>
        <Btn kind="ghost" className="switch" onClick={logout}>⇄</Btn>
      </div>
      <h2 className="map-title">🗺️ {T.map}</h2>
      <div className="stage-strip">
        {WORLDS.map((wd) => (
          <div key={wd.id} className="world-group">
            <div className="world-label">{T.world} {wd.id}: {ar ? wd.nameAr : wd.name}</div>
            <div className="world-stages">
              {wd.stages.map((id) => {
                const s = STAGES[id - 1];
                const un = isStageUnlocked(profile, id);
                const done = profile.stages[id]?.completed;
                return (
                  <button key={id} type="button" className={`stage-dot ${un ? 'open' : 'locked'} ${done ? 'done' : ''} ${mapSelected === id ? 'sel' : ''}`}
                    onClick={() => { click(); selectOnMap(id); }} aria-label={`${T.stage} ${id} ${s.name}`}>
                    {done ? '✓' : un ? id : '🔒'}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="stage-card">
        <div className="stage-card-head">
          <span className="stage-num">{T.stage} {st.id}</span>
          <h3>{ar ? st.nameAr : st.name}</h3>
          <small>📍 {ar ? st.governorateAr : st.governorate}{st.id === 10 ? ' · 🕰️ برج الصحوة' : ''}</small>
        </div>
        <div className="topics">{topics.map((x) => <span key={x}>{x}</span>)}</div>
        {rec && <div className="stage-best">🪙 {rec.bestCoins} · ⭐ {rec.bestStars} · 📘 {qDone}/5</div>}
        {unlocked ? (
          <Btn className="big" onClick={() => playStage(st.id)}>{rec?.completed ? `↻ ${T.replay}` : `▶ ${T.play}`}</Btn>
        ) : <div className="locked-msg">🔒 {T.locked} — {ar ? `أكملي المرحلة ${st.id - 1} أولًا` : `Finish stage ${st.id - 1} first`}</div>}
        {profile.finishedAt && <Btn kind="gold" onClick={() => go('certificate')}>📜 {T.certificate}</Btn>}
      </div>
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  const T = useGame((s) => s.t)();
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><Btn kind="ghost" onClick={onClose} aria-label={T.close}>✕</Btn></div>
        {children}
      </div>
    </div>
  );
}

export function Instructions() {
  const { t, setOverlay } = useGame();
  const T = t();
  return (
    <Modal title={`❔ ${T.instructions}`} onClose={() => setOverlay(null)}>
      <ul className="howto">{T.howTo.map(([i, txt]) => <li key={txt}><span>{i}</span><p>{txt}</p></li>)}</ul>
      <Btn onClick={() => setOverlay(null)}>{T.close}</Btn>
    </Modal>
  );
}

export function Leaderboard() {
  const { t, setOverlay, backend, profile } = useGame();
  const T = t();
  const [rows, setRows] = useState(null);
  useEffect(() => { backend.leaderboard().then(setRows).catch(() => setRows([])); }, [backend]);
  const medal = (i) => ['🥇', '🥈', '🥉'][i] || i + 1;
  return (
    <Modal title={`🏆 ${T.leaderboard} – TOP 20`} onClose={() => setOverlay(null)}>
      {!rows && <p>…</p>}
      {rows && rows.length === 0 && <p>{T.noScores}</p>}
      {rows && rows.length > 0 && (
        <table className="board">
          <thead><tr><th>{T.rank}</th><th>{T.name}</th><th>{T.score}</th><th>{T.stagesDone}</th><th>🪙</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} className={profile && r.name === profile.name ? 'me' : ''}><td>{medal(i)}</td><td>{r.name}</td><td>{r.score}</td><td>{r.stages}/10</td><td>{r.coins}</td></tr>
          ))}</tbody>
        </table>
      )}
    </Modal>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return <div className="toasts" aria-live="polite">{toasts.map((x) => <div key={x.id} className={`toast toast-${x.kind}`}>{x.text}</div>)}</div>;
}
