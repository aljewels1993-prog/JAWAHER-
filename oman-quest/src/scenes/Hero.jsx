import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { loadImageTexture } from './textures.js';
import rig from '../assets/hero-rig.json';
import { TUNING } from '../data/tuning.js';

import bodyUrl from '../assets/hero-body.png';
import legLUrl from '../assets/hero-leg-l.png';
import legRUrl from '../assets/hero-leg-r.png';

/**
 * The hero is the student's own Omani character, built as a puppet from her
 * original artwork (body + two legs cut along the robe hem) so her face,
 * clothing, colours and jewellery stay exactly as designed. The puppet is
 * animated in 3D: running leg swings, squash & stretch, a card-turn when she
 * changes direction, and a celebration spin.
 */
export const HERO_HEIGHT = 2.2;
const RUN_SPEED = TUNING.player.runSpeed;
const S = HERO_HEIGHT / rig.height; // world units per source pixel
const W = rig.width * S;
const HIP = (rig.height - rig.hipY) * S; // leg pieces start here (from the feet)
const BODY_BOTTOM = (rig.height - rig.splitY) * S;
const LEG_L_W = rig.gapX * S;
const LEG_R_W = (rig.width - rig.gapX) * S;

function partMaterial(url) {
  return new THREE.MeshBasicMaterial({ map: loadImageTexture(url), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, toneMapped: false });
}

/**
 * Props:
 *  - state: ref to { vx, vy, onGround, facing, invuln, power, celebrate, landedAt, t,
 *            skid, idleFor, emote: { type, start } }
 *    emote types (short reactions): cheer · hop · spin · learn · wave · ouch · sad
 */
