import * as THREE from 'three';

const cache = new Map();

/** Grid of windows painted on a canvas, used on tall buildings. */
export function windowTexture(cols, rows, wall, glass, lit = '#ffe9a8') {
  const key = `w${cols}-${rows}-${wall}-${glass}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = cols * 32; c.height = rows * 32;
  const g = c.getContext('2d');
  g.fillStyle = wall; g.fillRect(0, 0, c.width, c.height);
  let seed = cols * 31 + rows * 17;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = rnd() < 0.25 ? lit : glass;
      g.fillRect(x * 32 + 6, y * 32 + 6, 20, 20);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x * 32 + 8, y * 32 + 8, 6, 6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Rounded name board for a building's sign. */
export function labelTexture(text, bg = '#7b1fa2', fg = '#ffffff') {
  const key = `l${text}-${bg}-${fg}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect ? g.roundRect(4, 4, 504, 120, 36) : g.rect(4, 4, 504, 120);
  g.fill();
  g.lineWidth = 8; g.strokeStyle = '#ffd23f'; g.stroke();
  g.fillStyle = fg;
  let size = 64;
  g.font = `800 ${size}px "Baloo 2", "Arial Rounded MT Bold", Arial, sans-serif`;
  while (g.measureText(text).width > 460 && size > 30) { size -= 4; g.font = `800 ${size}px "Baloo 2", Arial, sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
