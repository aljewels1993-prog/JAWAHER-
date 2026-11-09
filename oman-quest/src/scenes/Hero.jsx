import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { loadImageTexture } from './textures.js';
import rig from '../assets/hero-rig.json';

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
 *  - state: ref to { vx, vy, onGround, facing, invuln, power, celebrate, landedAt, t }
 */
export function HeroPuppet({ state }) {
  const root = useRef();
  const turn = useRef();
  const body = useRef();
  const legL = useRef();
  const legR = useRef();
  const aura = useRef();
  const shield = useRef();
  const anim = useRef({ phase: 0, yaw: 0, squash: 1 });
  const mats = useMemo(() => ({ body: partMaterial(bodyUrl), l: partMaterial(legLUrl), r: partMaterial(legRUrl) }), []);

  useFrame(({ clock }, dt) => {
    const s = state.current;
    if (!s || !root.current) return;
    const a = anim.current;
    const t = clock.elapsedTime;
    const speed = Math.abs(s.vx || 0);
    const running = s.onGround && speed > 0.4;

    // facing: smooth card-turn (rotate around Y; the back face shows her mirrored)
    const targetYaw = s.facing < 0 ? Math.PI : 0;
    a.yaw += (targetYaw - a.yaw) * Math.min(1, dt * 12);
    turn.current.rotation.y = a.yaw;
    // keep the legs behind the robe whichever way she faces
    const back = Math.cos(a.yaw) < 0 ? -1 : 1;
    legL.current.position.z = -0.02 * back;
    legR.current.position.z = -0.025 * back;

    // legs
    let swing = 0; let tuckL = 0; let tuckR = 0;
    if (running) { a.phase += dt * (6 + speed * 1.3); swing = Math.sin(a.phase) * Math.min(0.55, 0.15 + speed * 0.06); }
    else if (!s.onGround) { tuckL = s.vy > 0 ? 0.45 : 0.15; tuckR = s.vy > 0 ? -0.25 : -0.1; }
    else a.phase = 0;
    legL.current.rotation.z = swing + tuckL;
    legR.current.rotation.z = -swing + tuckR;

    // squash & stretch
    const sinceLand = (s.t ?? t) - (s.landedAt ?? -10);
    let sy = 1;
    if (!s.onGround) sy = 1 + Math.min(0.08, Math.abs(s.vy) * 0.004);
    else if (sinceLand < 0.15) sy = 0.9 + (sinceLand / 0.15) * 0.1;
    else if (!running) sy = 1 + Math.sin(t * 2.4) * 0.012; // breathing
    a.squash += (sy - a.squash) * Math.min(1, dt * 20);
    root.current.scale.set(1 + (1 - a.squash) * 0.6, a.squash, 1);

    // body bob + lean while running
    body.current.position.y = BODY_BOTTOM + (running ? Math.abs(Math.sin(a.phase)) * 0.06 : 0);
    body.current.rotation.z = running ? -0.06 : (!s.onGround ? -0.04 : 0);

    // celebration: hop and spin
    if (s.celebrate) {
      const c = t * 2.2;
      root.current.position.y = Math.abs(Math.sin(c * 2)) * 0.6;
      turn.current.rotation.y = a.yaw + (Math.floor(c / Math.PI) % 2 ? Math.sin(c) * Math.PI : 0);
      legL.current.rotation.z = 0.3 * Math.sin(c * 4);
      legR.current.rotation.z = -0.3 * Math.sin(c * 4);
    } else root.current.position.y = 0;

    // hurt blink
    root.current.visible = !(s.invuln > 0 && Math.floor(t * 14) % 2 === 0);

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
