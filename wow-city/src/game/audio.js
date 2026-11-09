/**
 * All sound is synthesised with the Web Audio API — no audio files to load,
 * so it works offline and starts instantly on iPhone/iPad after the first tap.
 */
let ctx = null;
let master; let musicBus; let sfxBus;
let enabled = true;
let musicTimer = null;
let nextNoteTime = 0;
let step = 0;

export function initAudio() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 1 : 0;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.07;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.35;
    sfxBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  startMusic();
}

export function setSoundEnabled(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
  if (!on && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

function tone(freq, t, dur, { type = 'sine', vol = 0.3, slide, bus } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus || sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const N = (n) => 440 * 2 ** ((n - 69) / 12); // midi -> Hz

export const sfx = {
  click() { if (ctx) tone(880, ctx.currentTime, 0.08, { type: 'triangle', vol: 0.2 }); },
  correct() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.08, 0.25, { type: 'triangle', vol: 0.3 }));
  },
  wrong() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(N(55), t, 0.18, { type: 'square', vol: 0.12 });
    tone(N(50), t + 0.16, 0.3, { type: 'square', vol: 0.12 });
  },
  coin() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(N(88), t, 0.08, { type: 'square', vol: 0.12 });
    tone(N(93), t + 0.07, 0.25, { type: 'square', vol: 0.12 });
  },
  jump() { if (ctx) tone(300, ctx.currentTime, 0.25, { type: 'sine', vol: 0.25, slide: 700 }); },
  key() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [84, 88, 91, 96, 100].forEach((n, i) => tone(N(n), t + i * 0.05, 0.3, { type: 'sine', vol: 0.18 }));
  },
  whoosh() { if (ctx) tone(200, ctx.currentTime, 0.35, { type: 'sawtooth', vol: 0.05, slide: 900 }); },
  fanfare() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const seq = [[67, 0, 0.15], [72, 0.15, 0.15], [76, 0.3, 0.15], [79, 0.45, 0.35], [76, 0.85, 0.15], [79, 1.0, 0.7]];
    seq.forEach(([n, d, len]) => {
      tone(N(n), t + d, len + 0.1, { type: 'square', vol: 0.12 });
      tone(N(n - 12), t + d, len + 0.1, { type: 'triangle', vol: 0.2 });
    });
  },
};

// A cheerful looping tune: melody + bass, 16 steps per bar, 4 bars.
const MELODY = [
  72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 81, 0, 79, 0, 0, 0,
  76, 0, 79, 0, 84, 0, 83, 81, 79, 0, 77, 0, 76, 0, 0, 0,
  74, 0, 77, 0, 81, 0, 79, 77, 76, 0, 79, 0, 84, 0, 83, 0,
  81, 0, 79, 0, 77, 0, 74, 0, 72, 0, 0, 0, 0, 0, 0, 0,
];
const BASS = [48, 48, 53, 53, 55, 55, 48, 48, 50, 50, 53, 53, 55, 55, 48, 48];

function startMusic() {
  if (musicTimer || !ctx) return;
  const stepDur = 60 / 118 / 2; // eighth notes
  nextNoteTime = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const m = MELODY[step % MELODY.length];
      if (m) tone(N(m), nextNoteTime, stepDur * 1.6, { type: 'triangle', vol: 0.5, bus: musicBus });
      if (step % 4 === 0) tone(N(BASS[(step / 4) % BASS.length]), nextNoteTime, stepDur * 3, { type: 'sine', vol: 0.7, bus: musicBus });
      if (step % 2 === 1) tone(N(96), nextNoteTime, 0.03, { type: 'square', vol: 0.05, bus: musicBus });
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

/** Read text aloud in English (British voice when available — "harbour", "centre"). */
export function speak(text, rate = 0.9) {
  if (!enabled || typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    voice = voice || pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'en-GB';
    u.rate = rate;
    u.pitch = 1.05;
    speechSynthesis.speak(u);
  } catch { /* speech not available */ }
}

/** Pause the music while recording so it does not leak into the microphone. */
export function duckMusic(on) {
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(on ? 0 : 0.07, ctx.currentTime, 0.1);
}
