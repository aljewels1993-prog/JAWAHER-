import * as THREE from 'three';

/**
 * Original artwork painted on <canvas> at runtime — no image downloads, crisp
 * on retina screens, and nothing copied from the reference pictures.
 */
const cache = new Map();
const ARABIC_FONT = '"Cairo", "Tajawal", "Noto Naskh Arabic", "Geeza Pro", "Arial", sans-serif';

function make(key, w, h, draw, { repeat, srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  cache.set(key, t);
  return t;
}

const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };

export function brickTexture() {
  return make('brick', 256, 256, (g, w, h) => {
    g.fillStyle = '#5a2b16'; g.fillRect(0, 0, w, h);
    const rows = 4; const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? w / 4 : 0;
      for (let i = -1; i < 3; i++) {
        const x = i * (w / 2) + off + 5; const y = r * rh + 5;
        const grd = g.createLinearGradient(0, y, 0, y + rh - 10);
        grd.addColorStop(0, '#c4663a'); grd.addColorStop(1, '#94461f');
        g.fillStyle = grd; rr(g, x, y, w / 2 - 10, rh - 10, 6); g.fill();
        g.fillStyle = 'rgba(255,220,180,0.25)'; g.fillRect(x + 6, y + 4, w / 2 - 22, 5);
      }
    }
    g.strokeStyle = '#2b1309'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
  });
}

function riveted(g, w, h, base, light, dark) {
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, light); grd.addColorStop(1, base);
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.strokeStyle = dark; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(18, 18, w - 36, 8);
  g.fillStyle = dark;
  for (const [x, y] of [[30, 30], [w - 30, 30], [30, h - 30], [w - 30, h - 30]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
}

export function questionTexture() {
  return make('qblock', 256, 256, (g, w, h) => {
    riveted(g, w, h, '#f2b705', '#ffe066', '#9a5b00');
    g.font = 'bold 170px "Baloo 2", "Arial Rounded MT Bold", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#8a4b00'; g.fillText('?', w / 2 + 8, h / 2 + 14);
    g.fillStyle = '#ffffff'; g.fillText('?', w / 2, h / 2 + 6);
  });
}

export function usedBlockTexture() {
  return make('used', 256, 256, (g, w, h) => riveted(g, w, h, '#8f5a2b', '#b07a45', '#4a2a10'));
}

/** Purple-and-gold grammar block with an Arabic-arch frame. */
export function grammarTexture(done = false) {
  return make(`grammar${done}`, 256, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 180);
    if (done) { grd.addColorStop(0, '#5ff2df'); grd.addColorStop(1, '#0f8f86'); } else { grd.addColorStop(0, '#9a5cff'); grd.addColorStop(1, '#4b1f9e'); }
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd34d'; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16);
    // pointed (Omani) arch outline
    g.lineWidth = 7; g.beginPath();
    g.moveTo(52, 220); g.lineTo(52, 110); g.quadraticCurveTo(52, 52, 128, 30); g.quadraticCurveTo(204, 52, 204, 110); g.lineTo(204, 220);
    g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff6d0';
    if (done) { g.font = 'bold 130px Arial'; g.fillText('✓', w / 2, h / 2 + 18); } else {
      g.font = 'bold 120px "Baloo 2", Arial'; g.fillText('?', w / 2, h / 2 + 4);
      g.font = 'bold 34px Arial'; g.fillStyle = '#ffd34d'; g.fillText('ABC', w / 2, 196);
    }
  });
}

export function stoneTexture() {
  return make('stone', 128, 128, (g, w, h) => {
    g.fillStyle = '#c9a26b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${60 + Math.random() * 40},30,0.18)`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    g.strokeStyle = '#8d6a3c'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(8, 8, w - 16, 5);
  });
}

/** Front face of the ground: grass lip on top, layered soil below. */
export function groundSideTexture(kind) {
  return make(`gside-${kind}`, 128, 512, (g, w, h) => {
    const pal = {
      grass: { lip: '#56c43a', lipDark: '#2f8a22', soil: ['#d68b45', '#b8692d', '#9c5422'] },
      sand: { lip: '#ffd77a', lipDark: '#d9a441', soil: ['#e8b86a', '#d39c4f', '#bf853d'] },
      rock: { lip: '#9fb37a', lipDark: '#6d7f50', soil: ['#8c7a6b', '#75655a', '#5f5149'] },
    }[kind] || {};
    pal.soil.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, 64 + i * 150, w, 150); });
    for (let y = 90; y < h; y += 42) {
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 6; g.beginPath();
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 12 + y) * 5);
      g.stroke();
    }
    g.fillStyle = pal.lipDark; g.fillRect(0, 0, w, 70);
    g.fillStyle = pal.lip; g.fillRect(0, 0, w, 52);
    g.fillStyle = pal.lip;
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 50); g.lineTo(x + 8, 78); g.lineTo(x + 16, 50); g.fill(); }
  }, { repeat: [1, 1] });
}

