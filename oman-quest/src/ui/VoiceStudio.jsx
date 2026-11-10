import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store.js';
import { recordableLines, loadVoices, hasClip, clipUrl, saveClip, deleteClip, exportPack, importPack } from '../game/voiceclips.js';
import { Btn } from './Screens.jsx';

const MAX_SECONDS = 6;
const pickType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
};

/**
 * Teacher tool: record a real child's voice for the hero's lines.
 * Recordings stay on this device; "Download voice pack" makes one file that
 * can be built into the game for every student.
 */
export function VoiceStudio({ onClose }) {
  const { t, lang: uiLang, toast } = useGame();
  const T = t();
  const [lang, setLang] = useState(uiLang);
  const [, setTick] = useState(0);
  const [recording, setRecording] = useState(null); // key being recorded
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState('');
  const rec = useRef(null);
  const timer = useRef(null);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => { loadVoices().then(refresh); }, []);
  useEffect(() => () => { stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = recordableLines(lang);
  const done = lines.filter((l) => hasClip(l.key)).length;

  async function start(key) {
    setErr('');
    if (recording) stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const type = pickType();
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if (chunks.length) {
          await saveClip(key, new Blob(chunks, { type: mr.mimeType || type || 'audio/webm' }));
          refresh();
          play(key);
        }
      };
      rec.current = mr;
      mr.start();
      setRecording(key); setSecs(0);
      const t0 = Date.now();
      timer.current = setInterval(() => {
        const s = (Date.now() - t0) / 1000;
        setSecs(s);
        if (s >= MAX_SECONDS) stop();
      }, 100);
    } catch (e) {
      setErr(T.voiceMicError);
    }
  }
  function stop() {
    clearInterval(timer.current);
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
    rec.current = null;
    setRecording(null);
  }
  function play(key) {
    const url = clipUrl(key);
    if (url) new Audio(url).play().catch(() => {});
  }
  async function remove(key) { await deleteClip(key); refresh(); }
  async function download() {
    const { blob, count } = await exportPack();
    if (!count) { toast(T.voiceNothing, 'warn'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'oman-quest-voice-pack.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function upload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { const n = await importPack(f); toast(T.voiceImported(n), 'star'); refresh(); } catch { setErr(T.voiceBadFile); }
    e.target.value = '';
  }

  const groups = [['correct', T.voiceGroupCorrect], ['wrong', T.voiceGroupWrong], ['reveal', T.voiceGroupReveal]];
  return (
    <div className="voice-studio">
      <div className="vs-head">
        <h3>🎙️ {T.voiceStudio}</h3>
        <Btn kind="ghost" onClick={onClose}>✕</Btn>
      </div>
      <p className="small">{T.voiceIntro}</p>
      <ul className="vs-tips small">{T.voiceTips.map((x) => <li key={x}>{x}</li>)}</ul>
      <div className="vs-bar">
        <div className="vs-langs">
          {['en', 'ar'].map((l) => <Btn key={l} kind={lang === l ? 'primary' : 'secondary'} onClick={() => setLang(l)}>{l === 'en' ? 'English' : 'العربية'}</Btn>)}
        </div>
        <span className="vs-count">✓ {done} / {lines.length}</span>
        <Btn kind="gold" onClick={download}>⬇ {T.voiceDownload}</Btn>
        <label className="btn btn-secondary vs-upload">⬆ {T.voiceUpload}<input type="file" accept=".zip,application/zip" onChange={upload} hidden /></label>
      </div>
      {err && <p className="error">{err}</p>}
      {groups.map(([kind, title]) => (
        <div key={kind} className="vs-group">
          <h4>{title}</h4>
          {lines.filter((l) => l.kind === kind).map((l) => {
            const has = hasClip(l.key);
            const isRec = recording === l.key;
            return (
              <div key={l.key} className={`vs-line ${has ? 'has' : ''} ${isRec ? 'rec' : ''}`}>
                <span className={`vs-mood mood-${l.mood}`}>{l.mood === 'sad' ? '😢' : l.mood === 'calm' ? '💜' : '😄'}</span>
                <span className="vs-text" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{l.text}</span>
                {isRec
                  ? <Btn kind="danger" onClick={stop}>■ {Math.ceil(MAX_SECONDS - secs)}s</Btn>
                  : <Btn kind="secondary" onClick={() => start(l.key)} disabled={!!recording}>● {has ? T.voiceRedo : T.voiceRecord}</Btn>}
                <Btn kind="chip" onClick={() => play(l.key)} disabled={!has}>▶</Btn>
                <Btn kind="chip" onClick={() => remove(l.key)} disabled={!has} aria-label="delete">🗑</Btn>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
