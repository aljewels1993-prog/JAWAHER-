import { describe, it, expect } from 'vitest';
import { createWorld, step, completeQuestion, closeQuestion, respawn } from '../src/game/sim.js';
import { buildLevel } from '../src/game/level.js';
import { STAGES } from '../src/data/stages.js';
import { TUNING } from '../src/data/tuning.js';

const IDLE = { left: false, right: false, jump: false, jumpPressed: false, downPressed: false };
const run = (w, secs, input = IDLE, dt = 1 / 60) => {
  const ev = [];
  for (let t = 0; t < secs; t += dt) { ev.push(...step(w, dt, input)); input = { ...input, jumpPressed: false, downPressed: false }; }
  return ev;
};
// A tiny hand-made test level.
function testLevel(extra = {}) {
  return {
    stageId: 1, solids: [{ id: 'g', kind: 'ground', x: -20, y: -8, w: 200, h: 8 }, ...(extra.solids || [])],
    movers: extra.movers || [], coins: extra.coins || [], stars: [], enemies: extra.enemies || [], plants: [],
    pipes: extra.pipes || [], checkpoints: [], decor: [], grammar: [], finish: extra.finish || null, gate: extra.gate || null,
    secret: null, spawn: { x: 0, y: 0 }, length: 100,
  };
}

describe('player physics', () => {
  it('stands on the ground without falling through', () => {
    const w = createWorld(testLevel());
    run(w, 5);
    expect(w.player.y).toBeCloseTo(0, 3);
    expect(w.player.onGround).toBe(true);
  });
  it('jumps about as high as the tuning says', () => {
    const w = createWorld(testLevel());
    run(w, 0.1);
    let maxY = 0;
    let input = { ...IDLE, jump: true, jumpPressed: true };
    for (let i = 0; i < 90; i++) { step(w, 1 / 60, input); input = { ...input, jumpPressed: false }; maxY = Math.max(maxY, w.player.y); }
    const P = TUNING.player;
    expect(maxY).toBeGreaterThan((P.jumpVelocity ** 2) / (2 * P.gravity) - 0.25);
    expect(maxY).toBeLessThan((P.jumpVelocity ** 2) / (2 * P.gravity) + 0.1);
  });
  it('a tap gives a lower jump than a hold', () => {
    const w = createWorld(testLevel());
    run(w, 0.1);
    let maxY = 0;
    step(w, 1 / 60, { ...IDLE, jump: true, jumpPressed: true });
    for (let i = 0; i < 90; i++) { step(w, 1 / 60, IDLE); maxY = Math.max(maxY, w.player.y); }
    expect(maxY).toBeLessThan(1.5);
  });
  it('never tunnels through a thin platform when falling at full speed', () => {
    const w = createWorld(testLevel({ solids: [{ id: 'b', kind: 'brick', x: -2, y: 5, w: 4, h: 0.5 }] }));
    w.player.y = 60; w.player.vy = -TUNING.player.maxFall;
    run(w, 6, IDLE, 1 / 20); // big, laggy frames
    expect(w.player.y).toBeCloseTo(5.5, 3);
  });
  it('walls stop the player', () => {
    const w = createWorld(testLevel({ solids: [{ id: 'wall', kind: 'stone', x: 3, y: 0, w: 1, h: 4 }] }));
    run(w, 3, { ...IDLE, right: true });
    expect(w.player.x).toBeLessThanOrEqual(3 - w.player.w / 2 + 1e-3);
  });
});

