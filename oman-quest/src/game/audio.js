/**
 * All sound is synthesised with the Web Audio API — no audio files to load,
 * so the game starts instantly and works offline. iOS requires a user tap
 * before audio can start, so initAudio() is called from the first button.
 */
let ctx = null;
let master; let musicBus; let sfxBus;
let musicTimer = null;
let nextNoteTime = 0;
let step = 0;
let settings = { muted: false, music: 0.6, sfx: 0.8, voice: true };
let mode = 'adventure';

const MUSIC_GAIN = 0.12;
const SFX_GAIN = 0.4;

export function initAudio() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    applySettings(settings);
  }
  if (ctx.state === 'suspended') ctx.resume();
  startMusic();
}

/** Apply mute and volume levels (0..1). */
export function applySettings(next) {
  settings = { ...settings, ...next };
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.05);
  musicBus.gain.setTargetAtTime(MUSIC_GAIN * settings.music, t, 0.05);
  sfxBus.gain.setTargetAtTime(SFX_GAIN * settings.sfx, t, 0.05);
  if (settings.muted && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** 'adventure' (in stages), 'menu' (calmer) or 'victory'. */
export function setMusicMode(m) { mode = m; }

function tone(freq, t, dur, { type = 'sine', vol = 0.3, slide, bus } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus || sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(t, dur, vol = 0.2, freq = 1200) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t);
}

const N = (n) => 440 * 2 ** ((n - 69) / 12);
const now = () => (ctx ? ctx.currentTime : 0);

export const sfx = {
  click() { tone(880, now(), 0.07, { type: 'triangle', vol: 0.18 }); },
  jump() { tone(320, now(), 0.22, { type: 'square', vol: 0.08, slide: 760 }); },
  doubleJump() { tone(500, now(), 0.2, { type: 'square', vol: 0.08, slide: 1200 }); },
  land() { noise(now(), 0.06, 0.15, 400); },
  coin() { const t = now(); tone(N(88), t, 0.07, { type: 'square', vol: 0.1 }); tone(N(95), t + 0.06, 0.22, { type: 'square', vol: 0.1 }); },
  star() { const t = now(); [84, 88, 91, 96, 100].forEach((n, i) => tone(N(n), t + i * 0.05, 0.28, { type: 'sine', vol: 0.18 })); },
  bump() { tone(140, now(), 0.1, { type: 'square', vol: 0.12, slide: 90 }); },
  reveal() { const t = now(); [60, 67, 72, 79].forEach((n, i) => tone(N(n), t + i * 0.06, 0.18, { type: 'triangle', vol: 0.2 })); },
  power() { const t = now(); for (let i = 0; i < 10; i++) tone(N(60 + i * 2), t + i * 0.045, 0.1, { type: 'square', vol: 0.08 }); },
  powerEnd() { const t = now(); tone(N(72), t, 0.15, { type: 'triangle', vol: 0.15 }); tone(N(65), t + 0.12, 0.25, { type: 'triangle', vol: 0.15 }); },
  stomp() { tone(220, now(), 0.15, { type: 'square', vol: 0.12, slide: 80 }); noise(now(), 0.08, 0.2, 600); },
  hurt() { const t = now(); tone(N(64), t, 0.12, { type: 'sawtooth', vol: 0.1 }); tone(N(58), t + 0.1, 0.25, { type: 'sawtooth', vol: 0.1 }); },
  pipe() { const t = now(); for (let i = 0; i < 4; i++) tone(N(55 - i * 3), t + i * 0.08, 0.1, { type: 'square', vol: 0.1 }); },
  checkpoint() { const t = now(); [72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.07, 0.2, { type: 'triangle', vol: 0.2 })); },
  correct() { const t = now(); [72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.08, 0.25, { type: 'triangle', vol: 0.28 })); },
  wrong() { const t = now(); tone(N(57), t, 0.18, { type: 'triangle', vol: 0.18 }); tone(N(53), t + 0.16, 0.3, { type: 'triangle', vol: 0.18 }); },
  locked() { const t = now(); tone(N(60), t, 0.12, { type: 'square', vol: 0.08 }); tone(N(60), t + 0.15, 0.12, { type: 'square', vol: 0.08 }); },
  happy() { const t = now(); [76, 81, 84, 88].forEach((n, i) => tone(N(n), t + i * 0.06, 0.14, { type: 'sine', vol: 0.16 })); },
  sad() { const t = now(); tone(N(67), t, 0.35, { type: 'triangle', vol: 0.14, slide: N(62) }); tone(N(62), t + 0.3, 0.5, { type: 'triangle', vol: 0.12, slide: N(57) }); },
  firework() { noise(now(), 0.5, 0.25, 900 + Math.random() * 1200); },
  fanfare() {
    const t = now();
    const seq = [[67, 0, 0.15], [72, 0.15, 0.15], [76, 0.3, 0.15], [79, 0.45, 0.35], [76, 0.85, 0.15], [79, 1.0, 0.9]];
    seq.forEach(([n, d, len]) => {
      tone(N(n), t + d, len + 0.1, { type: 'square', vol: 0.12 });
      tone(N(n - 12), t + d, len + 0.1, { type: 'triangle', vol: 0.2 });
    });
  },
};

