/** Small chimes made with Web Audio (no audio files to download). */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a click handler so mobile browsers allow sound later. */
export function unlockAudio(): void {
  audio();
}

export function playChime(kind: 'finish' | 'break' | 'reward' = 'finish'): void {
  const a = audio();
  if (!a) return;
  const notes = kind === 'finish' ? [523.25, 659.25, 783.99, 1046.5] : kind === 'break' ? [783.99, 659.25, 523.25] : [659.25, 987.77];
  notes.forEach((f, i) => {
    const t0 = a.currentTime + i * 0.16;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + 0.6);
  });
}