describe('blocks, items and enemies', () => {
  const by = TUNING.level.blockY;
  it('hitting a ? block from below releases its content once', () => {
    const w = createWorld(testLevel({ solids: [{ id: 'q', kind: 'qblock', x: -0.5, y: by, w: 1, h: 1, content: 'coin' }] }));
    run(w, 0.1);
    const ev = run(w, 1.2, { ...IDLE, jump: true, jumpPressed: true });
    expect(ev.filter((e) => e.type === 'coin')).toHaveLength(1);
    expect(w.stats.coins).toBe(1);
    run(w, 0.5);
    const ev2 = run(w, 1.2, { ...IDLE, jump: true, jumpPressed: true });
    expect(ev2.filter((e) => e.type === 'coin')).toHaveLength(0);
  });
  it('a mushroom block gives a power-up that enables a double jump', () => {
    const w = createWorld(testLevel({ solids: [{ id: 'q', kind: 'qblock', x: -0.5, y: by, w: 1, h: 1, content: 'jump' }] }));
    run(w, 0.1);
    run(w, 1.2, { ...IDLE, jump: true, jumpPressed: true });
    const ev = run(w, 4); // mushroom pops out, slides off and falls onto the player's level
    run(w, 3, { ...IDLE, right: true });
    run(w, 3, { ...IDLE, left: true });
    expect(w.player.power?.type).toBe('jump');
    expect(ev.length).toBeGreaterThanOrEqual(0);
    run(w, 0.1);
    let input = { ...IDLE, jump: true, jumpPressed: true };
    let jumps = 0;
    for (let i = 0; i < 40; i++) {
      jumps += step(w, 1 / 60, input).filter((e) => e.type === 'jump').length;
      input = { ...IDLE, jump: true, jumpPressed: i === 20 };
    }
    expect(jumps).toBe(2);
  });
  it('a grammar block opens a question and pauses play until answered', () => {
    const w = createWorld(testLevel({ solids: [{ id: 'gq', kind: 'grammar', x: -0.5, y: by, w: 1, h: 1, questionId: 'q01' }] }));
    run(w, 0.1);
    const ev = run(w, 1, { ...IDLE, jump: true, jumpPressed: true });
    expect(ev.some((e) => e.type === 'question' && e.questionId === 'q01')).toBe(true);
    expect(w.status).toBe('question');
    const x = w.player.x;
    run(w, 1, { ...IDLE, right: true });
    expect(w.player.x).toBe(x);
    closeQuestion(w);
    expect(w.status).toBe('playing');
    completeQuestion(w, 'q01');
    expect(w.answered.has('q01')).toBe(true);
  });
  it('stomping an enemy defeats it; walking into one hurts', () => {
    const w = createWorld(testLevel({ enemies: [{ id: 'e1', x: 3, y: 0, minX: 2.9, maxX: 3.1, dir: 1 }] }));
    w.player.x = 3; w.player.y = 4; w.player.vy = 0;
    const ev = run(w, 1);
    expect(ev.some((e) => e.type === 'stomp')).toBe(true);
    const w2 = createWorld(testLevel({ enemies: [{ id: 'e2', x: 3, y: 0, minX: 2.9, maxX: 3.1, dir: 1 }] }));
    const ev2 = run(w2, 2, { ...IDLE, right: true });
    expect(ev2.some((e) => e.type === 'hurt')).toBe(true);
    expect(w2.player.hearts).toBe(TUNING.player.maxHearts - 1);
  });
  it('coins are collected only once', () => {
    const w = createWorld(testLevel({ coins: [{ id: 'c1', x: 2, y: 0.8 }] }));
    run(w, 2, { ...IDLE, right: true });
    run(w, 2, { ...IDLE, left: true });
    expect(w.stats.coins).toBe(1);
  });
  it('moving platforms carry the player', () => {
    const w = createWorld(testLevel({ movers: [{ id: 'm', x: 0, y: 3, w: 3, h: 0.5, ax: 4, ay: 0, period: 4, phase: 0 }] }));
    w.player.y = 3.6;
    run(w, 1);
    expect(w.player.groundMover).toBe('m');
    expect(w.player.x).toBeGreaterThan(2);
  });
  it('falling out of the world costs a heart and respawns at the checkpoint', () => {
    const w = createWorld({ ...testLevel(), solids: [] });
    const ev = run(w, 3);
    expect(ev.some((e) => e.type === 'fall')).toBe(true);
    expect(w.player.hearts).toBeLessThan(TUNING.player.maxHearts);
    respawn(w, true);
    expect(w.player.hearts).toBe(TUNING.player.maxHearts);
  });
  it('the gate blocks the finish until all 5 questions are done', () => {
    const lvl = testLevel({ gate: { x: 5, y: 0, w: 1, h: 6 }, finish: { x: 8, y: 0, w: 2, h: 6 } });
    const w = createWorld(lvl, { answered: ['q01', 'q02', 'q03', 'q04'] });
    const ev = run(w, 3, { ...IDLE, right: true });
    expect(ev.some((e) => e.type === 'gateLocked' && e.remaining === 1)).toBe(true);
    expect(w.status).toBe('playing');
    completeQuestion(w, 'q05');
    const ev2 = run(w, 3, { ...IDLE, right: true });
    expect(ev2.some((e) => e.type === 'finished')).toBe(true);
  });
});

