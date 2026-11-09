import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store.js';
import { totals } from '../game/progress.js';
import { Btn } from './Screens.jsx';
import heroImg from '../assets/hero-full.png';

const W = 1754; const H = 1240; // A4 landscape @150dpi
const AR_FONT = '"Cairo", "Tajawal", "Geeza Pro", Arial, sans-serif';
const EN_FONT = '"Baloo 2", "Arial Rounded MT Bold", Arial, sans-serif';

function star8(g, x, y, r, fill) {
  g.save(); g.translate(x, y); g.fillStyle = fill;
  for (const rot of [0, Math.PI / 4]) { g.save(); g.rotate(rot); g.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); g.restore(); }
  g.restore();
}

function drawFlag(g, x, y, w) {
  const h = w / 2; const band = w * 0.27;
  g.fillStyle = '#fff'; g.fillRect(x + band, y, w - band, h / 3);
  g.fillStyle = '#db161b'; g.fillRect(x + band, y + h / 3, w - band, h / 3);
  g.fillStyle = '#008000'; g.fillRect(x + band, y + (2 * h) / 3, w - band, h / 3);
  g.fillStyle = '#db161b'; g.fillRect(x, y, band, h);
  g.strokeStyle = '#fff'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(x + band * 0.25, y + h * 0.1); g.lineTo(x + band * 0.75, y + h * 0.42); g.moveTo(x + band * 0.75, y + h * 0.1); g.lineTo(x + band * 0.25, y + h * 0.42); g.stroke();
  g.strokeStyle = '#999'; g.lineWidth = 1; g.strokeRect(x, y, w, h);
}

/** Vector drawing of Burj Al Sahwa for print. */
function drawBurj(g, cx, base, s) {
  const brown = '#3f2621';
  const px = (v) => cx + v * s; const py = (v) => base - v * s;
  // white base walls with arches
  g.fillStyle = '#efe7df'; g.fillRect(px(-6.5), py(3.6), 13 * s, 3.6 * s);
  g.fillStyle = '#2a211d';
  for (const ax of [-5.6, 5.6]) { g.beginPath(); g.moveTo(px(ax - 0.6), py(0.2)); g.lineTo(px(ax - 0.6), py(1.6)); g.quadraticCurveTo(px(ax - 0.6), py(2.5), px(ax), py(2.7)); g.quadraticCurveTo(px(ax + 0.6), py(2.5), px(ax + 0.6), py(1.6)); g.lineTo(px(ax + 0.6), py(0.2)); g.fill(); }
  // pillars
  g.fillStyle = brown;
  for (const x of [-4.5, 2.8]) g.fillRect(px(x), py(15.3), 1.7 * s, 15.3 * s);
  g.fillStyle = '#e9dfd6'; for (const x of [-2.5, 1.4]) g.fillRect(px(x), py(9.6), 1.1 * s, 9.6 * s);
  // chamber
  g.fillStyle = brown; g.fillRect(px(-4.5), py(16.8), 9 * s, 7.3 * s);
  g.fillStyle = '#fff1d6'; g.fillRect(px(-2.8), py(9.6), 5.6 * s, 0.25 * s);
  // turrets + merlons
  for (const x of [-3.65, 3.65]) {
    g.fillStyle = brown; g.fillRect(px(x - 1.15), py(18.2), 2.3 * s, 5.5 * s);
    for (let i = -1; i <= 1; i++) g.fillRect(px(x + i * 0.75 - 0.2), py(18.8), 0.4 * s, 0.6 * s);
  }
  for (let i = -6; i <= 6; i++) g.fillRect(px(i * 0.42 - 0.15), py(17.35), 0.3 * s, 0.55 * s);
  // blue arch + gold star + clock
  g.fillStyle = '#1d2f72'; g.strokeStyle = '#d9a441'; g.lineWidth = 0.18 * s;
  g.beginPath(); g.moveTo(px(-2.6), py(10)); g.lineTo(px(-2.6), py(12.4)); g.quadraticCurveTo(px(-2.6), py(14.7), px(0), py(15.1)); g.quadraticCurveTo(px(2.6), py(14.7), px(2.6), py(12.4)); g.lineTo(px(2.6), py(10)); g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 0.12 * s;
  for (const rot of [0, Math.PI / 4]) { g.save(); g.translate(px(0), py(12.7)); g.rotate(rot); g.strokeRect(-1.9 * s, -1.9 * s, 3.8 * s, 3.8 * s); g.restore(); }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(px(0), py(12.7), 1.3 * s, 0, 7); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 0.13 * s; g.beginPath(); g.moveTo(px(0), py(12.7)); g.lineTo(px(0.55), py(13.3)); g.moveTo(px(0), py(12.7)); g.lineTo(px(0), py(13.75)); g.stroke();
  g.fillStyle = '#e8b54a'; g.font = `bold ${1.2 * s}px ${AR_FONT}`; g.textAlign = 'center'; g.fillText('برج الصحوة', px(0), py(16.0));
  // flag on top
  g.strokeStyle = '#ccc'; g.lineWidth = 0.12 * s; g.beginPath(); g.moveTo(px(0), py(17.4)); g.lineTo(px(0), py(22)); g.stroke();
  drawFlag(g, px(0.06), py(22), 3 * s);
}

