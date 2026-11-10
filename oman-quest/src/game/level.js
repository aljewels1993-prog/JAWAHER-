import { TUNING } from '../data/tuning.js';
import { questionsForStage } from '../data/questions.js';

/**
 * Builds a stage layout from its generator settings. The result is plain data
 * (no Three.js) so it can be unit-tested and simulated headlessly.
 *
 * Coordinates: x runs along the stage, y is up, ground top is y = 0.
 * A solid is an axis-aligned box {x, y, w, h} where (x, y) is its bottom-left.
 */

/** Small deterministic RNG so each stage always has the same layout. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SECRET_FLOOR = -60;
const GROUND_DEPTH = 8;

export function buildLevel(stage) {
  const { gen } = stage;
  const L = TUNING.level;
  const rnd = mulberry32(gen.seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const range = (a, b) => a + rnd() * (b - a);

  const lv = {
    stageId: stage.id,
    solids: [],
    movers: [],
    coins: [],
    stars: [],
    enemies: [],
    plants: [],
    pipes: [],
    checkpoints: [],
    decor: [],
    grammar: [],
    finish: null,
    gate: null,
    tower: null,
    secret: null,
    spawn: { x: 3, y: 0 },
    length: 0,
    final: !!gen.final,
  };
  let uid = 0;
  const id = (p) => `${p}${uid++}`;
  const solid = (kind, x, y, w, h, extra = {}) => {
    const s = { id: id('s'), kind, x, y, w, h, ...extra };
    lv.solids.push(s);
    return s;
  };
  const ground = (x0, x1, top = 0) => solid('ground', x0, top - GROUND_DEPTH, x1 - x0, GROUND_DEPTH);
  const coin = (x, y) => lv.coins.push({ id: id('c'), x, y });
  const coinArc = (x0, x1, base, height) => {
    const n = Math.max(3, Math.round((x1 - x0) / 0.9));
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      coin(x0 + (x1 - x0) * t, base + Math.sin(Math.PI * t) * height);
    }
  };
  const coinRow = (x0, n, y) => { for (let i = 0; i < n; i++) coin(x0 + i, y); };
  const enemy = (x, minX, maxX, y = 0) => lv.enemies.push({ id: id('e'), x, y, minX, maxX, dir: rnd() < 0.5 ? -1 : 1 });
  const blockContents = ['coin', 'coin', 'coin', 'star', 'jump', 'shield'];

  let x = 0;
  // Start area
  ground(-12, 12);
  lv.decor.push({ type: 'startArch', x: 1.5 });
  coinRow(6, 4, 1.2);
  x = 12;

  // ── chunk builders: each lays ground from x and returns the new x ──
  const chunks = {
    flat() {
      const w = Math.round(range(6, 9));
      ground(x, x + w);
      if (rnd() < 0.6) coinRow(x + 1.5, Math.min(5, w - 2), 1.3);
      return x + w;
    },
    pit() {
      const w0 = 3;
      const gap = Math.round(range(2, L.maxGap) * 2) / 2;
      ground(x, x + w0);
      coinArc(x + w0 - 0.5, x + w0 + gap + 0.5, 1.6, 2.2);
      const after = x + w0 + gap;
      ground(after, after + 4);
      return after + 4;
    },
    mover() {
      // Wide pit crossed by a horizontally moving brick platform.
      const w0 = 2;
      const gap = 9;
      ground(x, x + w0);
      const cx = x + w0 + gap / 2;
      lv.movers.push({ id: id('m'), x: cx, y: 0.6, w: 3, h: 0.5, ax: gap / 2 - 2.2, ay: 0, period: 4.2, phase: rnd() * 6 });
      coinRow(cx - 1, 3, 2.4);
      ground(x + w0 + gap, x + w0 + gap + 4);
      return x + w0 + gap + 4;
    },
    lift() {
      // A vertical lift up to a high brick ledge with a star, then down.
      ground(x, x + 12);
      lv.movers.push({ id: id('m'), x: x + 3, y: 2.2, w: 2.5, h: 0.5, ax: 0, ay: 1.6, period: 3.6, phase: rnd() * 6 });
      solid('brick', x + 6, 4.6, 4, 1);
      lv.stars.push({ id: id('st'), x: x + 8, y: 6.4 });
      coinRow(x + 6.5, 3, 6.2);
      return x + 12;
    },
    enemyRun() {
      const w = Math.round(range(10, 13));
      ground(x, x + w);
      enemy(x + w * 0.6, x + 1, x + w - 1);
      if (rnd() < 0.5) coinRow(x + 2, 4, 3.4);
      return x + w;
    },
    stairs() {
      const heights = [1, 2, 3, 3, 3, 2, 1];
      ground(x, x + heights.length + 2);
      heights.forEach((h, i) => solid('stone', x + 1 + i, 0, 1, h));
      coinRow(x + 3.5, 3, 4.2);
      return x + heights.length + 2;
    },
    blockRow() {
      const w = 10;
      ground(x, x + w);
      const by = L.blockY;
      solid('brick', x + 2, by, 1, 1);
      solid('qblock', x + 3, by, 1, 1, { content: pick(blockContents) });
      solid('brick', x + 4, by, 1, 1);
      solid('qblock', x + 5, by, 1, 1, { content: pick(blockContents) });
      solid('brick', x + 6, by, 1, 1, { hidden: 'coin' });
      if (rnd() < 0.5) enemy(x + 8, x + 1, x + w - 1);
      return x + w;
    },
    floats() {
      // Floating brick platforms over a pit.
      ground(x, x + 2);
      let px = x + 2;
      let py = 0;
      const steps = 3;
      for (let i = 0; i < steps; i++) {
        const gap = range(1.8, 3);
        const rise = i < steps - 1 ? range(1, 2) : -range(0.5, 1.2);
        py = Math.max(1, Math.min(4, py + rise));
        const w = 3;
        solid('brick', px + gap, py - 1, w, 1);
        coinRow(px + gap + 0.5, 3, py + 0.9);
        px += gap + w;
      }
      ground(px + 2, px + 6);
      return px + 6;
    },
    pipePlant() {
      ground(x, x + 9);
      const ph = pick([2, 2.5]);
      const p = { id: id('p'), x: x + 4, y: 0, w: 2, h: ph, plant: true };
      lv.pipes.push(p);
      solid('pipe', p.x, 0, p.w, p.h, { pipeId: p.id });
      lv.plants.push({ id: id('pl'), x: p.x + 1, baseY: ph, phase: rnd() * 4 });
      coinArc(x + 2.5, x + 7.5, ph + 1.5, 1.2);
      return x + 9;
    },
    pipes() {
      ground(x, x + 12);
      const p1 = { id: id('p'), x: x + 2, y: 0, w: 2, h: 2 };
      const p2 = { id: id('p'), x: x + 8, y: 0, w: 2, h: 2.5 };
      for (const p of [p1, p2]) { lv.pipes.push(p); solid('pipe', p.x, 0, p.w, p.h, { pipeId: p.id }); }
      enemy(x + 6, x + 4.2, x + 7.8);
      return x + 12;
    },
    secretPipe() {
      ground(x, x + 22);
      const entry = { id: id('p'), x: x + 3, y: 0, w: 2, h: 2, secret: 'enter' };
      const exit = { id: id('p'), x: x + 17, y: 0, w: 2, h: 2.5, secret: 'exitPoint' };
      lv.pipes.push(entry, exit);
      solid('pipe', entry.x, 0, 2, 2, { pipeId: entry.id });
      solid('pipe', exit.x, 0, 2, 2.5, { pipeId: exit.id });
      // Secret falaj cave far below the stage.
      const sx = x;
      const sy = SECRET_FLOOR;
      solid('cave', sx - 4, sy - GROUND_DEPTH, 34, GROUND_DEPTH);
      solid('cave', sx - 4, sy, 1, 12);
      solid('cave', sx + 29, sy, 1, 12);
      solid('cave', sx - 4, sy + 9, 34, 1);
      const back = { id: id('p'), x: sx + 24, y: sy, w: 2, h: 2, secret: 'leave' };
      lv.pipes.push(back);
      solid('pipe', back.x, sy, 2, 2, { pipeId: back.id });
      for (let r = 0; r < 3; r++) coinRow(sx + 2 + r, 14 - r * 2, sy + 1.2 + r * 1.3);
      lv.stars.push({ id: id('st'), x: sx + 13, y: sy + 6.5 });
      lv.secret = {
        entryId: entry.id, leaveId: back.id,
        arrive: { x: sx + 1, y: sy + 0.01 },
        returnTo: { x: exit.x + 1, y: exit.h + 0.01 },
        bounds: { x0: sx - 4, x1: sx + 30, floor: sy },
      };
      entry.target = lv.secret.arrive;
      back.target = lv.secret.returnTo;
      return x + 22;
    },
  };

  const grammarSpot = (q, idx) => {
    const w = 9;
    ground(x, x + w);
    const gx = x + 4;
    const s = solid('grammar', gx, L.blockY, 1, 1, { questionId: q.id, index: idx });
    lv.grammar.push({ blockId: s.id, questionId: q.id, x: gx + 0.5, y: L.blockY + 0.5 });
    solid('brick', gx - 1, L.blockY, 1, 1);
    solid('brick', gx + 1, L.blockY, 1, 1);
    lv.decor.push({ type: 'sign', x: gx - 2.5, label: `${idx + 1}` });
    return x + w;
  };
  const checkpoint = () => {
    ground(x, x + 6);
    lv.checkpoints.push({ id: id('cp'), x: x + 3, y: 0 });
    return x + 6;
  };

  // Bag of hazards/features sized by the stage's difficulty settings.
  const bag = [];
  const add = (k, n) => { for (let i = 0; i < n; i++) bag.push(k); };
  add('pit', gen.pits);
  add('mover', Math.ceil(gen.movers / 2));
  add('lift', Math.floor(gen.movers / 2));
  add('enemyRun', Math.max(0, gen.enemies - 2));
  add('pipePlant', gen.plants);
  add('pipes', 1);
  add('stairs', 1);
  add('blockRow', 3);
  add('floats', 2);
  add('flat', 2);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  // Secret pipe goes in the first third so it's always discoverable.
  bag.splice(Math.min(3, bag.length), 0, 'secretPipe');

  const qs = questionsForStage(stage.id);
  const perGap = Math.ceil(bag.length / qs.length);
  let bi = 0;
  qs.forEach((q, i) => {
    for (let k = 0; k < perGap && bi < bag.length; k++) x = chunks[bag[bi++]]();
    x = grammarSpot(q, i);
    if (i === 1 || i === 3) x = checkpoint();
  });
  while (bi < bag.length) x = chunks[bag[bi++]]();

  if (lv.final) {
    // Final climb: floating platforms up to the roof of Burj Al Sahwa.
    // Solid ground runs underneath, so a missed jump only means climbing again.
    const climbStart = x;
    x += 6;
    const steps = [
      [2.0, 2.0, false], [2.4, 4.0, false], [2.2, 6.0, true], [2.4, 8.0, false],
      [2.2, 10.0, true], [2.4, 12.0, false], [2.2, 14.0, false],
    ];
    let px = x;
    for (const [gap, top, moving] of steps) {
      if (moving) {
        lv.movers.push({ id: id('m'), x: px + gap + 1.25, y: top - 0.5, w: 2.5, h: 0.5, ax: 0.8, ay: 0, period: 3.2, phase: 0 });
      } else {
        solid('brick', px + gap, top - 1, 2.5, 1);
      }
      coinRow(px + gap + 0.5, 2, top + 1);
      px += gap + 2.5;
    }
    // Tower: four pillars carrying a flat roof whose top is at y = 16.
    const tx = px + 2;
    const tw = 9;
    const roofY = 16;
    ground(climbStart, tx + tw + 12);
    solid('tower', tx, 0, 1.6, roofY - 1);
    solid('tower', tx + tw - 1.6, 0, 1.6, roofY - 1);
    solid('towerRoof', tx, roofY - 1, tw, 1);
    lv.tower = { x: tx, w: tw, roofY, flagX: tx + tw / 2 };
    lv.finish = { x: tx + tw / 2 - 0.6, y: roofY, w: 1.2, h: 4, final: true };
    for (let i = 0; i < 6; i++) lv.stars.push({ id: id('st'), x: tx + 1 + i * 1.4, y: roofY + 2.5 + (i % 2) * 0.8 });
    lv.length = tx + tw + 12;
  } else {
    ground(x, x + 16);
    lv.gate = { x: x + 8, y: 0, w: 1, h: 6 };
    lv.finish = { x: x + 11, y: 0, w: 2, h: 6 };
    lv.decor.push({ type: 'finishArch', x: x + 8.5 });
    lv.length = x + 16;
  }
  // Left wall so the player can't walk off the start.
  solid('wall', -13, 0, 1, 30);
  // Every star a student can find here: placed stars + stars inside ? blocks.
  lv.totalStars = lv.stars.length + lv.solids.filter((s) => s.kind === 'qblock' && s.content === 'star').length;
  return lv;
}
