import { useMemo, useRef, useState, createContext, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  brickTexture, questionTexture, usedBlockTexture, grammarTexture, stoneTexture,
  coinTexture, pipeTexture, toonGradient, omanFlagTexture,
} from './textures.js';
import { TUNING } from '../data/tuning.js';

/** The live sim world, shared with every prop so they can animate from it. */
export const WorldCtx = createContext(null);
export const useWorld = () => useContext(WorldCtx);

const matCache = new Map();
/** Cartoon-shaded material, cached by colour/options. */
export function toon(color, opts = {}) {
  const key = JSON.stringify([color, opts.map?.uuid, opts.emissive, opts.emissiveIntensity, opts.transparent, opts.opacity, opts.side]);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
  matCache.set(key, m);
  return m;
}

const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(1, 24, 16);

// ─────────────────────────────── Blocks ───────────────────────────────
export function Block({ s }) {
  const world = useWorld();
  const ref = useRef();
  const glow = useRef();
  const [state, setState] = useState('fresh');
  const mats = useMemo(() => {
    const T = {
      brick: brickTexture(), qblock: questionTexture(), stone: stoneTexture(),
      grammar: grammarTexture(false),
    }[s.kind];
    if (!T) return null;
    if (s.kind === 'stone' || s.kind === 'brick') {
      const t = T.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, s.w), Math.max(1, s.h)); t.needsUpdate = true;
      return toon('#ffffff', { map: t });
    }
    return toon('#ffffff', { map: T, emissive: s.kind === 'grammar' ? '#5b2bd6' : '#7a5200', emissiveIntensity: s.kind === 'grammar' ? 0.35 : 0.12 });
  }, [s]);
  const usedMat = useMemo(() => (s.kind === 'grammar' ? toon('#ffffff', { map: grammarTexture(true), emissive: '#0aa', emissiveIntensity: 0.25 }) : toon('#ffffff', { map: usedBlockTexture() })), [s.kind]);

  useFrame(({ clock }) => {
    const w = world.current;
    if (!w || !ref.current) return;
    const bt = w.bumps[s.id];
    const k = bt !== undefined ? (w.t - bt) / 0.22 : 2;
    ref.current.position.y = s.y + s.h / 2 + (k < 1 ? Math.sin(k * Math.PI) * 0.3 : 0);
    let next = state;
    if (s.kind === 'grammar') next = w.answered.has(s.questionId) ? 'used' : 'fresh';
    else if (s.kind === 'qblock' || s.hidden) next = w.usedBlocks.has(s.id) ? (s.kind === 'qblock' ? 'used' : 'fresh') : 'fresh';
    if (next !== state) setState(next);
    if (glow.current) {
      const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3);
      glow.current.material.opacity = state === 'used' ? 0 : 0.25 + pulse * 0.35;
      glow.current.scale.setScalar(1.35 + pulse * 0.15);
      glow.current.rotation.z = clock.elapsedTime * 0.6;
    }
  });
  if (!mats) return null;
  return (
    <group>
      <mesh ref={ref} position={[s.x + s.w / 2, s.y + s.h / 2, 0]} scale={[s.w, s.h, 1]} geometry={box} material={state === 'used' ? usedMat : mats} />
      {(s.kind === 'grammar' || s.kind === 'qblock') && (
        <mesh ref={glow} position={[s.x + 0.5, s.y + 0.5, -0.55]}>
          <ringGeometry args={[0.55, 0.85, 8]} />
          <meshBasicMaterial color={s.kind === 'grammar' ? '#c79bff' : '#fff2a0'} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// ─────────────────────────────── Coins ───────────────────────────────
const coinGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.09, 28);
coinGeo.rotateX(Math.PI / 2);
export function coinMaterials() {
  const face = new THREE.MeshStandardMaterial({ map: coinTexture(), metalness: 0.25, roughness: 0.35, emissive: '#ffb000', emissiveIntensity: 0.35, emissiveMap: coinTexture() });
  const edge = new THREE.MeshStandardMaterial({ color: '#ffc21a', metalness: 0.3, roughness: 0.3, emissive: '#c07800', emissiveIntensity: 0.45 });
  return [edge, face, face];
}

export function Coins({ coins }) {
  const world = useWorld();
  const refs = useRef([]);
  const mats = useMemo(coinMaterials, []);
  useFrame(({ clock }) => {
    const w = world.current;
    const t = clock.elapsedTime;
    coins.forEach((c, i) => {
      const m = refs.current[i];
      if (!m) return;
      m.visible = !w.takenCoins.has(c.id);
      m.rotation.y = t * 3 + i * 0.3;
    });
  });
  return coins.map((c, i) => (
    <mesh key={c.id} ref={(el) => { refs.current[i] = el; }} position={[c.x, c.y, 0]} geometry={coinGeo} material={mats} />
  ));
}

// ─────────────────────────────── Stars ───────────────────────────────
export function starGeometry(r = 0.55, inner = 0.26, depth = 0.22) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rad = i % 2 ? inner : r;
    const x = Math.cos(a) * rad; const y = Math.sin(a) * rad;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3 });
  g.center();
  return g;
}
const starGeo = starGeometry();
const eyeGeo = new THREE.CapsuleGeometry(0.035, 0.09, 4, 8);
const starMat = new THREE.MeshStandardMaterial({ color: '#ffd21f', emissive: '#ffb300', emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.35 });
const blackMat = new THREE.MeshBasicMaterial({ color: '#141414' });

