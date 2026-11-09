import { useEffect, useRef, useState } from 'react';
import { useGame, totalStars, missionsDone } from '../game/store.js';
import { WORD_BY_ID, MISSIONS } from '../game/words.js';
import { sfx, speak, setSoundEnabled } from '../game/audio.js';
import { input } from '../game/input.js';

/** Top bar: student name, points, correct answers, stars, coins, missions, progress. */
export function HUD() {
  const player = useGame((s) => s.player);
  const p = useGame((s) => s.progress);
  const screen = useGame((s) => s.screen);
  const sound = useGame((s) => s.sound);
  const toggleSound = useGame((s) => s.toggleSound);
  const go = useGame((s) => s.go);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const done = missionsDone(p);
  const pct = Math.round((done / MISSIONS.length) * 100);

  useEffect(() => { setSoundEnabled(sound); }, [sound]);

  const fullscreen = () => {
    sfx.click();
    const el = document.documentElement;
    const isFs = document.fullscreenElement || document.webkitFullscreenElement;
    if (isFs) { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); return; }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) req.call(el).catch?.(() => showTip());
    else showTip();
  };
  const showTip = () => {
    setToast('On iPhone: tap Share ⬆️ then "Add to Home Screen" to play full screen.');
    setTimeout(() => setToast(null), 5000);
  };

  return (
    <>
      <div className="hud">
        <div className="hud-left">
          <div className="chip name">👧 <b>{player}</b></div>
          <div className="chip" title="Total points">🏅 <b>{p.points}</b><span className="lbl">points</span></div>
          <div className="chip" title="Correct answers">✅ <b>{p.correct}</b><span className="lbl">correct</span></div>
          <div className="chip" title="Stars collected">⭐ <b>{totalStars(p)}</b><span className="lbl">/18</span></div>
          <div className="chip" title="Golden coins">🪙 <b>{p.coins}</b></div>
          <div className="chip progress-chip" title="Completed missions">
            <span>🏁 <b>{done}</b>/6</span>
            <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
          </div>
          {p.trophy && <div className="chip trophy" title="Golden Trophy">🏆</div>}
        </div>
        <div className="hud-right">
          {screen !== 'hub' && <button type="button" className="icon-btn" aria-label="City map" title="City map" onClick={() => { sfx.click(); go('hub'); }}>🏠</button>}
          <button type="button" className="icon-btn" aria-label="Sound on or off" title="Sound on/off" onClick={() => { toggleSound(); sfx.click(); }}>{sound ? '🔊' : '🔇'}</button>
          <button type="button" className="icon-btn" aria-label="Full screen" title="Full screen" onClick={fullscreen}>⛶</button>
          <button type="button" className="icon-btn" aria-label="Restart game" title="Restart" onClick={() => { sfx.click(); setConfirm(true); }}>🔄</button>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
      {confirm && (
        <Modal>
          <h2>Start again?</h2>
          <p>This resets <b>{player}</b>&apos;s points, stars and missions.</p>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>No, keep playing</button>
            <button type="button" className="btn pink" onClick={() => { setConfirm(false); useGame.getState().restart(); }}>Yes, restart</button>
          </div>
          <button type="button" className="link-btn" onClick={() => { setConfirm(false); useGame.getState().logout(); }}>Change player</button>
        </Modal>
      )}
    </>
  );
}

export function Modal({ children, wide = false }) {
  return (
    <div className="modal-back">
      <div className={`modal pop ${wide ? 'wide' : ''}`}>{children}</div>
    </div>
  );
}

/** Bear's animated speech bubble. */
export function BearBubble() {
  const bubble = useGame((s) => s.bubble);
  if (!bubble) return null;
  return (
    <div className="bubble-wrap" key={bubble.at}>
      <div className="bubble pop">
        <span className="bubble-face">🐻</span>
        <span className="bubble-text">{bubble.text}</span>
        <button type="button" className="mini-btn" aria-label="Read aloud" onClick={() => speak(bubble.text)}>🔊</button>
      </div>
    </div>
  );
}

/** Big picture card for a place (emoji art on a coloured tile). */
export function PictureCard({ id, size = 'lg', label = false }) {
  const w = WORD_BY_ID[id];
  return (
    <div className={`pic ${size}`} style={{ '--c': w.color }}>
      <span className="pic-emoji" role="img" aria-label={label ? w.word : 'picture of a place'}>{w.emoji}</span>
      {label && <span className="pic-label">{w.word}</span>}
    </div>
  );
}

/** Answer button with correct / wrong feedback states. */
export function Choice({ children, state, onClick, disabled }) {
  return (
    <button type="button" className={`choice ${state || ''}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function Panel({ title, icon, step, total, children, className = '' }) {
  return (
    <div className={`panel slide-up ${className}`}>
      <div className="panel-head">
        <span className="panel-title">{icon} {title}</span>
        {total ? (
          <span className="dots" aria-label={`Question ${step + 1} of ${total}`}>
            <span className="count">{Math.min(step + 1, total)}/{total}</span>
            <span className="mini-bar"><span style={{ width: `${(step / total) * 100}%` }} /></span>
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** On-screen joystick that writes into the shared input object. Works with touch and mouse. */
export function Joystick() {
  const base = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(null);

  const update = (e) => {
    const r = base.current.getBoundingClientRect();
    const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
    let dx = e.clientX - cx; let dy = e.clientY - cy;
    const max = r.width / 2 - 18;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    setKnob({ x: dx, y: dy });
    input.jx = dx / max; input.jy = dy / max;
  };
  const end = () => { active.current = null; setKnob({ x: 0, y: 0 }); input.jx = 0; input.jy = 0; };
  useEffect(() => end, []);

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => { active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); update(e); }}
      onPointerMove={(e) => { if (active.current === e.pointerId) update(e); }}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Move joystick"
    >
      <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

export function JumpButton() {
  return (
    <button
      type="button"
      className="jump-btn"
      onPointerDown={(e) => { e.preventDefault(); input.jump = true; }}
      aria-label="Jump"
    >
      ⤒<span>JUMP</span>
    </button>
  );
}
