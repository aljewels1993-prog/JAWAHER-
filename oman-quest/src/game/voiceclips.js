import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { LINES, RECORDABLE, setClipFilter } from './lines.js';

/**
 * Real recorded voice for the hero (e.g. a child reading her lines).
 *
 * Two sources, checked in this order:
 *  1. Recordings made on this device in the teacher's Voice Studio
 *     (kept in IndexedDB, never uploaded anywhere).
 *  2. A voice pack built into the game: public/voice/manifest.json + audio
 *     files — this is how one set of recordings reaches every student.
 * When neither has the line, the game falls back to the device voice.
 *
 * Clip keys look like "en/correct-3" or "ar/wrong-7".
 */
const DB = 'oeq-voice';
const STORE = 'clips';
const urls = new Map(); // key -> playable URL
let ready = null;

function db() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no IndexedDB')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

export const clipKey = (lang, clip) => `${lang}/${clip}`;

/** Load the built-in pack and this device's recordings (call once at start). */
export function loadVoices() {
  if (ready) return ready;
  ready = (async () => {
    try {
      const base = import.meta.env?.BASE_URL || './';
      const r = await fetch(`${base}voice/manifest.json`, { cache: 'no-cache' });
      if (r.ok) {
        const m = await r.json();
        for (const [key, file] of Object.entries(m.clips || {})) urls.set(key, `${base}voice/${file}`);
      }
    } catch { /* no built-in pack yet */ }
    try {
      const keys = await tx('readonly', (s) => s.getAllKeys());
      for (const key of keys) {
        const blob = await tx('readonly', (s) => s.get(key));
        if (blob) urls.set(key, URL.createObjectURL(blob));
      }
    } catch { /* storage blocked */ }
    setClipFilter((clip) => urls.has(`en/${clip}`) || urls.has(`ar/${clip}`));
  })();
  return ready;
}

export const hasClip = (key) => urls.has(key);
export const clipUrl = (key) => urls.get(key) || null;

/** Save a recording made on this device. */
export async function saveClip(key, blob) {
  await tx('readwrite', (s) => s.put(blob, key));
  const old = urls.get(key);
  if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
  urls.set(key, URL.createObjectURL(blob));
}

export async function deleteClip(key) {
  await tx('readwrite', (s) => s.delete(key));
  const old = urls.get(key);
  if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
  urls.delete(key);
  await loadBuiltInOnly(key);
}
async function loadBuiltInOnly(key) {
  try {
    const base = import.meta.env?.BASE_URL || './';
    const r = await fetch(`${base}voice/manifest.json`, { cache: 'no-cache' });
    if (r.ok) { const m = await r.json(); if (m.clips?.[key]) urls.set(key, `${base}voice/${m.clips[key]}`); }
  } catch { /* ignore */ }
}

/** Every line the hero says out loud, for the Voice Studio. */
export function recordableLines(lang) {
  return RECORDABLE.flatMap((kind) => LINES[kind].list.map(([en, ar], i) => ({
    kind, clip: `${kind}-${i + 1}`, key: clipKey(lang, `${kind}-${i + 1}`), text: lang === 'ar' ? ar : en, mood: LINES[kind].mood,
  })));
}

const extOf = (type) => (type.includes('mp4') || type.includes('aac') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('mpeg') ? 'mp3' : 'webm');

/** Pack all recordings made on this device into one .zip (to share / build in). */
export async function exportPack() {
  const keys = await tx('readonly', (s) => s.getAllKeys());
  const files = {};
  const clips = {};
  for (const key of keys) {
    const blob = await tx('readonly', (s) => s.get(key));
    if (!blob) continue;
    const name = `${key}.${extOf(blob.type || '')}`;
    files[name] = new Uint8Array(await blob.arrayBuffer());
    clips[key] = name;
  }
  files['manifest.json'] = strToU8(JSON.stringify({ version: 1, created: new Date().toISOString(), clips }, null, 2));
  return { blob: new Blob([zipSync(files)], { type: 'application/zip' }), count: Object.keys(clips).length };
}

/** Load a voice pack .zip into this device (e.g. moving recordings to another iPad). */
export async function importPack(file) {
  const data = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const manifest = JSON.parse(strFromU8(data['manifest.json']));
  let n = 0;
  for (const [key, name] of Object.entries(manifest.clips || {})) {
    if (!data[name]) continue;
    const ext = name.split('.').pop();
    const type = { m4a: 'audio/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg' }[ext] || 'audio/webm';
    await saveClip(key, new Blob([data[name]], { type }));
    n++;
  }
  return n;
}
