import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useGame } from '../game/store.js';
import { WORDS, WORD_BY_ID, withArticle } from '../game/words.js';
import { buildWordHunter, buildClues, buildQuiz, buildTreasure, treasureReplacement, shuffle, starsFor } from '../game/questions.js';
import { sfx, speak, duckMusic } from '../game/audio.js';
import { input } from '../game/input.js';
import { Panel, Choice, PictureCard, Joystick, JumpButton } from '../ui/Common.jsx';

const W = (id) => WORD_BY_ID[id].word;
const PRAISE = ['Great job!', 'Excellent!', 'Well done!', 'Super!', 'Fantastic!', 'You are a star!', 'Brilliant!'];
const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

/** Shared bookkeeping for question-based levels. */
function useScoring() {
  const answerCorrect = useGame((s) => s.answerCorrect);
  const answerWrong = useGame((s) => s.answerWrong);
  const celebrate = useGame((s) => s.celebrate);
  const firstTry = useRef(0);
  return {
    firstTry,
    right(wasFirst) { answerCorrect(); sfx.correct(); celebrate(); if (wasFirst) firstTry.current += 1; },
    wrong() { answerWrong(); sfx.wrong(); },
  };
}

/* =============== LEVEL 1 – WORD HUNTER =============== */
export function Level1() {
  const rounds = useMemo(() => buildWordHunter(), []);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState([]);
  const [done, setDone] = useState(false);
  const [collected, setCollected] = useState([]);
  const { setStage, say, finishLevel } = useGame.getState();
  const score = useScoring();
  const r = rounds[i];

  useEffect(() => {
    setStage({ building: r.target, mood: 'idle' });
    say(i === 0 ? 'Look! This place lost its name. Tap the right word to collect it!' : 'Which word matches this place?', 'talk');
    setPicked([]); setDone(false);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id) => {
    if (done || picked.includes(id)) return;
    if (id === r.target) {
      score.right(picked.length === 0);
      setDone(true);
      setCollected((c) => [...c, id]);
      say(`${praise()} It's ${withArticle(id)}!`, 'happy');
      speak(W(id));
      setTimeout(() => {
        if (i + 1 >= rounds.length) finishLevel(1, score.firstTry.current, rounds.length);
        else setI(i + 1);
      }, 1700);
    } else {
      score.wrong();
      setPicked((p) => [...p, id]);
      say(`Oops! That's not ${withArticle(id)}. Try again!`, 'sad');
    }
  };

  return (
    <Panel title="Word Hunter" icon="🔎" step={i} total={rounds.length}>
      <div className="q-row">
        <PictureCard id={r.target} />
        <div className="q-side">
          <p className="prompt">What is this place?</p>
          <div className="options two">
            {r.options.map((id) => (
              <Choice key={id} onClick={() => pick(id)} disabled={done && id !== r.target} state={done && id === r.target ? 'right' : picked.includes(id) ? 'wrong' : ''}>
                {W(id)}
              </Choice>
            ))}
          </div>
        </div>
      </div>
      <div className="collection" aria-label="Words collected">
        {WORDS.map((w) => (
          <span key={w.id} className={`slot ${collected.includes(w.id) ? 'got' : ''}`} title={collected.includes(w.id) ? w.word : '?'}>
            {collected.includes(w.id) ? w.emoji : '?'}
          </span>
        ))}
      </div>
    </Panel>
  );
}

/* =============== LEVEL 2 – GUESS THE PLACE =============== */
export function Level2() {
  const rounds = useMemo(() => buildClues(), []);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState([]);
  const [done, setDone] = useState(false);
  const { setStage, say, finishLevel } = useGame.getState();
  const score = useScoring();
  const r = rounds[i];

  useEffect(() => {
    setStage({ building: null, mood: 'idle' });
    say(`Clue: ${r.clue}`, 'talk');
    speak(r.clue);
    setPicked([]); setDone(false);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id) => {
    if (done || picked.includes(id)) return;
    if (id === r.target) {
      score.right(picked.length === 0);
      setDone(true);
      setStage({ building: id });
      say(`Yes! It's ${withArticle(id)}! ${praise()}`, 'happy');
      speak(`Yes! It's ${withArticle(id)}!`);
      setTimeout(() => {
        if (i + 1 >= rounds.length) finishLevel(2, score.firstTry.current, rounds.length);
        else setI(i + 1);
      }, 2200);
    } else {
      score.wrong();
      setPicked((p) => [...p, id]);
      say(`Hmm, not ${withArticle(id)}. Listen again: ${r.clue}`, 'sad');
    }
  };

  return (
    <Panel title="Guess the Place" icon="🐻" step={i} total={rounds.length}>
      <div className="clue-box">
        <span>🐻 Bear&apos;s clue:</span>
        <p>“{r.clue}”</p>
        <button type="button" className="mini-btn" onClick={() => speak(r.clue)} aria-label="Hear the clue">🔊 Listen</button>
      </div>
      <div className="options">
        {r.options.map((id) => (
          <Choice key={id} onClick={() => pick(id)} disabled={done && id !== r.target} state={done && id === r.target ? 'right' : picked.includes(id) ? 'wrong' : ''}>
            <span className="opt-emoji">{WORD_BY_ID[id].emoji}</span> {W(id)}
          </Choice>
        ))}
      </div>
    </Panel>
  );
}

/* =============== LEVEL 3 – CITY EXPLORER =============== */
const CITY_TARGETS = 6;

export function Level3() {
  const targets = useMemo(() => shuffle(WORDS.map((w) => w.id)).slice(0, CITY_TARGETS), []);
  const [i, setI] = useState(0);
  const [started, setStarted] = useState(false);
  const visit = useGame((s) => s.city.visit);
  const hint = useGame((s) => s.city.hint);
  const coinsTaken = useGame((s) => s.city.coinsTaken);
  const { setCity, say, finishLevel } = useGame.getState();
  const score = useScoring();
  const wrongForTarget = useRef(false);
  const busy = useRef(false);
  const target = targets[i];

  useEffect(() => {
    setCity({ target: null, found: [], coinsTaken: [], hint: false, visit: null, playing: false });
    say('This is WOW CITY! Walk with the girl and find the places I ask for. Collect golden coins for stars!', 'talk');
    const down = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space') input.jump = true; else input.keys.add(e.code);
    };
    const up = (e) => input.keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      input.keys.clear(); input.jx = 0; input.jy = 0;
      setCity({ playing: false, target: null, hint: false });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = useCallback((id) => {
    const text = `Can you find the ${W(id).toLowerCase()}?`;
    say(`${text} ${WORD_BY_ID[id].emoji}`, 'talk');
    speak(text);
  }, [say]);

  const begin = () => {
    sfx.whoosh();
    setStarted(true);
    setCity({ playing: true, target });
    ask(target);
  };

  useEffect(() => {
    if (!visit || !started || busy.current) return;
    if (visit.id === target) {
      busy.current = true;
      score.right(!wrongForTarget.current);
      const found = [...useGame.getState().city.found, target];
      setCity({ found, hint: false });
      say(`${praise()} You found the ${W(target).toLowerCase()}! Its name is back!`, 'happy');
      speak(`You found the ${W(target).toLowerCase()}!`);
      setTimeout(() => {
        busy.current = false;
        wrongForTarget.current = false;
        if (i + 1 >= targets.length) {
          const coins = useGame.getState().city.coinsTaken.length;
          finishLevel(3, score.firstTry.current, targets.length, coins >= 10 ? 3 : coins >= 5 ? 2 : 1);
        } else {
          setI(i + 1);
          setCity({ target: targets[i + 1] });
          ask(targets[i + 1]);
        }
      }, 2200);
    } else {
      wrongForTarget.current = true;
      sfx.wrong();
      say(`This is ${withArticle(visit.id)}. Find the ${W(target).toLowerCase()}!`, 'sad');
    }
  }, [visit]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!started) {
    return (
      <Panel title="City Explorer" icon="🗺️">
        <div className="howto">
          <p><b>Move:</b> joystick 🕹️ or arrow keys / W A S D</p>
          <p><b>Jump:</b> JUMP button or Space bar</p>
          <p><b>Find</b> {CITY_TARGETS} places. Walk up to the building to check its sign.</p>
          <p><b>Collect</b> golden coins 🪙: 5 coins = ⭐⭐, 10 coins = ⭐⭐⭐</p>
        </div>
        <button type="button" className="btn gold big" onClick={begin}>Let&apos;s explore! ▶</button>
      </Panel>
    );
  }

  return (
    <>
      <div className="city-task slide-down">
        <span className="find">Find: <b>{WORD_BY_ID[target].emoji} {W(target)}</b></span>
        <span className="found">✔ {i}/{targets.length} · 🪙 {coinsTaken.length}</span>
        <button type="button" className={`mini-btn ${hint ? 'on' : ''}`} onClick={() => { sfx.click(); setCity({ hint: !hint }); }}>🧭 {hint ? 'Hide' : 'Show'} the way</button>
        <button type="button" className="mini-btn" onClick={() => ask(target)}>🔊</button>
      </div>
      <Joystick />
      <JumpButton />
    </>
  );
}

/* =============== LEVEL 4 – THE MYSTERY QUIZ =============== */
const TYPE_LABEL = { choice: 'Multiple choice', picture: 'Picture identification', truefalse: 'True or False', complete: 'Complete the sentence', match: 'Word matching' };

function MatchQuestion({ q, onDone }) {
  const [sel, setSel] = useState(null);
  const [matched, setMatched] = useState([]);
  const [bad, setBad] = useState(null);
  const mistakes = useRef(0);
  const tryPair = (pic, word) => {
    if (pic === word) {
      sfx.coin();
      const m = [...matched, pic];
      setMatched(m); setSel(null);
      speak(W(word));
      if (m.length === q.pairs.length) onDone(mistakes.current === 0);
    } else {
      mistakes.current += 1;
      sfx.wrong();
      setBad(word); setTimeout(() => setBad(null), 500);
      setSel(null);
    }
  };
  return (
    <div className="match">
      <p className="hint-text">Tap a picture, then tap its word.</p>
      <div className="match-grid">
        <div className="col">
          {q.pairs.map((id) => (
            <button type="button" key={id} className={`match-pic ${sel === id ? 'sel' : ''} ${matched.includes(id) ? 'ok' : ''}`} disabled={matched.includes(id)} onClick={() => { sfx.click(); setSel(id); }}>
              <span>{WORD_BY_ID[id].emoji}</span>
            </button>
          ))}
        </div>
        <div className="col">
          {q.words.map((id) => (
            <button type="button" key={id} className={`match-word ${matched.includes(id) ? 'ok' : ''} ${bad === id ? 'shake wrong' : ''}`} disabled={matched.includes(id) || !sel} onClick={() => tryPair(sel, id)}>
              {W(id)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Level4() {
  const quiz = useMemo(() => buildQuiz(), []);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState(null);
  const { setStage, say, finishLevel } = useGame.getState();
  const score = useScoring();
  const q = quiz[i];

  useEffect(() => {
    setAnswer(null);
    const showPic = q.type === 'picture' || q.type === 'truefalse';
    setStage({ building: showPic ? q.picture : null, mood: 'idle' });
    say(`Question ${i + 1}: ${TYPE_LABEL[q.type]}!`, 'talk');
    if (q.type === 'choice' || q.type === 'truefalse') speak(q.prompt);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = (delay) => setTimeout(() => {
    if (i + 1 >= quiz.length) finishLevel(4, score.firstTry.current, quiz.length);
    else setI(i + 1);
  }, delay);

  const choose = (opt) => {
    if (answer) return;
    setAnswer(opt);
    setStage({ building: q.target });
    if (opt === q.answer) {
      score.right(true);
      say(praise(), 'happy');
      next(1500);
    } else {
      score.wrong();
      const right = q.type === 'truefalse' ? `It's ${q.answer.toUpperCase()}. This is ${withArticle(q.target)}.` : `The answer is: ${W(q.answer)}.`;
      say(`Not this time. ${right}`, 'sad');
      next(2600);
    }
  };

  const matchDone = (perfect) => {
    setAnswer('all');
    score.right(perfect);
    say(perfect ? `Perfect matching! ${praise()}` : 'All matched! Well done!', 'happy');
    next(1600);
  };

  const filled = (s) => {
    const [a, b] = s.split('___');
    return <p className="sentence">{a}<span className={`blank ${answer ? 'filled' : ''}`}>{answer ? W(q.answer).toLowerCase() : '______'}</span>{b}</p>;
  };

  const state = (opt) => {
    if (!answer) return '';
    if (opt === q.answer) return 'right';
    if (opt === answer) return 'wrong';
    return 'dim';
  };

  return (
    <Panel title="The Mystery Quiz" icon="❓" step={i} total={quiz.length} key={i}>
      <p className="qtype">{TYPE_LABEL[q.type]}</p>
      {q.type === 'match' ? <MatchQuestion q={q} onDone={matchDone} /> : (
        <div className="q-row">
          {(q.type === 'picture' || q.type === 'truefalse') && <PictureCard id={q.picture} size="md" />}
          <div className="q-side">
            <p className="prompt">{q.prompt}</p>
            {q.type === 'complete' && filled(q.sentence)}
            <div className={`options ${q.type === 'truefalse' ? 'tf' : 'two'}`}>
              {q.options.map((opt) => (
                <Choice key={opt} onClick={() => choose(opt)} state={state(opt)} disabled={!!answer}>
                  {q.type === 'truefalse' ? (opt === 'true' ? '✔ True' : '✘ False') : W(opt)}
                </Choice>
              ))}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* =============== LEVEL 5 – SPEAKING ADVENTURE =============== */
const SPEAK_QS = [
  { q: 'What is this place?', help: (id) => `This is ${withArticle(id)}.` },
  { q: 'Have you visited this place?', help: (id) => `Yes, I have. I visited ${withArticle(id)} with my family. / No, I haven't.` },
  { q: 'What can people do there?', help: (id) => WORD_BY_ID[id].example },
];
const PLACES_TO_TALK = 3;

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'];
  return types.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

function useRecorder() {
  const rec = useRef(null);
  const timer = useRef(null);
  const [recording, setRecording] = useState(null); // key being recorded
  const [error, setError] = useState(null);
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
  }, []);

  const start = useCallback(async (key, onDone) => {
    if (!supported) { setError('unsupported'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        duckMusic(false);
        setRecording(null);
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        if (blob.size > 0) onDone(URL.createObjectURL(blob));
      };
      rec.current = mr;
      duckMusic(true);
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      mr.start();
      setRecording(key);
      setError(null);
      timer.current = setTimeout(() => stop(), 20000);
    } catch {
      setError('denied');
      duckMusic(false);
    }
  }, [supported, stop]);

  useEffect(() => () => stop(), [stop]);
  return { start, stop, recording, error, supported };
}

export function Level5() {
  const places = useMemo(() => shuffle(WORDS.map((w) => w.id)).slice(0, PLACES_TO_TALK), []);
  const [p, setP] = useState(0);
  const [clips, setClips] = useState({}); // "place:q" -> url
  const [aloud, setAloud] = useState({}); // fallback when there is no microphone
  const [help, setHelp] = useState(null);
  const [review, setReview] = useState(false);
  const { setStage, say, finishLevel, answerCorrect, celebrate } = useGame.getState();
  const recorder = useRecorder();
  const audio = useRef(null);
  const place = places[p];

  useEffect(() => {
    setStage({ building: place, mood: 'idle' });
    say(p === 0 ? 'Let\'s talk! Press 🎤 to record your answer, then ▶ to listen to yourself.' : 'Here is a new place. Answer the 3 questions!', 'talk');
    setHelp(null);
  }, [p]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => Object.values(clips).forEach((u) => URL.revokeObjectURL(u)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const key = (qi) => `${place}:${qi}`;
  const answered = (qi) => !!clips[key(qi)] || !!aloud[key(qi)];
  const allDone = SPEAK_QS.every((_, qi) => answered(qi));

  const credit = (k) => {
    if (!clips[k] && !aloud[k]) {
      answerCorrect();
      sfx.correct();
      celebrate();
      say(praise(), 'happy');
    }
  };

  const record = (qi) => {
    const k = key(qi);
    if (recorder.recording === k) { recorder.stop(); return; }
    if (recorder.recording) return;
    sfx.click();
    recorder.start(k, (url) => {
      credit(k);
      setClips((c) => {
        if (c[k]) URL.revokeObjectURL(c[k]);
        return { ...c, [k]: url };
      });
    });
  };

  const play = (url) => {
    if (audio.current) audio.current.pause();
    audio.current = new Audio(url);
    audio.current.play().catch(() => {});
  };

  const nextPlace = () => {
    sfx.whoosh();
    if (p + 1 >= places.length) {
      setReview(true);
      say('Wonderful speaking! Listen to all your recordings.', 'happy');
    } else setP(p + 1);
  };

  if (review) {
    return (
      <Panel title="Speaking Adventure" icon="🎤">
        <p className="prompt">🎧 My recordings</p>
        <div className="review">
          {places.map((id) => (
            <div key={id} className="review-row">
              <span className="tag">{WORD_BY_ID[id].emoji} {W(id)}</span>
              {SPEAK_QS.map((s, qi) => (clips[`${id}:${qi}`]
                ? <button type="button" key={qi} className="mini-btn" onClick={() => play(clips[`${id}:${qi}`])}>▶ {qi + 1}</button>
                : <span key={qi} className="mini-tag">🗣️ {qi + 1}</span>))}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn gold big"
          onClick={() => {
            const total = places.length * SPEAK_QS.length;
            const recorded = Object.keys(clips).length;
            finishLevel(5, recorded + Object.keys(aloud).filter((k) => !clips[k]).length, total, recorded >= total * 0.6 || !recorder.supported || recorder.error ? 3 : 2);
          }}
        >
          Finish mission ✔
        </button>
      </Panel>
    );
  }

  return (
    <Panel title="Speaking Adventure" icon="🎤" step={p} total={places.length}>
      <div className="speak-head">
        <PictureCard id={place} size="sm" />
        <p className="prompt">Look at the place and answer out loud!</p>
      </div>
      {(recorder.error || !recorder.supported) && (
        <p className="warn">🎙️ The microphone is not available{recorder.error === 'denied' ? ' (permission was not given)' : ''}. You can still answer out loud and tap “I said it”.</p>
      )}
      <div className="speak-list">
        {SPEAK_QS.map((s, qi) => {
          const k = key(qi);
          const rec = recorder.recording === k;
          return (
            <div key={qi} className={`speak-q ${answered(qi) ? 'ok' : ''}`}>
              <div className="speak-text">
                <b>{qi + 1}. {s.q}</b>
                {help === qi && <span className="help">💡 {s.help(place)}</span>}
              </div>
              <div className="speak-btns">
                <button type="button" className="mini-btn" onClick={() => speak(s.q)} aria-label="Hear the question">🔊</button>
                <button type="button" className="mini-btn" onClick={() => { setHelp(help === qi ? null : qi); if (help !== qi) speak(s.help(place).split(' / ')[0]); }} aria-label="Example answer">💡</button>
                {recorder.supported && !recorder.error ? (
                  <button type="button" className={`rec-btn ${rec ? 'recording' : ''}`} onClick={() => record(qi)} disabled={!!recorder.recording && !rec}>
                    {rec ? '⏹ Stop' : clips[k] ? '🎤 Again' : '🎤 Record'}
                  </button>
                ) : (
                  <button type="button" className="rec-btn" disabled={!!aloud[k]} onClick={() => { credit(k); setAloud((a) => ({ ...a, [k]: true })); }}>
                    {aloud[k] ? '✔ Said it' : '🗣️ I said it'}
                  </button>
                )}
                {clips[k] && <button type="button" className="mini-btn play" onClick={() => play(clips[k])}>▶ Play</button>}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn gold" disabled={!allDone || !!recorder.recording} onClick={nextPlace}>
        {allDone ? (p + 1 >= places.length ? 'Listen to my recordings ▶' : 'Next place ▶') : 'Answer all 3 questions'}
      </button>
    </Panel>
  );
}

/* =============== LEVEL 6 – THE GOLDEN TREASURE =============== */
export function Level6() {
  const initial = useMemo(() => buildTreasure(), []);
  const [qs, setQs] = useState(initial);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [keys, setKeys] = useState(0);
  const [opened, setOpened] = useState(false);
  const { setStage, say, finishLevel, celebrate } = useGame.getState();
  const score = useScoring();
  const firstAttempts = useRef(0);
  const q = qs[i];

  useEffect(() => {
    setStage({ keys: 0, open: false, mood: 'idle' });
    say('The golden treasure chest is locked! Answer 5 questions to win 5 golden keys. 🗝️', 'talk');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setAnswer(null); if (q && i > 0) say(`Key ${i + 1}: ${q.type === 'clue' ? 'Guess the place!' : 'Complete the sentence!'}`, 'talk'); }, [i, qs]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (opt) => {
    if (answer) return;
    setAnswer(opt);
    firstAttempts.current += 1;
    if (opt === q.answer) {
      score.right(true);
      sfx.key();
      const k = keys + 1;
      setKeys(k);
      setStage({ keys: k });
      say(k === 5 ? 'You have all 5 golden keys! Open the treasure chest!' : `You won golden key number ${k}! 🗝️`, 'happy');
      if (k < 5) setTimeout(() => setI(i + 1), 1500);
    } else {
      score.wrong();
      say(`Not quite! It was ${withArticle(q.answer)}. Try a new question for this key.`, 'sad');
      setTimeout(() => {
        setQs((all) => {
          const copy = [...all];
          copy[i] = treasureReplacement(all.map((x) => x.target));
          return copy;
        });
      }, 2400);
    }
  };

  const openChest = () => {
    setOpened(true);
    setStage({ open: true, mood: 'happy' });
    sfx.fanfare();
    celebrate();
    say('WOW! The treasure is open! You are a WOW CITY champion!', 'happy');
    speak('Wow! The treasure is open!');
    setTimeout(() => celebrate(), 1200);
    setTimeout(() => finishLevel(6, score.firstTry.current, firstAttempts.current, starsFor(score.firstTry.current, firstAttempts.current)), 4200);
  };

  const state = (opt) => {
    if (!answer) return '';
    if (opt === q.answer) return 'right';
    if (opt === answer) return 'wrong';
    return 'dim';
  };

  return (
    <Panel title="The Golden Treasure" icon="🗝️" step={keys} total={5}>
      <div className="keys-row" aria-label={`${keys} of 5 keys`}>
        {[0, 1, 2, 3, 4].map((k) => <span key={k} className={`key ${k < keys ? 'got' : ''}`}>🗝️</span>)}
      </div>
      {keys < 5 ? (
        <div key={`${i}-${q.target}`} className="fade-in">
          <p className="prompt">{q.type === 'clue' ? `🐻 “${q.prompt}”` : q.prompt}</p>
          {q.type === 'complete' && (() => {
            const [a, b] = q.sentence.split('___');
            return <p className="sentence">{a}<span className={`blank ${answer ? 'filled' : ''}`}>{answer ? W(q.answer).toLowerCase() : '______'}</span>{b}</p>;
          })()}
          <div className="options two">
            {q.options.map((opt) => (
              <Choice key={opt} onClick={() => choose(opt)} state={state(opt)} disabled={!!answer}>
                <span className="opt-emoji">{WORD_BY_ID[opt].emoji}</span> {W(opt)}
              </Choice>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" className="btn gold big glow" disabled={opened} onClick={openChest}>
          {opened ? '✨ Opening… ✨' : '🔓 Open the Treasure Chest!'}
        </button>
      )}
    </Panel>
  );
}

export function LevelRouter() {
  const level = useGame((s) => s.level);
  const Comp = { 1: Level1, 2: Level2, 3: Level3, 4: Level4, 5: Level5, 6: Level6 }[level];
  return Comp ? <Comp key={level} /> : null;
}