export function groundTopTexture(kind) {
  return make(`gtop-${kind}`, 128, 128, (g, w, h) => {
    const base = { grass: '#5fcf45', sand: '#ffd98a', rock: '#a7b884' }[kind];
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(${kind === 'sand' ? '180,130,60' : '30,110,30'},${Math.random() * 0.25})`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 5);
    }
  }, { repeat: [1, 1] });
}

export function coinTexture() {
  return make('coin', 256, 256, (g, w, h) => {
    const grd = g.createRadialGradient(100, 90, 10, 128, 128, 128);
    grd.addColorStop(0, '#fff3a6'); grd.addColorStop(0.6, '#ffc61a'); grd.addColorStop(1, '#d68a00');
    g.fillStyle = grd; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
    g.strokeStyle = '#b86e00'; g.lineWidth = 12; g.beginPath(); g.arc(128, 128, 100, 0, 7); g.stroke();
    // eight-pointed Omani star
    g.fillStyle = '#c47a00';
    for (const rot of [0, Math.PI / 4]) {
      g.save(); g.translate(128, 128); g.rotate(rot); g.fillRect(-46, -46, 92, 92); g.restore();
    }
    g.fillStyle = '#ffe680';
    for (const rot of [0, Math.PI / 4]) {
      g.save(); g.translate(128, 128); g.rotate(rot); g.fillRect(-36, -36, 72, 72); g.restore();
    }
  });
}

/** Analogue clock face like Burj Al Sahwa's: white dial, black hands drawn separately. */
export function clockTexture() {
  return make('clock', 512, 512, (g, w, h) => {
    const grd = g.createRadialGradient(256, 256, 40, 256, 256, 256);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#e9eef5');
    g.fillStyle = grd; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
    g.strokeStyle = '#c99a3b'; g.lineWidth = 16; g.beginPath(); g.arc(256, 256, 242, 0, 7); g.stroke();
    g.strokeStyle = '#1d1d1d';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2; const long = i % 5 === 0;
      g.lineWidth = long ? 10 : 3;
      g.beginPath();
      g.moveTo(256 + Math.cos(a) * (long ? 190 : 210), 256 + Math.sin(a) * (long ? 190 : 210));
      g.lineTo(256 + Math.cos(a) * 228, 256 + Math.sin(a) * 228); g.stroke();
    }
    g.strokeStyle = 'rgba(160,170,190,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.beginPath(); g.moveTo(256, 256); g.lineTo(256 + Math.cos(a) * 180, 256 + Math.sin(a) * 180); g.stroke(); }
  });
}

/** Gold Arabic lettering on a transparent background. */
export function arabicSignTexture(text = 'برج الصحوة', sub = 'مسقط - سلطنة عُمان') {
  return make(`sign-${text}-${sub}`, 1024, 320, (g, w, h) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.font = `bold 170px ${ARABIC_FONT}`;
    g.fillStyle = '#5a3a00'; g.fillText(text, w / 2 + 5, 130 + 5);
    const grd = g.createLinearGradient(0, 40, 0, 220);
    grd.addColorStop(0, '#fff1a8'); grd.addColorStop(0.5, '#f1b52a'); grd.addColorStop(1, '#b97a10');
    g.fillStyle = grd; g.fillText(text, w / 2, 130);
    if (sub) { g.font = `bold 58px ${ARABIC_FONT}`; g.fillStyle = '#e8b54a'; g.fillText(sub, w / 2, 262); }
  });
}

/** Flag of the Sultanate of Oman (simplified emblem). */
export function omanFlagTexture() {
  return make('flag', 512, 256, (g, w, h) => {
    const band = w * 0.27;
    g.fillStyle = '#ffffff'; g.fillRect(band, 0, w - band, h / 3);
    g.fillStyle = '#db161b'; g.fillRect(band, h / 3, w - band, h / 3);
    g.fillStyle = '#008000'; g.fillRect(band, (2 * h) / 3, w - band, h / 3);
    g.fillStyle = '#db161b'; g.fillRect(0, 0, band, h);
    // emblem: khanjar with two crossed swords
    g.save(); g.translate(band / 2, 52); g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineCap = 'round';
    g.lineWidth = 6;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-34 * s, -28); g.quadraticCurveTo(-6 * s, 8, 30 * s, 36); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(-24, -6); g.lineTo(24, -6); g.stroke();
    g.beginPath(); g.moveTo(0, -30); g.lineTo(0, 4); g.quadraticCurveTo(2, 30, 18, 40); g.lineWidth = 8; g.stroke();
    g.beginPath(); g.arc(0, -32, 6, 0, 7); g.fill();
    g.restore();
  });
}

export function cloudFaceTexture() {
  return make('cloudface', 128, 128, (g) => {
    g.fillStyle = '#1b1b2a';
    for (const x of [44, 84]) { g.beginPath(); g.ellipse(x, 60, 8, 18, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - 2, 52, 3, 5, 0, 0, 7); g.fill(); g.fillStyle = '#1b1b2a'; }
  });
}

export function skyTexture(top, bottom) {
  return make(`sky-${top}-${bottom}`, 16, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, top); grd.addColorStop(1, bottom);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
}

export function muralTexture() {
  return make('mural', 256, 160, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#d8c3a5'); grd.addColorStop(1, '#a88d6c');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${120 + Math.random() * 80},${90 + Math.random() * 60},${60 + Math.random() * 40},0.5)`;
      g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 24, 4 + Math.random() * 14, Math.random() * 3, 0, 7); g.fill();
    }
  });
}

export function pipeTexture() {
  return make('pipe', 256, 16, (g, w) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#1d7a2a'); grd.addColorStop(0.25, '#7ef06a'); grd.addColorStop(0.35, '#c8ffb0');
    grd.addColorStop(0.5, '#3fc23d'); grd.addColorStop(1, '#14641f');
    g.fillStyle = grd; g.fillRect(0, 0, w, 16);
  });
}

/** Three-step gradient map for a cartoon (toon) shading look. */
export function toonGradient() {
  if (cache.has('toon')) return cache.get('toon');
  const data = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  cache.set('toon', t);
  return t;
}

export function loadImageTexture(url) {
  if (cache.has(url)) return cache.get(url);
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(url, t);
  return t;
}
