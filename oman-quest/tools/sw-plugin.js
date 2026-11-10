/**
 * Vite plugin: writes sw.js (the offline service worker) into the build with
 * the exact list of game files, so the whole game is saved on the device the
 * first time it opens and then plays with no internet.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Recorded voice clips built into the game (public/voice), so they work offline too. */
function voiceFiles() {
  const dir = path.resolve('public/voice');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d, rel) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    if (e.isDirectory()) walk(path.join(d, e.name), `${rel}${e.name}/`);
    else out.push(`voice/${rel}${e.name}`);
  });
  walk(dir, '');
  return out;
}

export function offlineServiceWorker() {
  return {
    name: 'oeq-offline-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const statics = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
        'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png'];
      const version = Date.now().toString(36);
      const precache = [...new Set([...statics, ...files, ...voiceFiles()])];
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: swSource(version, precache) });
    },
  };
}

const swSource = (version, precache) => `// Oman English Quest 3D – offline support (generated at build time)
const CACHE = 'oeq-${version}';
const PRECACHE = ${JSON.stringify(precache)};
const FONTS = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Cairo:wght@500;700;900&display=swap';
const OPTS = { ignoreVary: true, ignoreSearch: false };
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(PRECACHE);
    // Fonts are nice to have offline; don't fail the install without them.
    await c.add(new Request(FONTS, { mode: 'cors' })).catch(() => {});
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('oeq-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache Supabase (live progress / leaderboard).
  if (url.hostname.endsWith('supabase.co')) return;
  // Pages: network first so updates arrive, cached copy when offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); return r; })
      .catch(() => caches.match('index.html', OPTS).then((r) => r || caches.match('./', OPTS))));
    return;
  }
  // Game files and fonts: cache first, then save anything new.
  const sameOrigin = url.origin === self.location.origin;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !font) return;
  e.respondWith(caches.match(req, OPTS).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return r;
  })));
});
`;
