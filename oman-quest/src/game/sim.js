import { TUNING } from '../data/tuning.js';
import { SECRET_FLOOR } from './level.js';

/**
 * Headless game simulation for one stage. The 3D scene reads this state every
 * frame; the UI listens to the events returned by step(). No Three.js here, so
 * the whole ruleset is unit-testable.
 *
 * Bodies use x = centre, y = feet (bottom).
 */
const EPS = 1e-4;
const overlap = (a, b) => a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS && a.y0 < b.y1 - EPS && a.y1 > b.y0 + EPS;
const boxOf = (s) => ({ x0: s.x, x1: s.x + s.w, y0: s.y, y1: s.y + s.h });
const bodyBox = (b) => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y, y1: b.y + b.h });

export function createWorld(level, opts = {}) {
  const P = TUNING.player;
  const answered = new Set(opts.answered || []);
  const w = {
    level,
    t: 0,
    status: 'playing', // playing | question | finished | victory | gameover
    answered,
    usedBlocks: new Set(),
    bumps: {}, // blockId -> time of last bump (for the bounce animation)
    takenCoins: new Set(),
    takenStars: new Set(),
    movers: level.movers.map((m) => ({ ...m, cx: m.x, cy: m.y, px: m.x, py: m.y })),
    enemies: level.enemies.map((e) => ({ ...e, w: TUNING.enemy.width, h: TUNING.enemy.height, alive: true, squash: 0 })),
    plants: level.plants.map((p) => ({ ...p, f: 0, clock: p.phase })),
    items: [], // spawned mushrooms / stars from blocks
    checkpoint: { ...level.spawn },
    reachedCheckpoints: new Set(),
    stats: { coins: 0, stars: 0, stomps: 0, falls: 0 },
    player: {
      x: level.spawn.x, y: level.spawn.y, vx: 0, vy: 0, w: P.width, h: P.height,
      onGround: false, groundMover: null, facing: 1, coyote: 0, buffer: 0, airJumps: 0,
      cut: false, invuln: 0, hearts: P.maxHearts, power: null, inSecret: false,
      landedAt: -1, jumpedAt: -1,
    },
    lockMsgAt: -10,
    pendingQuestion: null,
  };
  return w;
}

export const gateOpen = (w) => w.answered.size >= 5;

function staticSolids(w) {
  const list = w.level.solids;
  if (!gateOpen(w) && w.level.gate) return list.concat([{ id: 'gate', kind: 'gate', ...w.level.gate }]);
  return list;
}

/** Advance the world. Returns an array of events for sound/UI. */
export function step(w, dt, input) {
  const events = [];
  if (w.status !== 'playing') return events;
  const maxStep = TUNING.physics.maxStep;
  let remaining = Math.min(dt, 0.1);
  // Edge-triggered inputs apply to the first sub-step only.
  let inp = input;
  while (remaining > 1e-6) {
    const h = Math.min(maxStep, remaining);
    subStep(w, h, inp, events);
    inp = { ...input, jumpPressed: false, downPressed: false };
    remaining -= h;
    if (w.status !== 'playing') break;
  }
  return events;
}