export function StarModel({ scale = 1 }) {
  return (
    <group scale={scale}>
      <mesh geometry={starGeo} material={starMat} />
      <mesh geometry={eyeGeo} material={blackMat} position={[-0.09, 0.04, 0.2]} />
      <mesh geometry={eyeGeo} material={blackMat} position={[0.09, 0.04, 0.2]} />
    </group>
  );
}

export function Stars({ stars }) {
  const world = useWorld();
  const refs = useRef([]);
  useFrame(({ clock }) => {
    const w = world.current; const t = clock.elapsedTime;
    stars.forEach((s, i) => {
      const g = refs.current[i]; if (!g) return;
      g.visible = !w.takenStars.has(s.id);
      g.rotation.y = Math.sin(t * 2 + i) * 0.6;
      g.position.y = s.y + Math.sin(t * 2.5 + i) * 0.12;
    });
  });
  return stars.map((s, i) => (
    <group key={s.id} ref={(el) => { refs.current[i] = el; }} position={[s.x, s.y, 0]}>
      <StarModel scale={1.1} />
      <pointLight color="#ffd54a" intensity={2} distance={3} />
    </group>
  ));
}

// ─────────────────────────────── Mushrooms ───────────────────────────────
export function MushroomModel({ kind = 'jump' }) {
  const cap = kind === 'shield' ? '#18c6b4' : '#e3262b';
  const spot = kind === 'shield' ? '#ffd34d' : '#ffffff';
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[0.26, 0.28, 0.26]} geometry={sphere} material={toon('#f6dcb0')} />
      <mesh position={[0, 0.48, 0]} scale={[0.46, 0.34, 0.46]} material={toon(cap)}>
        <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
      </mesh>
      {[[0, 0.78, 0.18, 0.12], [-0.3, 0.6, 0.26, 0.09], [0.3, 0.6, 0.26, 0.09], [0, 0.62, 0.38, 0.1]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[r, r, r * 0.4]} geometry={sphere} material={toon(spot)} />
      ))}
      {[-0.08, 0.08].map((x) => <mesh key={x} position={[x, 0.24, 0.25]} geometry={eyeGeo} material={blackMat} />)}
    </group>
  );
}

/** Mushrooms and stars that pop out of ? blocks during play. */
export function Items() {
  const world = useWorld();
  const [count, setCount] = useState(0);
  const refs = useRef({});
  useFrame(({ clock }) => {
    const w = world.current;
    if (w.items.length !== count) setCount(w.items.length);
    for (const it of w.items) {
      const g = refs.current[it.id]; if (!g) continue;
      g.visible = !it.taken;
      g.position.set(it.x, it.y + (it.kind === 'star' ? 0.4 + Math.sin(clock.elapsedTime * 3) * 0.1 : 0), 0);
      if (it.kind === 'star') g.rotation.y = clock.elapsedTime * 2;
    }
  });
  const w = world.current;
  return (w?.items || []).slice(0, count).map((it) => (
    <group key={it.id} ref={(el) => { refs.current[it.id] = el; }}>
      {it.kind === 'star' ? <StarModel /> : <MushroomModel kind={it.kind} />}
    </group>
  ));
}

