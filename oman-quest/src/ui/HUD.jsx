import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store.js';
import { press, releaseAll } from '../game/input.js';
import { respawn } from '../game/sim.js';
import { session } from '../game/session.js';
import { STAGE_BY_ID, TOTAL_STAGES } from '../data/stages.js';
import { BADGES, totals, rewardsReady } from '../game/progress.js';
import { StarRating } from './Screens.jsx';
import { questionsForStage } from '../data/questions.js';
import { Btn } from './Screens.jsx';
import heroImg from '../assets/hero-full.png';

export function HUD() {
  const { hud, profile, stageId, t, lang, settings, updateSettings, setOverlay } = useGame();
  const T = t();
  const st = STAGE_BY_ID[stageId];
  const qDone = hud.questionsDone ?? 0;
  return (
    <div className="hud">
      <div className="hud-left">
        <img src={heroImg} alt="" className="hud-face" />
        <div className="hud-id">
          <b>{profile?.name}</b>
          <small>{T.stage} {stageId}/10 · {lang === 'ar' ? st.nameAr : st.name}</small>
        </div>
      </div>
      <div className="hud-stats">
        <span className="pill coin">🪙 {hud.coins}</span>
        <span className="pill star" title="stars">⭐ {hud.stars}{hud.stageStarsTotal ? <small> · {hud.stageStars}/{hud.stageStarsTotal}</small> : null}</span>
        <span className="pill hearts" aria-label="hearts">{'❤️'.repeat(Math.max(0, hud.hearts))}{'🤍'.repeat(Math.max(0, 3 - hud.hearts))}</span>
        <span className="pill quest" title={T.questions}>📘 {qDone}/5 <small>· {5 - qDone} {T.challenges}</small></span>
      </div>
      <div className="hud-right">
        <Btn kind="round" onClick={() => updateSettings({ muted: !settings.muted })} aria-label={T.sound}>{settings.muted ? '🔇' : '🔊'}</Btn>
        <Btn kind="round" onClick={() => { releaseAll(); setOverlay('pause'); }} aria-label={T.pause}>⏸</Btn>
      </div>
      <div className="progress" aria-label={T.progress}>
        <div className="progress-fill" style={{ width: `${Math.round(hud.progress * 100)}%` }} />
        <span className="progress-hero" style={{ insetInlineStart: `calc(${Math.round(hud.progress * 100)}% - 12px)` }}>🧕</span>
        <span className="progress-goal">{stageId === TOTAL_STAGES ? '🕰️' : '🚩'}</span>
      </div>
      {hud.power && (
        <div className={`power-bar ${hud.power}`}>
          <span>{hud.power === 'jump' ? '🍄 ' + T.powerJump : '🛡️ ' + T.powerShield}</span>
          <div style={{ width: `${hud.powerT * 100}%` }} />
        </div>
      )}
    </div>
  );
}

function HoldButton({ action, className, children, label }) {
  const active = useRef(false);
  const down = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* pointer already gone */ }
    active.current = true; press(action, true);
  };
  const up = (e) => { e.preventDefault(); if (active.current) press(action, false); active.current = false; };
  return (
    <button type="button" className={`touch-btn ${className}`} aria-label={label}
      onPointerDown={down} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onContextMenu={(e) => e.preventDefault()}>
      {children}
    </button>
  );
}

export function TouchControls() {
  const onPipe = useGame((s) => s.hud.onPipe);
  const T = useGame((s) => s.t)();
  const [touch, setTouch] = useState(() => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window));
  useEffect(() => {
    const on = () => setTouch(true);
    window.addEventListener('touchstart', on, { once: true });
    return () => window.removeEventListener('touchstart', on);
  }, []);
  useEffect(() => () => releaseAll(), []);
  if (!touch) return null;
  return (
    <div className="touch" dir="ltr">
      <div className="dpad">
        <HoldButton action="left" className="left" label="left">◀</HoldButton>
        <HoldButton action="right" className="right" label="right">▶</HoldButton>
      </div>
      <div className="actions">
        {onPipe && <HoldButton action="down" className="pipe" label="enter pipe">⬇ {T.enterPipe}</HoldButton>}
        <HoldButton action="jump" className="jump" label="jump">⤴<small>JUMP</small></HoldButton>
      </div>
    </div>
  );
}

