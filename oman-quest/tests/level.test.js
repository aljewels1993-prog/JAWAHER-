import { describe, it, expect } from 'vitest';
import { STAGES } from '../src/data/stages.js';
import { buildLevel } from '../src/game/level.js';
import { TUNING } from '../src/data/tuning.js';

const P = TUNING.player;
const apex = (v) => (v * v) / (2 * P.gravity);

describe('level generator', () => {
  for (const stage of STAGES) {
    describe(`stage ${stage.id}`, () => {
      const lv = buildLevel(stage);
      it('is deterministic', () => {
        expect(JSON.stringify(buildLevel(stage))).toBe(JSON.stringify(lv));
      });
      it('has 5 grammar blocks with this stage\'s questions, in reach from the ground', () => {
        expect(lv.grammar).toHaveLength(5);
        expect(new Set(lv.grammar.map((g) => g.questionId)).size).toBe(5);
        const blocks = lv.solids.filter((s) => s.kind === 'grammar');
        for (const b of blocks) expect(b.y).toBeLessThan(P.height + apex(P.jumpVelocity) - 0.3);
      });
      it('has coins, enemies, plants, pipes, a secret pipe, checkpoints and a finish', () => {
        expect(lv.coins.length).toBeGreaterThan(40);
        expect(lv.enemies.length).toBeGreaterThanOrEqual(stage.gen.enemies - 2);
        expect(lv.plants.length).toBe(stage.gen.plants);
        expect(lv.pipes.some((p) => p.secret === 'enter')).toBe(true);
        expect(lv.checkpoints.length).toBe(2);
        expect(lv.finish).toBeTruthy();
        expect(lv.movers.length).toBeGreaterThan(0);
        expect(lv.solids.some((s) => s.kind === 'qblock')).toBe(true);
      });
      it('keeps every obstacle on the ground low enough to jump over', () => {
        const maxTop = apex(P.jumpVelocity) - 0.25;
        for (const s of lv.solids.filter((o) => (o.kind === 'pipe') && o.y === 0)) {
          expect(s.h).toBeLessThanOrEqual(maxTop);
        }
      });
      it('never leaves a ground gap wider than a normal jump can cross', () => {
        const ground = lv.solids.filter((s) => s.kind === 'ground' && s.y < 0).sort((a, b) => a.x - b.x);
        let reach = ground[0].x + ground[0].w;
        for (const g of ground.slice(1)) {
          if (g.x > reach + 1e-6) {
            const gap = g.x - reach;
            // gaps either jumpable or crossed by a moving platform / floating bricks
            const bridged = lv.movers.some((m) => m.x > reach && m.x < g.x) ||
              lv.solids.some((s) => s.kind === 'brick' && s.x >= reach - 0.01 && s.x < g.x);
            if (!bridged) expect(gap).toBeLessThanOrEqual(TUNING.level.maxGap + 1e-6);
          }
          reach = Math.max(reach, g.x + g.w);
        }
      });
      if (stage.gen.final) {
        it('ends at Burj Al Sahwa with the flag on the roof', () => {
          expect(lv.tower).toBeTruthy();
          expect(lv.finish.final).toBe(true);
          expect(lv.finish.y).toBe(lv.tower.roofY);
        });
      } else {
        it('has a gate that locks the finish', () => {
          expect(lv.gate.x).toBeLessThan(lv.finish.x);
        });
      }
    });
  }
});
