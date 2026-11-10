import { useEffect, useState } from 'react';
import { useGame } from '../game/store.js';
import { QUESTION_BY_ID } from '../data/questions.js';
import { completeQuestion, closeQuestion } from '../game/sim.js';
import { session } from '../game/session.js';
import { releaseAll } from '../game/input.js';
import { speak, sfx } from '../game/audio.js';
import { Btn } from './Screens.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

/** The grammar challenge that opens when a purple block is hit. */
export function QuestionPanel() {
  const { question, answer, closeQuestionPanel, t, toast } = useGame();
  const T = t();
  const q = QUESTION_BY_ID[question.questionId];
  const [disabled, setDisabled] = useState([]);
  const [result, setResult] = useState(null); // { correct, reward, revealed, chosen }
  const [busy, setBusy] = useState(false);
  const qIndex = Number(q.id.slice(1));

  useEffect(() => { releaseAll(); }, []);

  const choose = async (i) => {
    if (busy || result?.done || disabled.includes(i)) return;
    setBusy(true);
    const r = await answer(q.id, i);
    setBusy(false);
    if (r.correct) {
      setResult({ ...r, chosen: i });
      if (r.reward) toast(`🪙 ${T.plusCoins}!`, 'coin');
    } else if (r.revealed) {
      setResult({ ...r, chosen: i });
    } else {
      setDisabled((d) => [...d, i]);
      setResult({ ...r, chosen: i, retry: true });
    }
  };

  const finish = () => {
    sfx.click();
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
        <h2 className="q-prompt">{q.prompt}</h2>
        <Btn kind="chip" className="listen" onClick={() => speak(q.prompt)}>🔈 {T.listen}</Btn>
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
            <div className="fb-title">🎉 {T.excellent}</div>
            {result.reward ? <div className="coin-rain">🪙 {T.plusCoins}</div> : null}
            <p>{q.explain}</p>
            <Btn className="big" onClick={finish}>{T.keepPlaying} ▶</Btn>
          </div>
        )}
        {result?.retry && !done && (
          <div className="feedback retry">
            <div className="fb-title">💪 {T.tryAgain}</div>
            <p><b>{T.hint}:</b> {q.hint}</p>
          </div>
        )}
        {result?.revealed && (
          <div className="feedback reveal">
            <div className="fb-title">💡 {T.correctAnswerWas}: {LETTERS[q.answer]}. {q.options[q.answer]}</div>
            <p>{q.explain}</p>
            <p className="small">{T.noCoins}</p>
            <Btn className="big" onClick={finish}>{T.keepPlaying} ▶</Btn>
          </div>
        )}
        {!done && <Btn kind="ghost" className="later" onClick={later}>{T.later}</Btn>}
      </div>
    </div>
  );
}
