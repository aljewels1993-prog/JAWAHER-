import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../game/store.js';
import { QUESTION_BY_ID } from '../data/questions.js';
import { completeQuestion, closeQuestion } from '../game/sim.js';
import { session } from '../game/session.js';
import { releaseAll } from '../game/input.js';
import { speak, sfx, heroSay } from '../game/audio.js';
import { line, encourageNow } from '../game/lines.js';
import heroImg from '../assets/hero-full.png';
import { Btn } from './Screens.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

/** The hero inside the panel, saying her line with a happy / sad / calm look. */
function HeroSays({ ln, lang }) {
  if (!ln) return null;
  return (
    <div className={`hero-says mood-${ln.mood}`} key={ln.en}>
      <img src={heroImg} alt="" />
      <span className="hero-says-bubble">{lang === 'ar' ? ln.ar : ln.en}</span>
    </div>
  );
}
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

/** The sentence with the gap, optionally highlighting the key words (2nd-level hint). */
function Prompt({ q, highlight, filled }) {
  const text = filled ? q.prompt.replace(/_{3,}/, '\u0000') : q.prompt;
  const parts = highlight && q.key ? text.split(q.key) : [text];
  const renderGap = (s, k) => s.split('\u0000').map((piece, i) => (
    <span key={`${k}-${i}`}>{i > 0 && <b className="q-fill">{q.options[q.answer]}</b>}{piece}</span>
  ));
  return (
    <h2 className="q-prompt">
      {parts.map((p, i) => (
        <span key={i}>{i > 0 && <mark className="q-key">{q.key}</mark>}{renderGap(p, i)}</span>
      ))}
    </h2>
  );
}