function subStep(w, dt, input, events) {
  const P = TUNING.player;
  const p = w.player;
  w.t += dt;
  const solids = staticSolids(w);

  // ── moving platforms ──
  for (const m of w.movers) {
    m.px = m.cx; m.py = m.cy;
    const s = Math.sin((w.t / m.period) * Math.PI * 2 + m.phase);
    m.cx = m.x + m.ax * s;
    m.cy = m.y + m.ay * s;
  }
  if (p.groundMover) {
    const m = w.movers.find((mm) => mm.id === p.groundMover);
    if (m) { p.x += m.cx - m.px; p.y += m.cy - m.py; }
  }

  // ── power-up timer ──
  if (p.power) {
    p.power.t -= dt;
    if (p.power.t <= 0) { events.push({ type: 'powerEnd', power: p.power.type }); p.power = null; }
  }
  if (p.invuln > 0) p.invuln -= dt;

  // ── horizontal control ──
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const accel = p.onGround ? P.accelGround : P.accelAir;
  if (dir !== 0) {
    p.vx += dir * accel * dt;
    p.vx = Math.max(-P.runSpeed, Math.min(P.runSpeed, p.vx));
    p.facing = dir;
  } else if (p.onGround) {
    const f = P.friction * dt;
    p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  } else {
    p.vx *= 1 - Math.min(1, 2 * dt);
  }

  // ── jumping (coyote time + buffer + variable height + double jump) ──
  if (input.jumpPressed) p.buffer = P.jumpBuffer;
  else p.buffer = Math.max(0, p.buffer - dt);
  p.coyote = p.onGround ? P.coyoteTime : Math.max(0, p.coyote - dt);
  const superJump = p.power?.type === 'jump';
  const jv = superJump ? TUNING.power.superJump.jumpVelocity : P.jumpVelocity;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = jv; p.onGround = false; p.groundMover = null; p.coyote = 0; p.buffer = 0; p.cut = false;
    p.airJumps = superJump ? TUNING.power.superJump.doubleJumps : 0;
    p.jumpedAt = w.t;
    events.push({ type: 'jump' });
  } else if (input.jumpPressed && !p.onGround && p.airJumps > 0) {
    p.airJumps -= 1; p.vy = jv * 0.9; p.cut = false; p.buffer = 0; p.jumpedAt = w.t;
    events.push({ type: 'jump', double: true });
  }
  if (!input.jump && p.vy > 0 && !p.cut) { p.vy *= P.jumpCut; p.cut = true; }

  // ── gravity ──
  p.vy = Math.max(-P.maxFall, p.vy - P.gravity * dt);

  // ── move X ──
  p.x += p.vx * dt;
  let b = bodyBox(p);
  for (const s of solids) {
    const sb = boxOf(s);
    if (!overlap(b, sb)) continue;
    if (p.vx > 0 || (p.vx === 0 && p.x < s.x + s.w / 2)) p.x = s.x - p.w / 2 - EPS;
    else p.x = s.x + s.w + p.w / 2 + EPS;
    p.vx = 0;
    b = bodyBox(p);
    if (s.kind === 'gate') lockedMessage(w, events);
  }

  // ── move Y ──
  const prevBottom = p.y;
  p.y += p.vy * dt;
  b = bodyBox(p);
  const wasGround = p.onGround;
  p.onGround = false;
  let ceiling = null;
  for (const s of solids) {
    const sb = boxOf(s);
    if (!overlap(b, sb)) continue;
    if (p.vy <= 0) {
      p.y = s.y + s.h; p.vy = 0; p.onGround = true; p.groundMover = null;
    } else {
      p.y = s.y - p.h - EPS; p.vy = 0;
      const d = Math.abs(s.x + s.w / 2 - p.x);
      if (!ceiling || d < ceiling.d) ceiling = { s, d };
    }
    b = bodyBox(p);
  }
  // One-way moving platforms (land from above only)
  if (p.vy <= 0) {
    for (const m of w.movers) {
      const top = m.cy + m.h;
      const prevTop = m.py + m.h;
      const hx = p.x + p.w / 2 > m.cx - m.w / 2 && p.x - p.w / 2 < m.cx + m.w / 2;
      if (hx && prevBottom >= prevTop - 0.08 && p.y <= top + 0.02) {
        p.y = top; p.vy = 0; p.onGround = true; p.groundMover = m.id;
      }
    }
  }
  if (p.onGround && !wasGround) { p.landedAt = w.t; events.push({ type: 'land' }); }
  if (p.onGround) p.cut = false;
  if (ceiling) bump(w, ceiling.s, events);

  // ── pipes ──
  if (input.downPressed && p.onGround) {
    const pipe = pipeUnder(w);
    if (pipe && pipe.target) {
      p.x = pipe.target.x; p.y = pipe.target.y; p.vx = 0; p.vy = 0; p.groundMover = null;
      p.inSecret = pipe.secret === 'enter';
      events.push({ type: 'pipe', into: p.inSecret ? 'secret' : 'main' });
    }
  }

  updateEnemies(w, dt, events);
  updatePlants(w, dt, events);
  updateItems(w, dt, events, solids);
  collectibles(w, events);

  // ── checkpoints & finish ──
  for (const cp of w.level.checkpoints) {
    if (!w.reachedCheckpoints.has(cp.id) && Math.abs(p.x - cp.x) < 0.8 && p.y < 3 && !p.inSecret) {
      w.reachedCheckpoints.add(cp.id);
      w.checkpoint = { x: cp.x, y: cp.y };
      events.push({ type: 'checkpoint' });
    }
  }
  const fin = w.level.finish;
  if (fin && overlap(bodyBox(p), boxOf(fin))) {
    if (gateOpen(w)) {
      w.status = fin.final ? 'victory' : 'finished';
      events.push({ type: w.status });
    } else lockedMessage(w, events);
  }

  // ── falling out of the world ──
  const floor = p.inSecret ? SECRET_FLOOR : 0;
  if (p.y < floor + TUNING.physics.killDepth) {
    w.stats.falls += 1;
    hurt(w, events, true);
  }
}