export function Certificate() {
  const { profile, go, t, lang } = useGame();
  const T = t();
  const canvas = useRef();
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!profile) return;
    const c = canvas.current; const g = c.getContext('2d');
    const img = new Image();
    img.onload = () => {
      const tt = totals(profile);
      // background
      const bg = g.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#fffaf0'); bg.addColorStop(1, '#f3e6c8');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // borders
      g.fillStyle = '#4b1f9e'; g.fillRect(0, 0, W, 40); g.fillRect(0, H - 40, W, 40); g.fillRect(0, 0, 40, H); g.fillRect(W - 40, 0, 40, H);
      g.strokeStyle = '#d9a441'; g.lineWidth = 10; g.strokeRect(60, 60, W - 120, H - 120);
      g.strokeStyle = '#18c6b4'; g.lineWidth = 4; g.strokeRect(80, 80, W - 160, H - 160);
      for (let x = 120; x < W - 80; x += 80) { star8(g, x, 60, 12, '#d9a441'); star8(g, x, H - 60, 12, '#d9a441'); }
      for (let y = 140; y < H - 80; y += 80) { star8(g, 60, y, 12, '#d9a441'); star8(g, W - 60, y, 12, '#d9a441'); }
      // titles
      g.textAlign = 'center'; g.fillStyle = '#4b1f9e';
      g.font = `800 64px ${EN_FONT}`; g.fillText('OMAN ENGLISH QUEST', W / 2, 190);
      g.fillStyle = '#b8860b'; g.font = `800 52px ${EN_FONT}`; g.fillText('ENGLISH CHAMPION CERTIFICATE', W / 2, 260);
      g.fillStyle = '#0f8f86'; g.font = `bold 40px ${AR_FONT}`; g.direction = 'rtl'; g.fillText('شهادة بطلة تحدي اللغة الإنجليزية – كنوز عُمان', W / 2, 318); g.direction = 'ltr';
      g.fillStyle = '#333'; g.font = `500 34px ${EN_FONT}`; g.fillText('This certificate is proudly presented to', W / 2, 400);
      g.fillStyle = '#4b1f9e'; g.font = `800 96px ${EN_FONT}, ${AR_FONT}`; g.fillText(profile.name, W / 2, 510);
      g.strokeStyle = '#d9a441'; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2 - 380, 535); g.lineTo(W / 2 + 380, 535); g.stroke();
      g.fillStyle = '#333'; g.font = `500 32px ${EN_FONT}`;
      g.fillText('for completing all the stages of the adventure and reaching Burj Al Sahwa', W / 2, 600);
      g.fillText('as a true Oman English Champion!', W / 2, 645);
      g.fillStyle = '#0f8f86'; g.font = `bold 30px ${AR_FONT}`; g.direction = 'rtl'; g.fillText('أنتِ بطلة تحدي اللغة الإنجليزية!', W / 2, 700); g.direction = 'ltr';
      // stats boxes
      const stats = [['TOTAL SCORE', tt.score], ['STAGES COMPLETED', `${tt.stagesCompleted} / 10`], ['COINS', tt.coins], ['GRAMMAR', `${tt.correct} / 50`]];
      stats.forEach(([label, val], i) => {
        const bx = W / 2 - 470 + i * 240;
        g.fillStyle = '#4b1f9e'; g.beginPath(); if (g.roundRect) g.roundRect(bx, 750, 220, 130, 18); else g.rect(bx, 750, 220, 130); g.fill();
        g.fillStyle = '#ffd34d'; g.font = `800 48px ${EN_FONT}`; g.fillText(String(val), bx + 110, 822);
        g.fillStyle = '#fff'; g.font = `700 20px ${EN_FONT}`; g.fillText(label, bx + 110, 860);
      });
      const date = new Date(profile.finishedAt || Date.now());
      g.fillStyle = '#333'; g.font = `600 28px ${EN_FONT}`;
      g.fillText(`Date of achievement: ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, W / 2, 950);
      // signature line
      g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 - 200, 1080); g.lineTo(W / 2 + 200, 1080); g.stroke();
      g.font = `500 24px ${EN_FONT}`; g.fillText('English Teacher  •  معلمة اللغة الإنجليزية', W / 2, 1115);
      g.fillStyle = '#4b1f9e'; g.font = `italic 700 34px ${EN_FONT}`; g.fillText('Ms. Jawaher Alkhusaibi', W / 2, 1068);
      g.fillStyle = '#8a6a2a'; g.font = `600 20px ${EN_FONT}`; g.fillText('Created by Ms. Jawaher Alkhusaibi', W / 2, 1150);
      // art: Burj on the right, hero on the left, flags in corners
      drawBurj(g, W - 240, H - 110, 22);
      const ih = 470; const iw = (img.width / img.height) * ih;
      g.drawImage(img, 120, H - 110 - ih, iw, ih);
      drawFlag(g, 130, 120, 150);
      drawFlag(g, W - 280, 120, 150);
      setUrl(c.toDataURL('image/png'));
    };
    const ready = document.fonts?.ready || Promise.resolve();
    ready.then(() => { img.src = heroImg; });
  }, [profile]);

  if (!profile) return null;
  const download = () => { const a = document.createElement('a'); a.href = url; a.download = `oman-english-quest-certificate-${profile.name.replace(/\s+/g, '-')}.png`; a.click(); };
  return (
    <div className="screen certificate-screen">
      <canvas ref={canvas} width={W} height={H} className="cert-canvas" aria-hidden />
      {url && <img className="cert-img" src={url} alt="Oman English Quest – English Champion Certificate" />}
      <div className="cert-actions no-print">
        <Btn kind="gold" onClick={download} disabled={!url}>⬇ {T.download}</Btn>
        <Btn onClick={() => window.print()} disabled={!url}>🖨️ {T.print}</Btn>
        <Btn kind="secondary" onClick={() => go('map')}>🗺️ {T.backToMap}</Btn>
      </div>
      {lang === 'ar' && <p className="no-print small">🎆</p>}
    </div>
  );
}