/** The grammar challenge that opens when a purple block is hit. */
export function QuestionPanel() {
  const { question, answer, closeQuestionPanel, t, toast, requestHint, profile, lang } = useGame();
  const [said, setSaid] = useState(null); // the hero's current line { en, ar, mood }
  // Her voice is heard only after a right or a wrong answer.
  const talk = (ln, { voice = true } = {}) => { setSaid(ln); if (voice) heroSay(ln, lang); return ln; };
  const T = t();
  const q = QUESTION_BY_ID[question.questionId];
  const [disabled, setDisabled] = useState([]);
  const [result, setResult] = useState(null); // { correct, reward, revealed, chosen, star, streak }
  const [busy, setBusy] = useState(false);
  const [hintLevel, setHintLevel] = useState(0); // 0 none · 1 clue · 2 clue + key words
  const qIndex = Number(q.id.slice(1));
  const seed = useMemo(() => Math.floor(Math.random() * 1000), []);
  const sentence = q.prompt.replace(/_{3,}/, q.options[q.answer]);
  const alreadyTried = (profile?.answers[q.id]?.attempts || 0) > 0;

  useEffect(() => { releaseAll(); }, []);

  const openHint = async () => {
    sfx.click();
    if (hintLevel === 0 && !alreadyTried) await requestHint(q.id);
    setHintLevel((h) => Math.min(2, h + 1));
  };

  const choose = async (i) => {
    if (busy || result?.done || disabled.includes(i)) return;
    setBusy(true);
    const r = await answer(q.id, i, { usedHint: hintLevel > 0 });
    setBusy(false);
    if (r.correct) {
      if (encourageNow({ streak: r.streak })) talk([5, 10].includes(r.streak) ? line('streak', r.streak) : line('correct'));
      else setSaid(null);
      setResult({ ...r, chosen: i });
    } else if (r.revealed) {
      if (encourageNow()) talk({ ...line('reveal'), mood: 'sad' }); // soft, gentle voice
      else setSaid(null);
      setResult({ ...r, chosen: i });
    } else {
      if (encourageNow()) talk(line('wrong'));
      else setSaid(null);
      setDisabled((d) => [...d, i]);
      setHintLevel(2); // after a mistake: show the clue and the key words, never the answer
      setResult({ ...r, chosen: i, retry: true });
    }
  };

  const finish = () => {
    sfx.click();
    // Tell the hero how it went so she can react in the level.
    // In the level she only moves (cheer / nod); a bubble only if she spoke here.
    session.heroReaction = { type: result?.correct ? 'cheer' : 'learn', text: said ? (lang === 'ar' ? said.ar : said.en) : '', mood: said?.mood };
    if (session.world) completeQuestion(session.world, q.id);
    closeQuestionPanel();
  };
  const later = () => {
    if (session.world) closeQuestion(session.world);
    closeQuestionPanel();
  };

  const done = result && (result.correct || result.revealed);
  return (
    <div className="modal-backdrop question-backdrop">
      <div className={`modal question ${result?.correct ? 'ok' : ''} ${result?.retry ? 'shake' : ''}`} dir="ltr" key={disabled.length}>
        <div className="q-head">
          <span className="q-badge">📘 {q.topic}</span>
          <span className="q-count">Question {qIndex} / 50</span>
        </div>
        <p className="q-instr">{T.chooseAnswer}{T.chooseAnswer !== 'Choose the correct answer:' && <><br /><span className="q-instr-en">Choose the correct answer:</span></>}</p>
        <Prompt q={q} highlight={hintLevel >= 2 && !done} filled={done} />
        <div className="q-tools">
          <Btn kind="chip" className="listen" onClick={() => speak(done ? sentence : q.prompt)}>🔈 {done ? T.hearSentence : T.listen}</Btn>
          {!done && hintLevel < 2 && (
            <Btn kind="chip" className="hint-btn" onClick={openHint}>💡 {hintLevel === 0 ? T.hintBtn : T.hintMore}</Btn>
          )}
        </div>
        {!done && hintLevel > 0 && !result?.retry && (
          <div className="feedback hint">
            <HeroSays ln={said} lang={lang} />
            <p><b>💡 {T.hintBtn}:</b> {q.hint}</p>
            {hintLevel >= 2 && <p className="small">🔎 {T.keyWords}</p>}
            {!alreadyTried && <p className="small">{T.hintCost}</p>}
          </div>
        )}
        <div className="options">
          {q.options.map((opt, i) => {
            const isRight = done && i === q.answer;
            const isWrong = disabled.includes(i) || (result?.revealed && result.chosen === i);
            return (
              <button key={i} type="button" className={`option ${isRight ? 'right' : ''} ${isWrong ? 'wrong' : ''}`}
                disabled={done || disabled.includes(i) || busy} onClick={() => choose(i)}>
                <span className="letter">{LETTERS[i]}</span> {opt}
              </button>
            );
          })}
        </div>
        {result?.correct && (
          <div className="feedback success">
            {said ? <HeroSays ln={said} lang={lang} /> : <div className="fb-title">✓ {T.correctTitle}</div>}
            {result.streak >= 2 && <div className="streak">{T.streak(result.streak)}</div>}
            <div className="reward-row">
              {result.reward ? <span className="reward-chip coin-rain">🪙 {T.plusCoins}</span> : null}
              {result.star ? <span className="reward-chip star-pop">{T.knowledgeStar}</span> : null}
            </div>
            <p className="why"><b>{T.why}</b> {q.explain}</p>
            {!result.star && <p className="small">{T.starTip}</p>}
            <Btn className="big" onClick={finish}>{T.keepPlaying} ▶</Btn>
          </div>
        )}
        {result?.retry && !done && (
          <div className="feedback retry">
            <HeroSays ln={said} lang={lang} />
            <div className="fb-title">{T.notQuite(q.options[result.chosen])}</div>
            <p>{T.oneMoreTry}</p>
            <p><b>💡 {T.hintBtn}:</b> {q.hint}</p>
            <p className="small">🔎 {T.keyWords}</p>
          </div>
        )}
        {result?.revealed && (
          <div className="feedback reveal">
            <HeroSays ln={said} lang={lang} />
            <div className="fb-title">{T.learnTogether}</div>
            <p><b>{T.correctSentence}:</b> {sentence}</p>
            <p className="why"><b>{T.remember}:</b> {q.explain}</p>
            <p className="small">{T.noCoins}</p>
            <Btn className="big" onClick={finish}>{T.keepPlaying} ▶</Btn>
          </div>
        )}
        {!done && <Btn kind="ghost" className="later" onClick={later}>{T.later}</Btn>}
      </div>
    </div>
  );
}