// A simple bot that plays each real stage start-to-finish (with questions
// pre-answered and spare hearts) — proves every stage can be completed.
function playBot(stage) {
  const lv = buildLevel(stage);
  const ids = lv.grammar.map((g) => g.questionId);
  const w = createWorld(lv, { answered: ids });
  w.player.hearts = 999;
  const dt = 1 / 60;
  const groundAt = (x, y) => lv.solids.some((s) => x >= s.x && x <= s.x + s.w && s.y + s.h <= y + 0.05 && s.y + s.h > y - 6) ||
    w.movers.some((m) => Math.abs(m.cx - x) < m.w / 2 && m.cy + m.h <= y + 0.05);
  let holdJump = 0;
  let wait = 0;
  let target = null;
  const climbFrom = lv.tower ? Math.min(...lv.solids.filter((s) => s.kind === 'brick' && s.y >= 0.99 && s.x > lv.tower.x - 45).map((s) => s.x)) - 3 : Infinity;
  const steps = () => [
    ...lv.solids.filter((s) => (s.kind === 'brick' || s.kind === 'towerRoof') && s.x > climbFrom).map((s) => ({ l: s.x, r: s.x + s.w, top: s.y + s.h })),
    ...w.movers.filter((m) => m.x > climbFrom).map((m) => ({ l: m.cx - m.w / 2, r: m.cx + m.w / 2, top: m.cy + m.h, mover: m })),
  ];
  for (let t = 0; t < 400; t += dt) {
    const p = w.player;
    let jumpPressed = false;
    if (process.env.BOT_TRACE && p.x > climbFrom && Math.round(t * 60) % 15 === 0) console.log(t.toFixed(2), p.x.toFixed(2), p.y.toFixed(2), p.onGround, target && target.top);
    if (p.x > climbFrom) {
      // Final climb: jump from step to step up to the tower roof.
      let left = false; let right = false;
      if (p.onGround) {
        const next = steps().filter((s) => s.top > p.y + 0.5 && s.top < p.y + 2.7).sort((a, b) => a.top - b.top)[0];
        target = next || null;
        if (!next && p.y > lv.tower.roofY - 0.1) right = true; // on the roof: go to the flag
        else if (!next) left = p.y < 0.5; // fell: walk back to the first step
        else {
          const d = next.l - p.x;
          const onTop = (x) => steps().some((s) => x >= s.l && x <= s.r && Math.abs(s.top - p.y) < 0.1) || p.y < 0.05;
          if (d > 1.6 && onTop(p.x + 0.45)) right = true;
          else if (d < 0.3 && p.y < next.top - 2.2) left = true; // under the step: back off first
          else if (!next.mover || Math.abs(next.mover.cx - next.mover.x) < 0.3) { jumpPressed = true; holdJump = 0.6; }
        }
      } else if (target) {
        const cx = (target.l + target.r) / 2;
        right = p.x < cx - 0.3; left = p.x > cx + 0.3;
        if (target.mover) { const c = target.mover.cx; right = p.x < c - 0.3; left = p.x > c + 0.3; }
      }
      if (holdJump > 0) holdJump -= dt;
      step(w, dt, { left, right, jump: holdJump > 0, jumpPressed, downPressed: false });
      if (w.status === 'question') completeQuestion(w, w.pendingQuestion.questionId);
      if (w.status === 'victory') return { ok: true, t, w };
      continue;
    }
    if (p.onGround && holdJump <= 0) {
      const ahead = lv.solids.some((s) => s.x > p.x && s.x < p.x + 1.4 && s.y < p.y + 1.5 && s.y + s.h > p.y + 0.05);
      const edge = !groundAt(p.x + 0.9, p.y);
      const moverPit = edge && w.movers.find((m) => m.ay === 0 && m.cx > p.x && m.cx - p.x < 12);
      if (moverPit) {
        const near = moverPit.cx - moverPit.w / 2 - p.x;
        const approaching = moverPit.cx - moverPit.px < 0;
        if (near < 1.2 && (approaching || near < 0.4)) { jumpPressed = true; wait = 0; } else wait = 1;
      } else if (ahead || edge || (!groundAt(p.x + 2.5, p.y) && !groundAt(p.x + 1.5, p.y))) { jumpPressed = true; }
      else {
        // ledge above within reach right ahead (floating platform / lift)
        const ledge = lv.solids.find((s) => s.kind === 'brick' && s.x > p.x && s.x < p.x + 3 && s.y + s.h > p.y + 0.9 && s.y + s.h < p.y + 2.6 && !lv.solids.some((o) => o.kind === 'ground' && o.x <= s.x && o.x + o.w >= s.x + s.w && o.y + o.h >= p.y - 0.01 && s.y < 2.5));
        if (ledge) jumpPressed = true;
      }
      if (jumpPressed) holdJump = 0.5;
    }
    if (holdJump > 0) holdJump -= dt;
    const right = wait ? false : true;
    wait = 0;
    step(w, dt, { left: false, right, jump: holdJump > 0, jumpPressed, downPressed: false });
    if (w.status === 'question') completeQuestion(w, w.pendingQuestion.questionId);
    if (w.status === 'finished' || w.status === 'victory') return { ok: true, t, w };
  }
  return { ok: false, w };
}

describe('every stage can be completed', () => {
  for (const stage of STAGES) {
    it(`stage ${stage.id} – ${stage.name}`, () => {
      const r = playBot(stage);
      if (!r.ok) console.log('stuck at', r.w.player.x.toFixed(1), r.w.player.y.toFixed(1), 'finish', r.w.level.finish.x, 'falls', r.w.stats.falls);
      expect(r.ok).toBe(true);
      expect(r.w.status).toBe(stage.gen.final ? 'victory' : 'finished');
    });
  }
});