// ─────────────────────────────── Pipes ───────────────────────────────
export function Pipe({ p }) {
  const ringRef = useRef();
  const tex = useMemo(() => pipeTexture(), []);
  const body = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.1 }), [tex]);
  const enterable = !!p.target;
  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.position.y = p.y + p.h + 1.1 + Math.sin(clock.elapsedTime * 3) * 0.15;
      ringRef.current.rotation.y = clock.elapsedTime * 2;
    }
  });
  const cx = p.x + p.w / 2;
  return (
    <group>
      <mesh position={[cx, p.y + (p.h - 0.45) / 2, 0]} material={body}>
        <cylinderGeometry args={[0.82, 0.82, p.h - 0.45, 28, 1, true]} />
      </mesh>
      <mesh position={[cx, p.y + p.h - 0.225, 0]} material={body}>
        <cylinderGeometry args={[1.0, 1.0, 0.45, 28]} />
      </mesh>
      <mesh position={[cx, p.y + p.h + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 24]} />
        <meshBasicMaterial color={enterable ? '#063b33' : '#06240b'} />
      </mesh>
      {enterable && (
        <group ref={ringRef} position={[cx, p.y + p.h + 1.1, 0]}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.32, 0.5, 4]} />
            <meshBasicMaterial color="#3ff5e0" />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.16, 0.45, 0.16]} />
            <meshBasicMaterial color="#3ff5e0" />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ─────────────────────────── Snapping plants ───────────────────────────
// An original "desert snap-rose": a red spotted pod with leaf jaws.
export function Plants({ plants }) {
  const world = useWorld();
  const refs = useRef([]);
  const jaws = useRef([]);
  useFrame(({ clock }) => {
    const w = world.current;
    w.plants.forEach((pl, i) => {
      const g = refs.current[i]; if (!g) return;
      g.position.y = pl.baseY - TUNING.plant.height + 0.1 + pl.f * TUNING.plant.height;
      const jaw = jaws.current[i];
      if (jaw) { const o = 0.25 + Math.abs(Math.sin(clock.elapsedTime * 6 + i)) * 0.45; jaw.children[0].rotation.z = o; jaw.children[1].rotation.z = -o; }
    });
  });
  return plants.map((pl, i) => (
    <group key={pl.id} ref={(el) => { refs.current[i] = el; }} position={[pl.x, pl.baseY - 1.3, 0]}>
      <mesh position={[0, 0.45, 0]} material={toon('#2e9c3a')}><cylinderGeometry args={[0.09, 0.12, 0.9, 10]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.25, 0.35, 0]} rotation={[0, 0, s * -0.8]} scale={[0.32, 0.1, 0.18]} geometry={sphere} material={toon('#47c24a')} />
      ))}
      <group ref={(el) => { jaws.current[i] = el; }} position={[0, 1.1, 0]}>
        {[1, -1].map((s) => (
          <group key={s}>
            <mesh position={[0, s * 0.12, 0]} scale={[0.42, 0.28, 0.4]} geometry={sphere} material={toon('#d81f2a')} />
            {[[-0.18, s * 0.28, 0.25], [0.2, s * 0.22, 0.3], [0, s * 0.33, -0.2]].map(([x, y, z], k) => (
              <mesh key={k} position={[x, y, z]} scale={[0.08, 0.06, 0.06]} geometry={sphere} material={toon('#ffffff')} />
            ))}
            {[-0.24, -0.08, 0.08, 0.24].map((x) => (
              <mesh key={x} position={[x, s * -0.02, 0.28]} rotation={[0, 0, s > 0 ? Math.PI : 0]}>
                <coneGeometry args={[0.05, 0.12, 4]} />
                <meshBasicMaterial color="#fff" />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  ));
}

// ─────────────────────────── Grumpy Dates (enemies) ───────────────────────────
// Original enemy: a walking date fruit with a cap and cross eyebrows.
export function GrumpyDate() {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} scale={[0.42, 0.5, 0.38]} geometry={sphere} material={toon('#7a3b16')} />
      <mesh position={[0.1, 0.72, 0.22]} scale={[0.1, 0.06, 0.06]} geometry={sphere} material={toon('#c0703a')} />
      <mesh position={[0, 0.98, 0]} material={toon('#c99a3b')}><coneGeometry args={[0.12, 0.14, 6]} /></mesh>
      {[-0.14, 0.14].map((x) => (
        <group key={x} position={[x, 0.58, 0.34]}>
          <mesh scale={[0.1, 0.12, 0.05]} geometry={sphere} material={toon('#ffffff')} />
          <mesh position={[0, -0.02, 0.04]} scale={[0.045, 0.06, 0.03]} geometry={sphere} material={blackMat} />
          <mesh position={[0, 0.14, 0.03]} rotation={[0, 0, x > 0 ? 0.5 : -0.5]} scale={[0.13, 0.03, 0.03]} geometry={box} material={blackMat} />
        </group>
      ))}
      <mesh position={[0, 0.34, 0.36]} rotation={[0, 0, Math.PI]} scale={[0.1, 0.03, 0.03]} material={blackMat}>
        <torusGeometry args={[1, 0.6, 6, 12, Math.PI]} />
      </mesh>
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} name="foot" position={[x, 0.07, 0.05]} scale={[0.16, 0.08, 0.2]} geometry={sphere} material={toon('#3a1a08')} />
      ))}
    </group>
  );
}