function lockedMessage(w, events) {
  if (w.t - w.lockMsgAt > 3) {
    w.lockMsgAt = w.t;
    events.push({ type: 'gateLocked', remaining: 5 - w.answered.size });
  }
}

/** The enterable pipe the player is standing on (centred), if any. */
export function pipeUnder(w) {
  const p = w.player;
  if (!p.onGround) return null;
  for (const pipe of w.level.pipes) {
    if (!pipe.target) continue;
    const top = pipe.y + pipe.h;
    if (Math.abs(p.y - top) < 0.05 && Math.abs(p.x - (pipe.x + pipe.w / 2)) < 0.75) return pipe;
  }
  return null;
}

function bump(w, s, events) {
  w.bumps[s.id] = w.t;
  if (s.kind === 'grammar') {
    if (!w.answered.has(s.questionId)) {
      w.status = 'question';
      w.pendingQuestion = { questionId: s.questionId, blockId: s.id };
      events.push({ type: 'question', questionId: s.questionId });
    } else events.push({ type: 'bump' });
    return;
  }
  if (s.kind === 'qblock' && !w.usedBlocks.has(s.id)) {
    w.usedBlocks.add(s.id);
    spawnContent(w, s, s.content, events);
    return;
  }
  if (s.kind === 'brick' && s.hidden && !w.usedBlocks.has(s.id)) {
    w.usedBlocks.add(s.id);
    spawnContent(w, s, s.hidden, events);
    return;
  }
  events.push({ type: 'bump' });
}

function spawnContent(w, s, content, events) {
  const cx = s.x + s.w / 2;
  const top = s.y + s.h;
  if (content === 'coin') {
    w.stats.coins += TUNING.rewards.blockCoin;
    events.push({ type: 'coin', x: cx, y: top + 0.6, fromBlock: true });
  } else if (content === 'star') {
    w.items.push({ id: `i${w.items.length}${s.id}`, kind: 'star', x: cx, y: top, vx: 0, vy: 0, w: 0.8, h: 0.8, rise: 0.6, born: w.t });
    events.push({ type: 'reveal', kind: 'star' });
  } else {
    w.items.push({ id: `i${w.items.length}${s.id}`, kind: content, x: cx, y: top - 1, vx: 0, vy: 0, w: 0.8, h: 0.8, rise: 1, born: w.t, dir: 1 });
    events.push({ type: 'reveal', kind: content });
  }
}

function hurt(w, events, fell = false) {
  const p = w.player;
  if (!fell && (p.invuln > 0 || p.power?.type === 'shield')) return;
  p.hearts -= 1;
  events.push({ type: fell ? 'fall' : 'hurt', hearts: p.hearts });
  if (p.hearts <= 0) {
    w.status = 'gameover';
    events.push({ type: 'gameover' });
    return;
  }
  if (fell) respawn(w);
  else {
    p.invuln = TUNING.player.invulnTime;
    p.vy = TUNING.player.hurtKnockback;
    p.vx = -p.facing * TUNING.player.hurtKnockback * 0.6;
    p.onGround = false; p.groundMover = null;
  }
}

/** Put the player back at the last checkpoint (used after falls and game over). */
export function respawn(w, refill = false) {
  const p = w.player;
  p.x = w.checkpoint.x; p.y = w.checkpoint.y + 0.01;
  p.vx = 0; p.vy = 0; p.inSecret = false; p.groundMover = null;
  p.invuln = TUNING.player.invulnTime;
  if (refill) p.hearts = TUNING.player.maxHearts;
  if (w.status === 'gameover') w.status = 'playing';
}

function updateEnemies(w, dt, events) {
  const E = TUNING.enemy;
  const p = w.player;
  const pb = bodyBox(p);
  for (const e of w.enemies) {
    if (!e.alive) { e.squash += dt; continue; }
    e.x += e.dir * E.speed * dt;
    if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
    if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
    const eb = bodyBox(e);
    if (!overlap(pb, eb)) continue;
    const stomp = p.vy < 0 && p.y > e.y + e.h * 0.45;
    if (stomp || p.power?.type === 'shield') {
      e.alive = false;
      w.stats.stomps += 1;
      if (stomp) p.vy = TUNING.player.stompBounce;
      events.push({ type: 'stomp', x: e.x, y: e.y });
    } else hurt(w, events);
  }
}

