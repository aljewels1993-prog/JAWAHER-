import { useEffect, useState } from 'react';
import { useGame, totalStars, missionsDone, isUnlocked, restoredIds } from '../game/store.js';
import { MISSIONS, WORD_BY_ID, SCORING } from '../game/words.js';
import { initAudio, sfx, speak } from '../game/audio.js';
import { Modal } from './Common.jsx';

export function StartScreen() {
  const profiles = useGame((s) => s.profiles);
  const login = useGame((s) => s.login);
  const go = useGame((s) => s.go);
  const [name, setName] = useState('');
  const names = Object.keys(profiles);

  const start = (n) => {
    const clean = n.trim();
    if (!clean) return;
    initAudio();
    sfx.correct();
    const returning = !!profiles[clean];
    login(clean);
    go(returning ? 'hub' : 'story');
  };

  return (
    <div className="start">
      <div className="logo pop">
        <div className="logo-bear">🐻</div>
        <h1>WOW CITY</h1>
        <p className="subtitle">The Great Places Adventure</p>
      </div>
      <form className="card start-card slide-up" onSubmit={(e) => { e.preventDefault(); start(name); }}>
        <label htmlFor="name">What is your name?</label>
        <input
          id="name"
          value={name}
          maxLength={20}
          autoComplete="off"
          placeholder="Type your name…"
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn gold big" disabled={!name.trim()}>Start the Adventure ▶</button>
        {names.length > 0 && (
          <div className="saved">
            <p>Continue playing as:</p>
            <div className="saved-list">
              {names.map((n) => (
                <button type="button" key={n} className="btn small" onClick={() => start(n)}>
                  👧 {n} · {profiles[n].points} pts
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="tiny">Grade 6 English · Unit 3: Places</p>
      </form>
    </div>
  );
}

const STORY = [
  { text: 'Hello, {name}! I am Bear. Welcome to WOW CITY! 🎉', mood: 'happy' },
  { text: 'Oh no! Look! All the names of the buildings have disappeared!', mood: 'sad' },
  { text: 'Let\'s complete 6 missions together to bring the names back and unlock the GOLDEN TREASURE!', mood: 'talk' },
];

export function StoryScreen() {
  const player = useGame((s) => s.player);
  const go = useGame((s) => s.go);
  const say = useGame((s) => s.say);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = STORY[i].text.replace('{name}', player);
    say(t, STORY[i].mood);
    speak(t.replace(/[🎉]/g, ''));
  }, [i, player, say]);
  return (
    <div className="story-actions slide-up">
      <button
        type="button"
        className="btn gold big"
        onClick={() => {
          sfx.click();
          if (i < STORY.length - 1) setI(i + 1);
          else { say(null); go('hub'); }
        }}
      >
        {i < STORY.length - 1 ? 'Next ▶' : 'Go to the City Map 🗺️'}
      </button>
      <button type="button" className="link-btn light" onClick={() => { say(null); go('hub'); }}>Skip story</button>
    </div>
  );
}

export function HubScreen() {
  const p = useGame((s) => s.progress);
  const player = useGame((s) => s.player);
  const go = useGame((s) => s.go);
  const setStage = useGame((s) => s.setStage);
  const restored = restoredIds(p).length;
  const done = missionsDone(p);
  const next = MISSIONS.find((m) => !p.levels[m.id]);

  const open = (m) => {
    if (!isUnlocked(p, m.id)) { sfx.wrong(); return; }
    initAudio();
    sfx.whoosh();
    setStage({ building: null, mood: 'idle', keys: 0, open: false });
    go('level', m.id);
  };

  return (
    <div className="hub slide-up">
      <div className="hub-head">
        <h2>🗺️ WOW CITY Map</h2>
        <p>
          {done === 6
            ? `Amazing, ${player}! You saved WOW CITY! 🏆`
            : `Names restored: ${restored}/12 · Next: Mission ${next.id} – ${next.title}`}
        </p>
      </div>
      <div className="missions">
        {MISSIONS.map((m) => {
          const lv = p.levels[m.id];
          const unlocked = isUnlocked(p, m.id);
          return (
            <button
              type="button"
              key={m.id}
              className={`mission ${lv ? 'done' : ''} ${unlocked ? '' : 'locked'} ${next?.id === m.id ? 'next' : ''}`}
              onClick={() => open(m)}
              aria-label={`Mission ${m.id}: ${m.title}${unlocked ? '' : ' (locked)'}`}
            >
              <span className="m-icon">{unlocked ? m.icon : '🔒'}</span>
              <span className="m-num">Mission {m.id}</span>
              <span className="m-title">{m.title}</span>
              <span className="m-blurb">{m.blurb}</span>
              <span className="m-stars">{[1, 2, 3].map((s) => <span key={s} className={lv && lv.stars >= s ? 'on' : ''}>★</span>)}</span>
            </button>
          );
        })}
      </div>
      {p.trophy && <button type="button" className="btn gold" onClick={() => go('final')}>🏆 See my Golden Trophy</button>}
    </div>
  );
}

export function CompleteScreen() {
  const r = useGame((s) => s.result);
  const p = useGame((s) => s.progress);
  const go = useGame((s) => s.go);
  const setStage = useGame((s) => s.setStage);
  const celebrate = useGame((s) => s.celebrate);
  const m = MISSIONS.find((x) => x.id === r.levelId);
  const nextM = MISSIONS.find((x) => x.id === r.levelId + 1);

  useEffect(() => {
    setStage({ building: m.restores[0], mood: 'happy' });
    celebrate();
    sfx.fanfare();
    speak(`Mission complete! You restored the names: ${m.restores.map((id) => WORD_BY_ID[id].word).join(' and ')}.`);
    const t = setTimeout(() => setStage({ building: m.restores[1] }), 2600);
    return () => clearTimeout(t);
  }, [m, setStage, celebrate]);

  return (
    <Modal>
      <div className="complete">
        <p className="kicker">Mission {m.id} complete!</p>
        <h2>{m.icon} {m.title}</h2>
        <div className="big-stars">
          {[1, 2, 3].map((s) => <span key={s} className={`star ${r.stars >= s ? 'on' : ''}`} style={{ animationDelay: `${s * 0.25}s` }}>★</span>)}
        </div>
        {r.total > 0 && <p>Correct the first time: <b>{r.firstTry}/{r.total}</b></p>}
        {r.bonus && <p className="bonus">+{SCORING.levelBonus} bonus points! 🎁</p>}
        <div className="restored">
          <p>Names back in the city:</p>
          <div className="row">
            {m.restores.map((id) => <span key={id} className="tag">{WORD_BY_ID[id].emoji} {WORD_BY_ID[id].word}</span>)}
          </div>
        </div>
        <p className="total">Total: <b>{p.points}</b> points · ⭐ {totalStars(p)}</p>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => { sfx.click(); go('hub'); }}>🗺️ City Map</button>
          {r.levelId < 6 && (
            <button type="button" className="btn gold" onClick={() => { sfx.whoosh(); setStage({ building: null, keys: 0, open: false, mood: 'idle' }); go('level', nextM.id); }}>
              Next: {nextM.title} ▶
            </button>
          )}
          {r.levelId === 6 && p.trophy && <button type="button" className="btn gold" onClick={() => go('final')}>🏆 My Golden Trophy</button>}
          {r.levelId === 6 && !p.trophy && (
            <button type="button" className="btn gold" onClick={() => go('hub')}>Finish the other missions to win the trophy!</button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function FinalScreen() {
  const p = useGame((s) => s.progress);
  const player = useGame((s) => s.player);
  const go = useGame((s) => s.go);
  const setStage = useGame((s) => s.setStage);
  const celebrate = useGame((s) => s.celebrate);
  useEffect(() => {
    setStage({ keys: 5, open: true, mood: 'happy' });
    celebrate();
    sfx.fanfare();
    speak(`Congratulations, ${player}! You won the Golden Trophy!`);
    const t = setInterval(() => celebrate(), 5000);
    return () => clearInterval(t);
  }, [player, setStage, celebrate]);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="final slide-up">
      <div className="certificate">
        <div className="cert-trophy">🏆</div>
        <p className="kicker">Golden Trophy Certificate</p>
        <h2>Congratulations, {player}!</h2>
        <p>You brought back all 12 names and saved WOW CITY!</p>
        <div className="cert-stats">
          <div><b>{p.points}</b><span>points</span></div>
          <div><b>{p.correct}</b><span>correct</span></div>
          <div><b>{totalStars(p)}</b><span>stars</span></div>
          <div><b>{p.coins}</b><span>coins</span></div>
        </div>
        <p className="tiny">Grade 6 English · Unit 3: Places · {date}</p>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => go('hub')}>🗺️ City Map</button>
          <button type="button" className="btn pink" onClick={() => window.print()}>🖨️ Print</button>
          <button type="button" className="btn gold" onClick={() => useGame.getState().restart()}>🔄 Play again</button>
        </div>
      </div>
    </div>
  );
}