export function Enemies({ enemies }) {
  const world = useWorld();
  const refs = useRef([]);
  useFrame(({ clock }) => {
    const w = world.current; const t = clock.elapsedTime;
    w.enemies.forEach((e, i) => {
      const g = refs.current[i]; if (!g) return;
      g.position.set(e.x, e.y, 0);
      if (e.alive) {
        g.scale.set(1, 1 + Math.sin(t * 10 + i) * 0.05, 1);
        g.rotation.y = e.dir > 0 ? 0.5 : -0.5;
        g.rotation.z = Math.sin(t * 10 + i) * 0.08;
        g.visible = true;
      } else {
        g.scale.set(1.3, Math.max(0.15, 0.3 - e.squash), 1.3);
        g.visible = e.squash < 0.6;
      }
    });
  });
  return enemies.map((e, i) => (
    <group key={e.id} ref={(el) => { refs.current[i] = el; }}><GrumpyDate /></group>
  ));
}

// ─────────────────────────── Moving platforms ───────────────────────────
export function Movers({ movers }) {
  const world = useWorld();
  const refs = useRef([]);
  const mat = useMemo(() => {
    const t = brickTexture().clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 0.5); t.needsUpdate = true;
    return toon('#ffffff', { map: t });
  }, []);
  useFrame(() => {
    world.current.movers.forEach((m, i) => {
      const g = refs.current[i]; if (g) g.position.set(m.cx, m.cy + m.h / 2, 0);
    });
  });
  return movers.map((m, i) => (
    <group key={m.id} ref={(el) => { refs.current[i] = el; }}>
      <mesh scale={[m.w, m.h, 1.2]} geometry={box} material={mat} />
      <mesh position={[0, m.h / 2 + 0.02, 0]} scale={[m.w * 0.98, 0.06, 1.18]} geometry={box} material={toon('#ffd34d')} />
    </group>
  ));
}

// ─────────────────────────── Flags, checkpoints, gates ───────────────────────────
export function WavingFlag({ width = 1.6, height = 0.8, raised = 1 }) {
  const ref = useRef();
  const geo = useMemo(() => new THREE.PlaneGeometry(width, height, 16, 4), [width, height]);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: omanFlagTexture(), side: THREE.DoubleSide, roughness: 0.8 }), []);
  useFrame(({ clock }) => {
    const pos = geo.attributes.position;
    const t = clock.elapsedTime;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3] + width / 2; // 0 at the pole
      pos.array[i * 3 + 2] = Math.sin(x * 3 - t * 5) * 0.12 * (x / width);
      pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(x * 2 - t * 4) * 0.04 * (x / width);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    if (ref.current) ref.current.scale.y = raised;
  });
  return <mesh ref={ref} geometry={geo} material={mat} position={[width / 2, 0, 0]} />;
}