function updatePlants(w, dt, events) {
  const T = TUNING.plant;
  const p = w.player;
  for (const pl of w.plants) {
    const near = Math.abs(p.x - pl.x) < 1.6 && p.y >= pl.baseY - 0.1;
    // Don't start emerging while the player stands right next to / on the pipe.
    if (!(near && pl.f <= 0.01)) pl.clock += dt;
    const c = (pl.clock % T.period) / T.period; // 0..1
    // hidden 0-0.35, rising 0.35-0.45, up 0.45-0.8, sinking 0.8-0.9, hidden
    let f = 0;
    if (c < 0.35) f = 0;
    else if (c < 0.45) f = (c - 0.35) / 0.1;
    else if (c < 0.8) f = 1;
    else if (c < 0.9) f = 1 - (c - 0.8) / 0.1;
    pl.f = f;
    if (f > 0.25) {
      const box = { x0: pl.x - T.width / 2, x1: pl.x + T.width / 2, y0: pl.baseY, y1: pl.baseY + T.height * f };
      if (overlap(bodyBox(p), box)) hurt(w, events);
    }
  }
}

function updateItems(w, dt, events, solids) {
  const p = w.player;
  const g = TUNING.player.gravity * 0.8;
  for (const it of w.items) {
    if (it.taken) continue;
    if (it.rise > 0) {
      const d = Math.min(it.rise, dt * 2);
      it.y += d; it.rise -= d;
    } else if (it.kind !== 'star') {
      // Mushrooms slide along and fall, bouncing off walls.
      it.vx = it.dir * TUNING.mushroom.speed;
      it.vy = Math.max(-20, it.vy - g * dt);
      it.x += it.vx * dt;
      let b = bodyBox(it);
      for (const s of solids) {
        if (overlap(b, boxOf(s))) { it.x -= it.vx * dt; it.dir *= -1; b = bodyBox(it); break; }
      }
      it.y += it.vy * dt;
      b = bodyBox(it);
      for (const s of solids) {
        if (overlap(b, boxOf(s))) {
          if (it.vy <= 0) it.y = s.y + s.h; else it.y = s.y - it.h;
          it.vy = 0; b = bodyBox(it);
        }
      }
      if (it.y < -20) it.taken = true;
    }
    if (it.rise <= 0 && overlap(bodyBox(p), bodyBox(it))) {
      it.taken = true;
      if (it.kind === 'star') {
        w.stats.stars += 1;
        events.push({ type: 'star', x: it.x, y: it.y });
      } else {
        const dur = it.kind === 'jump' ? TUNING.power.superJump.duration : TUNING.power.shield.duration;
        p.power = { type: it.kind, t: dur, total: dur };
        events.push({ type: 'power', power: it.kind });
      }
    }
  }
}

function collectibles(w, events) {
  const pb = bodyBox(w.player);
  for (const c of w.level.coins) {
    if (w.takenCoins.has(c.id)) continue;
    if (overlap(pb, { x0: c.x - 0.35, x1: c.x + 0.35, y0: c.y - 0.4, y1: c.y + 0.4 })) {
      w.takenCoins.add(c.id);
      w.stats.coins += TUNING.rewards.coin;
      events.push({ type: 'coin', x: c.x, y: c.y });
    }
  }
  for (const s of w.level.stars) {
    if (w.takenStars.has(s.id)) continue;
    if (overlap(pb, { x0: s.x - 0.5, x1: s.x + 0.5, y0: s.y - 0.5, y1: s.y + 0.5 })) {
      w.takenStars.add(s.id);
      w.stats.stars += 1;
      events.push({ type: 'star', x: s.x, y: s.y });
    }
  }
}

/** Called by the UI when a grammar question is completed (right or revealed). */
export function completeQuestion(w, questionId) {
  w.answered.add(questionId);
  w.pendingQuestion = null;
  if (w.status === 'question') w.status = 'playing';
}

/** Close the question panel without completing it (player can return later). */
export function closeQuestion(w) {
  w.pendingQuestion = null;
  if (w.status === 'question') w.status = 'playing';
  // Nudge down so the block isn't re-triggered instantly.
  w.player.vy = Math.min(w.player.vy, -2);
}

/** 0..1 progress along the stage for the HUD. */
export function progressOf(w) {
  const fin = w.level.finish;
  if (!fin) return 0;
  if (w.player.inSecret) return Math.max(0, Math.min(1, w.level.secret ? (w.level.secret.returnTo.x / fin.x) : 0));
  return Math.max(0, Math.min(1, (w.player.x - w.level.spawn.x) / (fin.x - w.level.spawn.x)));
}