export const EMOTE_LENGTH = { cheer: 1.5, hop: 0.35, spin: 0.8, learn: 1.3, wave: 1.6, ouch: 0.5, sad: 1.8 };
export function HeroPuppet({ state }) {
  const root = useRef();
  const turn = useRef();
  const body = useRef();
  const legL = useRef();
  const legR = useRef();
  const aura = useRef();
  const shield = useRef();
  const anim = useRef({ phase: 0, yaw: 0, look: 0, run: 0, air: 0, legL: 0, legR: 0, lean: 0, fade: 1 });
  const mats = useMemo(() => ({ body: partMaterial(bodyUrl), l: partMaterial(legLUrl), r: partMaterial(legRUrl) }), []);

  useFrame(({ clock }, rawDt) => {
    const s = state.current;
    if (!s || !root.current) return;
    const dt = Math.min(rawDt, 0.05);
    const a = anim.current;
    const t = clock.elapsedTime;
    // frame-rate independent smoothing toward a target
    const ease = (cur, target, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
    const speed = Math.abs(s.vx || 0);
    const speedFrac = Math.min(1, speed / RUN_SPEED);
    const moving = s.onGround && speed > 0.15;

    // facing: smooth card-turn (rotate around Y; the back face shows her mirrored)
    a.yaw = ease(a.yaw, s.facing < 0 ? Math.PI : 0, 12);
    // standing still for a while: she turns slightly toward the player and holds it
    a.look = ease(a.look, (s.idleFor || 0) > 3 ? 0.22 : 0, 2);
    turn.current.rotation.y = a.yaw + a.look;
    // keep the legs behind the robe whichever way she faces
    const back = Math.cos(a.yaw) < 0 ? -1 : 1;
    legL.current.position.z = -0.02 * back;
    legR.current.position.z = -0.025 * back;

    // ── legs: steps follow her real speed, at a natural child's cadence ──
    a.run = ease(a.run, moving ? Math.max(0.3, speedFrac) : 0, 7);
    if (moving) a.phase += dt * Math.PI * 2 * (0.8 + 0.7 * speedFrac); // ≤ 1.5 strides/s (3 steps/s)
    const stride = Math.sin(a.phase) * 0.32 * a.run;
    a.air = ease(a.air, s.onGround ? 0 : 1, 12);
    // in the air: legs trail back while rising, reach forward to land
    const airL = s.vy > 0.5 ? -0.1 : 0.1;
    const airR = s.vy > 0.5 ? -0.18 : 0.04;
    a.legL = ease(a.legL, stride * (1 - a.air) + airL * a.air, 16);
    a.legR = ease(a.legR, -stride * (1 - a.air) + airR * a.air, 16);

    // ── body: one soft bob per step and a slight forward lean ──
    const bob = ((1 - Math.cos(a.phase * 2)) / 2) * 0.022 * a.run * (1 - a.air);
    let leanTarget = -0.035 * a.run * (1 - a.air) - 0.015 * a.air;
    if (s.skid) leanTarget = 0.04; // leaning back as she brakes to turn
    let lift = 0;
    let spin = 0;
    let legsExtra = 0;
    let squashY = 1;

    // final celebration on Burj Al Sahwa: calm, smooth hops
    if (s.celebrate) {
      lift = 0.22 * (0.5 - 0.5 * Math.cos(t * 4));
      spin = 0.35 * Math.sin(t * 1.2);
    }

    // short reactions — each one smooth and single, no shaking
    const e = s.emote;
    const k = e ? (t - e.start) / (EMOTE_LENGTH[e.type] || 1) : 2;
    if (!s.celebrate && k >= 0 && k < 1) {
      const arc = Math.sin(k * Math.PI); // 0 → 1 → 0
      const turnK = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k); // ease in-out
      if (e.type === 'cheer') { lift = arc * 0.2; spin = turnK * Math.PI * 2; legsExtra = -0.06 * arc; }
      else if (e.type === 'hop') lift = arc * 0.08;
      else if (e.type === 'spin') { lift = arc * 0.08; spin = turnK * Math.PI * 2; }
      else if (e.type === 'wave') lift = arc * 0.05;
      else if (e.type === 'learn') leanTarget = -0.03 * arc; // a single thoughtful nod
      else if (e.type === 'sad') { leanTarget = -0.06 * arc; squashY = 1 - 0.02 * arc; }
      else if (e.type === 'ouch') leanTarget = 0.1 * arc;
    }
    a.lean = ease(a.lean, leanTarget, 6);

    root.current.position.y = lift;
    root.current.scale.set(1, squashY, 1);
    turn.current.rotation.y += spin;
    body.current.position.y = BODY_BOTTOM + bob;
    body.current.rotation.z = a.lean;
    legL.current.rotation.z = a.legL + legsExtra;
    legR.current.rotation.z = a.legR + legsExtra;

    // hurt: a soft fade instead of fast blinking
    a.fade = ease(a.fade, s.invuln > 0 ? 0.55 + 0.2 * Math.cos(t * 6) : 1, 10);
    mats.body.opacity = a.fade; mats.l.opacity = a.fade; mats.r.opacity = a.fade;
    root.current.visible = true;
    if (typeof window !== 'undefined' && window.__oeq) window.__oeq.heroAnim = a; // for automated motion checks

    // power-ups
    if (aura.current) {
      aura.current.visible = s.power === 'jump';
      aura.current.rotation.y = t * 4;
      aura.current.children.forEach((c, i) => { c.position.y = 0.2 + ((t * 1.5 + i * 0.25) % 2.2); });
    }
    if (shield.current) {
      shield.current.visible = s.power === 'shield';
      shield.current.material.opacity = 0.22 + Math.sin(t * 6) * 0.06;
      shield.current.rotation.y = t;
    }
  });

  return (
    <group ref={root}>
      <group ref={turn}>
        {/* legs pivot at the hip, drawn just behind the body */}
        <group ref={legL} position={[-W / 2 + LEG_L_W / 2, HIP, -0.02]}>
          <mesh position={[0, -HIP / 2, 0]} material={mats.l}><planeGeometry args={[LEG_L_W, HIP]} /></mesh>
        </group>
        <group ref={legR} position={[-W / 2 + LEG_L_W + LEG_R_W / 2, HIP, -0.025]}>
          <mesh position={[0, -HIP / 2, 0]} material={mats.r}><planeGeometry args={[LEG_R_W, HIP]} /></mesh>
        </group>
        <group ref={body} position={[0, BODY_BOTTOM, 0]}>
          <mesh position={[0, (HERO_HEIGHT - BODY_BOTTOM) / 2, 0]} material={mats.body}>
            <planeGeometry args={[W, HERO_HEIGHT - BODY_BOTTOM]} />
          </mesh>
        </group>
      </group>
      <group ref={aura} visible={false}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[Math.cos(i * 0.8) * 0.7, 0, Math.sin(i * 0.8) * 0.7]}>
            <octahedronGeometry args={[0.07]} />
            <meshBasicMaterial color={i % 2 ? '#ff4d4d' : '#ffd34d'} />
          </mesh>
        ))}
      </group>
      <mesh ref={shield} position={[0, 1.1, 0]} visible={false}>
        <sphereGeometry args={[1.25, 24, 16]} />
        <meshBasicMaterial color="#ffd34d" transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  );
}