export function Checkpoint({ cp }) {
  const world = useWorld();
  const flag = useRef();
  useFrame((_, dt) => {
    const on = world.current.reachedCheckpoints.has(cp.id);
    if (flag.current) flag.current.position.y += ((on ? 3.1 : 0.9) - flag.current.position.y) * Math.min(1, dt * 4);
  });
  return (
    <group position={[cp.x, 0, -0.6]}>
      <mesh position={[0, 1.8, 0]} material={toon('#d9d9d9')}><cylinderGeometry args={[0.06, 0.06, 3.6, 8]} /></mesh>
      <mesh position={[0, 3.65, 0]} material={toon('#ffd34d')}><sphereGeometry args={[0.13, 12, 8]} /></mesh>
      <group ref={flag} position={[0.05, 0.9, 0]}><WavingFlag width={1.3} height={0.65} /></group>
      <mesh position={[0, 0.15, 0]} material={toon('#c9a26b')}><cylinderGeometry args={[0.35, 0.45, 0.3, 8]} /></mesh>
    </group>
  );
}

/** Omani-style arched gate. Locked (closed doors + padlock) until all 5 questions are done. */
export function GateArch({ x, locked = false, label }) {
  const world = useWorld();
  const doors = useRef();
  const lock = useRef();
  const mat = toon('#e8d3a8');
  const trim = toon('#c9952e');
  useFrame((_, dt) => {
    const w = world.current;
    const open = !locked || w.answered.size >= 5;
    if (doors.current) {
      const [l, r] = doors.current.children;
      const target = open ? 1.9 : 0;
      l.rotation.y += (target - l.rotation.y) * Math.min(1, dt * 3);
      r.rotation.y += (-target - r.rotation.y) * Math.min(1, dt * 3);
    }
    if (lock.current) lock.current.visible = !open;
  });
  return (
    <group position={[x, 0, 0]}>
      {[-1.5, 1.5].map((dx) => (
        <group key={dx} position={[dx, 0, 0]}>
          <mesh position={[0, 3, 0]} scale={[1, 6, 1.6]} geometry={box} material={mat} />
          {[-0.3, 0, 0.3].map((z) => <mesh key={z} position={[0, 6.2, z * 1.5]} scale={[0.3, 0.4, 0.3]} geometry={box} material={mat} />)}
        </group>
      ))}
      <mesh position={[0, 6.5, 0]} scale={[4, 1.2, 1.6]} geometry={box} material={mat} />
      <mesh position={[0, 5.4, 0.02]} scale={[2, 1.4, 1.62]} material={trim}>
        <coneGeometry args={[1, 1, 4, 1, false, Math.PI / 4]} />
      </mesh>
      {[-1.6, -0.8, 0, 0.8, 1.6].map((dx) => <mesh key={dx} position={[dx, 7.3, 0]} scale={[0.4, 0.4, 1.6]} geometry={box} material={mat} />)}
      {locked && (
        <group ref={doors} position={[0, 0, 0.2]}>
          <group position={[-1, 0, 0]}><mesh position={[0.5, 2.4, 0]} scale={[1, 4.8, 0.2]} geometry={box} material={toon('#7a4a24')} /></group>
          <group position={[1, 0, 0]}><mesh position={[-0.5, 2.4, 0]} scale={[1, 4.8, 0.2]} geometry={box} material={toon('#7a4a24')} /></group>
        </group>
      )}
      {locked && (
        <group ref={lock} position={[0, 2.6, 0.45]}>
          <mesh scale={[0.5, 0.45, 0.2]} geometry={box} material={toon('#18c6b4', { emissive: '#0aa', emissiveIntensity: 0.5 })} />
          <mesh position={[0, 0.3, 0]}><torusGeometry args={[0.16, 0.05, 8, 16, Math.PI]} /><meshStandardMaterial color="#ccc" metalness={0.8} /></mesh>
        </group>
      )}
      {label}
    </group>
  );
}