export function PauseMenu() {
  const { t, setOverlay, playStage, stageId, go, settings, updateSettings, lang, setLang } = useGame();
  const T = t();
  return (
    <div className="modal-backdrop">
      <div className="modal pause">
        <h2>⏸ {T.paused}</h2>
        <Btn className="big" onClick={() => setOverlay(null)}>▶ {T.resume}</Btn>
        <Btn kind="secondary" onClick={() => playStage(stageId)}>↻ {T.restart}</Btn>
        <Btn kind="secondary" onClick={() => setOverlay('instructions')}>❔ {T.instructions}</Btn>
        <Btn kind="secondary" onClick={() => go('map')}>🗺️ {T.exitToMap}</Btn>
        <div className="volume">
          <label>{T.sound} <Btn kind="chip" onClick={() => updateSettings({ muted: !settings.muted })}>{settings.muted ? T.off : T.on}</Btn></label>
          <label>🎵 {T.music}<input type="range" min="0" max="1" step="0.05" value={settings.music} onChange={(e) => updateSettings({ music: +e.target.value })} /></label>
          <label>🔔 {T.effects}<input type="range" min="0" max="1" step="0.05" value={settings.sfx} onChange={(e) => updateSettings({ sfx: +e.target.value })} /></label>
          <label>🌐 <Btn kind="chip" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>{T.language}</Btn></label>
        </div>
      </div>
    </div>
  );
}

export function GameOver() {
  const { gameOver, setGameOver, t, go } = useGame();
  const T = t();
  if (!gameOver) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal small center">
        <div className="emoji-big">💫</div>
        <h2>{T.oops}</h2>
        <p>{T.outOfHearts}</p>
        <Btn className="big" onClick={() => { respawn(session.world, true); setGameOver(false); }}>↻ {T.tryFromCheckpoint}</Btn>
        <Btn kind="ghost" onClick={() => { setGameOver(false); go('map'); }}>🗺️ {T.exitToMap}</Btn>
      </div>
    </div>
  );
}

export function Results() {
  const { results, t, lang, playStage, go, profile } = useGame();
  const T = t();
  if (!results) return null;
  const tt = totals(profile);
  const msg = T.motivation[(results.stageId + results.run.coins) % T.motivation.length];
  if (results.final) {
    return (
      <div className="modal-backdrop champion-bg">
        <div className="confetti" aria-hidden>{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div>
        <div className="modal champion">
          <div className="emoji-big">🏆🇴🇲🕰️</div>
          <h1 className="champ-en" dir="ltr">YOU ARE AN OMAN ENGLISH CHAMPION!</h1>
          <h2 className="champ-ar" dir="rtl">أنتِ بطلة تحدي اللغة الإنجليزية!</h2>
          <p className="champ-name">{profile.name}</p>
          <div className="result-stats"><span>🪙 {tt.coins}</span><span>⭐ {tt.stars}</span><span>📘 {tt.correct}/50</span><span>🏁 {tt.stagesCompleted}/10</span></div>
          <Btn kind="gold" className="big" onClick={() => go('certificate')}>📜 {T.certificate}</Btn>
          <Btn kind="secondary" onClick={() => go('map')}>🗺️ {T.backToMap}</Btn>
          <p className="signature dark" dir="ltr">Created by Ms. Jawaher Alkhusaibi</p>
        </div>
      </div>
    );
  }
  const next = results.stageId + 1;
  return (
    <div className="modal-backdrop">
      <div className="modal results center">
        <div className="emoji-big">🎉</div>
        <h2>{T.stageClear}</h2>
        <p className="motivation">{msg}</p>
        {results.rating && (
          <div className="rating-box">
            <StarRating n={results.rating.stars} big />
            <ul className="rating-list">
              <li className="ok">✓ {T.rateComplete}</li>
              <li className={results.rating.grammar ? 'ok' : ''}>{results.rating.grammar ? '✓' : '○'} {T.rateGrammar}</li>
              <li className={results.rating.allStars ? 'ok' : ''}>{results.rating.allStars ? '✓' : '○'} {T.rateStars(results.run.stars, results.run.totalStars)}</li>
            </ul>
            <p className="small">{T.knowledgeEarned(questionsForStage(results.stageId).filter((q) => profile.answers[q.id]?.star).length)}</p>
          </div>
        )}
        {rewardsReady(profile).length > 0 && <p className="chest-ready">{T.chestReady}</p>}
        <div className="result-stats">
          <span>🪙 +{results.run.coins}</span><span>⭐ +{results.run.stars}</span>
          <span>📘 {questionsForStage(results.stageId).filter((q) => profile.answers[q.id]?.rewarded).length}/5 ✓</span>
        </div>
        <p className="total">{T.score}: <b>{tt.score}</b></p>
        {results.badges.length > 0 && (
          <div className="new-badges">
            <h3>🏅 {T.newBadge}</h3>
            {results.badges.map((b) => { const d = BADGES.find((x) => x.id === b); return <div key={b} className="badge-pop">{d.icon} {lang === 'ar' ? d.ar : d.en}</div>; })}
          </div>
        )}
        {next <= TOTAL_STAGES && <Btn className="big" onClick={() => playStage(next)}>▶ {T.nextStage}</Btn>}
        <Btn kind="secondary" onClick={() => go('map')}>🗺️ {T.backToMap}</Btn>
      </div>
    </div>
  );
}