// Adventure tune on a Hijaz-flavoured scale (D Eb F# G A Bb C) with a
// darbuka-style beat: "doum" on 1, "tak" on the off-beats.
const MELODY = [
  62, 0, 63, 66, 67, 0, 69, 0, 70, 69, 67, 0, 66, 0, 63, 0,
  62, 0, 66, 0, 69, 0, 74, 0, 72, 70, 69, 0, 67, 0, 0, 0,
  69, 0, 70, 0, 72, 0, 74, 72, 70, 0, 69, 0, 67, 66, 67, 0,
  69, 0, 67, 66, 63, 0, 66, 0, 62, 0, 0, 0, 0, 0, 0, 0,
];
const BASS = [50, 50, 55, 50, 57, 55, 50, 50];
const MENU_MELODY = [74, 0, 0, 72, 70, 0, 69, 0, 67, 0, 0, 66, 67, 0, 0, 0, 69, 0, 70, 69, 67, 0, 66, 63, 62, 0, 0, 0, 0, 0, 0, 0];

function startMusic() {
  if (musicTimer || !ctx) return;
  nextNoteTime = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    const bpm = mode === 'menu' ? 92 : mode === 'victory' ? 132 : 120;
    const stepDur = 60 / bpm / 2;
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const mel = mode === 'menu' ? MENU_MELODY : MELODY;
      const m = mel[step % mel.length];
      if (m) tone(N(m + (mode === 'victory' ? 12 : 0)), nextNoteTime, stepDur * 1.7, { type: 'triangle', vol: 0.5, bus: musicBus });
      if (step % 4 === 0) tone(N(BASS[(step / 4) % BASS.length] - 12), nextNoteTime, stepDur * 3, { type: 'sine', vol: 0.8, bus: musicBus });
      if (mode !== 'menu') {
        if (step % 8 === 0) tone(90, nextNoteTime, 0.18, { type: 'sine', vol: 0.9, slide: 50, bus: musicBus });
        if (step % 8 === 3 || step % 8 === 6) tone(N(98), nextNoteTime, 0.03, { type: 'square', vol: 0.12, bus: musicBus });
      }
      nextNoteTime += stepDur;
      step++;
    }
  }, 60);
}

let voice = null;
function pickVoice() {
  if (typeof speechSynthesis === 'undefined') return null;
  const vs = speechSynthesis.getVoices();
  return vs.find((v) => v.lang === 'en-GB') || vs.find((v) => v.lang?.startsWith('en')) || null;
}
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
}

/** Read an English sentence aloud (blanks are read as "blank"). */
export function speak(text, rate = 0.9) {
  if (settings.muted || typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/_{2,}/g, ' blank '));
    voice = voice || pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'en-GB';
    u.rate = rate;
    speechSynthesis.speak(u);
  } catch { /* speech not available */ }
}

// ───────────────────────────── the hero's voice ─────────────────────────────
// How she sounds in each mood (pitch 0–2, rate 0.1–10).
const MOOD_VOICE = {
  happy: { pitch: 1.55, rate: 1.08 },
  excited: { pitch: 1.75, rate: 1.18 },
  sad: { pitch: 0.75, rate: 0.82 },
  calm: { pitch: 1.2, rate: 0.95 },
};
let lastHeroLine = 0;

function voiceFor(lang) {
  if (typeof speechSynthesis === 'undefined') return null;
  const vs = speechSynthesis.getVoices();
  if (lang === 'ar') return vs.find((v) => v.lang?.toLowerCase().startsWith('ar')) || null;
  const en = vs.filter((v) => v.lang?.startsWith('en'));
  // prefer a female-sounding voice where the name tells us
  return en.find((v) => /female|samantha|karen|serena|moira|tessa|fiona|victoria|zira|susan|google uk english female/i.test(v.name)) || en.find((v) => v.lang === 'en-GB') || en[0] || null;
}

/**
 * The hero says a line out loud, sounding happy, excited, sad or calm.
 * `ln` = { en, ar, mood } from lines.js. Arabic is used when the game is in
 * Arabic and the device has an Arabic voice; otherwise English.
 * `important` lines interrupt; small ones (coins) are skipped while she talks.
 */
export function heroSay(ln, lang = 'en', { important = true } = {}) {
  if (settings.muted || !settings.voice || typeof speechSynthesis === 'undefined' || !ln) return;
  try {
    const nowMs = Date.now();
    if (!important && (speechSynthesis.speaking || nowMs - lastHeroLine < 2500)) return;
    lastHeroLine = nowMs;
    const arVoice = lang === 'ar' ? voiceFor('ar') : null;
    const useAr = lang === 'ar' && arVoice;
    const text = (useAr ? ln.ar : ln.en).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = useAr ? arVoice : voiceFor('en');
    if (v) u.voice = v;
    u.lang = useAr ? (v?.lang || 'ar-SA') : (v?.lang || 'en-GB');
    const m = MOOD_VOICE[ln.mood] || MOOD_VOICE.calm;
    u.pitch = m.pitch;
    u.rate = m.rate;
    u.volume = Math.max(0.3, settings.sfx);
    if (ln.mood === 'sad') sfx.sad(); else if (ln.mood !== 'calm') sfx.happy();
    speechSynthesis.speak(u);
  } catch { /* speech not available */ }
}
