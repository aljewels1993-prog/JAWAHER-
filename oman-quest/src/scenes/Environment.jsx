import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { toon } from './Props.jsx';
import { mulberry32, SECRET_FLOOR } from '../game/level.js';
import { groundSideTexture, groundTopTexture, skyTexture, cloudFaceTexture, stoneTexture } from './textures.js';

const sphere = new THREE.SphereGeometry(1, 24, 16);
const box = new THREE.BoxGeometry(1, 1, 1);

/** Gradient sky dome that follows the camera. */
export function Sky({ top, bottom }) {
  const ref = useRef();
  const { camera } = useThree();
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: skyTexture(top, bottom), side: THREE.BackSide, depthWrite: false, fog: false }), [top, bottom]);
  useFrame(() => { if (ref.current) ref.current.position.copy(camera.position); });
  return <mesh ref={ref} material={mat} renderOrder={-10}><sphereGeometry args={[400, 32, 16]} /></mesh>;
}

// ───────────────────────────── scenery pieces ─────────────────────────────
export function Cloud({ position, scale = 1, face = true }) {
  const faceMat = useMemo(() => new THREE.MeshBasicMaterial({ map: cloudFaceTexture(), transparent: true, depthWrite: false }), []);
  const white = toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.25 });
  return (
    <group position={position} scale={scale}>
      {[[0, 0, 0, 1.3], [-1.2, -0.3, 0, 0.9], [1.2, -0.25, 0, 0.95], [-0.5, 0.6, 0, 0.9], [0.6, 0.55, 0, 0.85]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[r, r * 0.85, r * 0.8]} geometry={sphere} material={white} />
      ))}
      {face && <mesh position={[0, 0.1, 1.06]}><planeGeometry args={[1.6, 1.6]} /><primitive object={faceMat} attach="material" /></mesh>}
    </group>
  );
}

function Hill({ x, z, r, h, color, spots }) {
  return (
    <group position={[x, 0, z]}>
      <mesh scale={[r, h, r * 0.6]} geometry={sphere} material={toon(color)} />
      {spots && [[-0.3, 0.55], [0.25, 0.7], [0.05, 0.35]].map(([sx, sy], i) => (
        <mesh key={i} position={[sx * r, sy * h, r * 0.48]} scale={[r * 0.08, r * 0.05, 0.05]} geometry={sphere} material={toon('#9be37c')} />
      ))}
    </group>
  );
}

function Mountain({ x, z, h, color }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} material={toon(color)}><coneGeometry args={[h * 0.9, h, 7]} /></mesh>
      <mesh position={[h * 0.5, h * 0.33, 1]} material={toon(color)}><coneGeometry args={[h * 0.6, h * 0.66, 6]} /></mesh>
    </group>
  );
}

export function Palm({ x, z, h = 4.5, lean = 0.15 }) {
  const fronds = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    fronds.push(
      <mesh key={i} position={[Math.cos(a) * 0.9, -0.2, Math.sin(a) * 0.9]} rotation={[Math.sin(a) * 0.9, -a, Math.cos(a) * -0.9 + 0.2]} scale={[1.4, 0.08, 0.35]} geometry={sphere} material={toon(i % 2 ? '#2f9a3a' : '#3fbf4a')} />,
    );
  }
  return (
    <group position={[x, 0, z]} rotation={[0, 0, lean]}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0, (i + 0.5) * (h / 6), 0]} material={toon(i % 2 ? '#a26b3a' : '#8a5a2e')}><cylinderGeometry args={[0.2 - i * 0.012, 0.24 - i * 0.012, h / 6, 8]} /></mesh>
      ))}
      <group position={[0, h, 0]}>
        {fronds}
        {[[-0.2, 0.1], [0.2, 0], [0, -0.2]].map(([dx, dz], i) => <mesh key={i} position={[dx, -0.35, dz]} scale={0.16} geometry={sphere} material={toon('#a8541a')} />)}
      </group>
    </group>
  );
}

/** Omani fort: sandstone walls, crenellations, a round tower and a carved door. */
export function Fort({ x, z, s = 1 }) {
  const stone = toon('#d8b07a');
  const dark = toon('#b98d58');
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 2, 0]} scale={[7, 4, 4]} geometry={box} material={stone} />
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[-3.2 + i * 0.8, 4.3, 2]} scale={[0.45, 0.6, 0.3]} geometry={box} material={stone} />)}
      <mesh position={[4.2, 3, 0.5]} material={stone}><cylinderGeometry args={[1.6, 1.8, 6, 20]} /></mesh>
      <mesh position={[4.2, 6.2, 0.5]} material={dark}><cylinderGeometry args={[1.75, 1.6, 0.5, 20]} /></mesh>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <mesh key={i} position={[4.2 + Math.cos(a) * 1.6, 6.7, 0.5 + Math.sin(a) * 1.6]} scale={[0.4, 0.55, 0.3]} rotation={[0, -a, 0]} geometry={box} material={stone} />;
      })}
      <mesh position={[0, 1.2, 2.02]} material={toon('#6a3c1c')}><planeGeometry args={[1.4, 2.4]} /></mesh>
      <mesh position={[0, 2.6, 2.03]} rotation={[0, 0, Math.PI / 4]} material={toon('#6a3c1c')}><planeGeometry args={[1, 1]} /></mesh>
      {[-2.2, 2.2].map((wx) => <mesh key={wx} position={[wx, 2.8, 2.02]} material={toon('#5a3a22')}><planeGeometry args={[0.35, 0.8]} /></mesh>)}
      <mesh position={[-3, 5.4, 0]} material={toon('#d9d9d9')}><cylinderGeometry args={[0.05, 0.05, 2.4, 6]} /></mesh>
    </group>
  );
}

function Dhow({ x, z }) {
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) { ref.current.position.y = -0.2 + Math.sin(clock.elapsedTime + x) * 0.15; ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.8 + x) * 0.04; } });
  const sail = useMemo(() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(3, 0.5); s.lineTo(-0.5, 4); s.lineTo(0, 0); return new THREE.ShapeGeometry(s); }, []);
  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh scale={[3.2, 0.8, 1]} material={toon('#8a5228')}><sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /></mesh>
      <mesh position={[0, 2.2, 0]} material={toon('#5a3a1c')}><cylinderGeometry args={[0.07, 0.09, 4.4, 6]} /></mesh>
      <mesh geometry={sail} position={[-0.2, 0.9, 0.05]} material={toon('#fff6e0', { side: THREE.DoubleSide })} />
    </group>
  );
}

function Sea({ y = -0.6, z = -14 }) {
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) ref.current.material.color.setHSL(0.53, 0.75, 0.5 + Math.sin(clock.elapsedTime * 0.6) * 0.03); });
  return <mesh ref={ref} position={[0, y, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2000, 30]} /><meshStandardMaterial color="#2fb4d8" roughness={0.2} metalness={0.1} /></mesh>;
}

function Bush({ x, z, s = 1 }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      {[[0, 0.5, 0.7], [-0.6, 0.35, 0.5], [0.6, 0.35, 0.55]].map(([bx, by, r], i) => <mesh key={i} position={[bx, by, 0]} scale={r} geometry={sphere} material={toon(i ? '#3aa845' : '#4cc257')} />)}
    </group>
  );
}

function Frankincense({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.8, 0]} rotation={[0, 0, 0.2]} material={toon('#9c7b5c')}><cylinderGeometry args={[0.12, 0.25, 1.6, 7]} /></mesh>
      <mesh position={[0.4, 1.7, 0]} rotation={[0, 0, -0.6]} material={toon('#9c7b5c')}><cylinderGeometry args={[0.07, 0.12, 1.1, 6]} /></mesh>
      <mesh position={[0.6, 2.2, 0]} scale={[1.1, 0.5, 0.8]} geometry={sphere} material={toon('#6fa64a')} />
      <mesh position={[-0.3, 1.8, 0]} scale={[0.8, 0.4, 0.6]} geometry={sphere} material={toon('#7cb856')} />
    </group>
  );
}

function Dune({ x, z, r }) {
  return <mesh position={[x, 0, z]} scale={[r, r * 0.32, r * 0.5]} geometry={sphere} material={toon('#f1c27a')} />;
}

function Camel({ x, z }) {
  const c = toon('#c8925a');
  return (
    <group position={[x, 0, z]} scale={0.8}>
      <mesh position={[0, 1.6, 0]} scale={[1.1, 0.55, 0.5]} geometry={sphere} material={c} />
      <mesh position={[0, 2.15, 0]} scale={[0.5, 0.45, 0.4]} geometry={sphere} material={c} />
      <mesh position={[1.2, 2.2, 0]} rotation={[0, 0, -0.6]} material={c}><cylinderGeometry args={[0.13, 0.18, 1.1, 8]} /></mesh>
      <mesh position={[1.6, 2.65, 0]} scale={[0.35, 0.2, 0.2]} geometry={sphere} material={c} />
      {[[-0.6, 0.25], [-0.6, -0.25], [0.6, 0.25], [0.6, -0.25]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.6, lz]} material={c}><cylinderGeometry args={[0.07, 0.07, 1.2, 6]} /></mesh>
      ))}
      <mesh position={[0, 1.9, 0]} scale={[0.6, 0.12, 0.55]} geometry={box} material={toon('#c0262d')} />
    </group>
  );
}

function Tent({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1, 0]} rotation={[0, Math.PI / 4, 0]} material={toon('#3b2a24')}><coneGeometry args={[2.2, 2, 4]} /></mesh>
      {[-1, 0, 1].map((i) => <mesh key={i} position={[i * 0.7, 0.9, 1.55]} scale={[0.3, 1.8, 0.02]} geometry={box} material={toon(i ? '#c0262d' : '#e8b54a')} />)}
    </group>
  );
}

function BeehiveTomb({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.3, 0]} material={toon('#a88d6c')}><cylinderGeometry args={[0.6, 1.3, 2.6, 12]} /></mesh>
      <mesh position={[0, 2.7, 0]} material={toon('#9a7f60')}><coneGeometry args={[0.65, 0.4, 12]} /></mesh>
    </group>
  );
}

function Falaj({ x, z }) {
  return (
    <group position={[x, 0.05, z]}>
      <mesh scale={[8, 0.3, 0.8]} geometry={box} material={toon('#d6b58a')} />
      <mesh position={[0, 0.16, 0]} scale={[7.8, 0.02, 0.45]} geometry={box}><meshStandardMaterial color="#45c9e8" emissive="#1a8fb0" emissiveIntensity={0.3} /></mesh>
    </group>
  );
}

function Rock({ x, z, s }) {
  return <mesh position={[x, s * 0.4, z]} scale={[s, s * 0.7, s * 0.8]} rotation={[0.3, x, 0.2]} material={toon('#a08068')}><dodecahedronGeometry args={[1, 0]} /></mesh>;
}

const DECOR = { palm: Palm, fort: Fort, bush: Bush, frankincense: Frankincense, rock: Rock, dune: Dune, camel: Camel, tent: Tent, beehive: BeehiveTomb, falaj: Falaj, mountain: null, dhow: null };

/** All scenery for one stage, laid out deterministically from the stage seed. */
export function Scenery({ stage, length }) {
  const th = stage.theme;
  const items = useMemo(() => {
    const rnd = mulberry32(stage.gen.seed * 7 + 3);
    const out = [];
    for (let x = -20; x < length + 40; x += 14 + rnd() * 10) {
      out.push({ k: 'hill', x: x + rnd() * 6, z: -12 - rnd() * 6, r: 7 + rnd() * 6, h: 4 + rnd() * 5 });
      if (rnd() < 0.5) out.push({ k: 'farhill', x: x + rnd() * 8, z: -30 - rnd() * 10, r: 14 + rnd() * 8, h: 10 + rnd() * 6 });
    }
    for (let x = -10; x < length + 20; x += 30 + rnd() * 20) out.push({ k: 'cloud', x, y: 9 + rnd() * 6, z: -8 - rnd() * 16, s: 0.9 + rnd() * 0.8 });
    if (th.deco.includes('mountain') || th.ground === 'rock') for (let x = 0; x < length + 40; x += 22 + rnd() * 14) out.push({ k: 'mountain', x, z: -45 - rnd() * 15, h: 16 + rnd() * 12 });
    const near = th.deco.filter((d) => !['mountain', 'dhow'].includes(d));
    for (let x = 4; x < length; x += 7 + rnd() * 9) out.push({ k: near[Math.floor(rnd() * near.length)], x, z: -4 - rnd() * 4, s: 0.8 + rnd() * 0.4 });
    if (th.deco.includes('dhow')) for (let x = 20; x < length; x += 60) out.push({ k: 'dhow', x: x + rnd() * 20, z: -16 });
    return out;
  }, [stage, length]);

  const cloudRefs = useRef([]);
  useFrame(({ clock }) => {
    cloudRefs.current.forEach((c, i) => { if (c) c.position.x = c.userData.x0 + Math.sin(clock.elapsedTime * 0.1 + i) * 4; });
  });

  return (
    <group>
      {th.sea && <Sea />}
      {items.map((it, i) => {
        if (it.k === 'hill') return <Hill key={i} x={it.x} z={it.z} r={it.r} h={it.h} color={th.hills} spots />;
        if (it.k === 'farhill') return <Hill key={i} x={it.x} z={it.z} r={it.r} h={it.h} color={th.far} />;
        if (it.k === 'mountain') return <Mountain key={i} x={it.x} z={it.z} h={it.h} color={th.ground === 'rock' ? '#7d6355' : '#9a7b5c'} />;
        if (it.k === 'dhow') return <Dhow key={i} x={it.x} z={it.z} />;
        if (it.k === 'cloud') return (
          <group key={i} ref={(el) => { if (el) { el.userData.x0 = it.x; cloudRefs.current[i] = el; } }} position={[it.x, it.y, it.z]}>
            <Cloud position={[0, 0, 0]} scale={it.s} face={i % 2 === 0} />
          </group>
        );
        const C = DECOR[it.k];
        if (!C) return null;
        if (it.k === 'rock') return <Rock key={i} x={it.x} z={it.z} s={it.s} />;
        if (it.k === 'dune') return <Dune key={i} x={it.x} z={it.z - 4} r={5 * it.s} />;
        return <C key={i} x={it.x} z={it.z} s={it.s} />;
      })}
      {th.mist && <fog attach="fog" args={['#d9f4ff', 40, 160]} />}
      {th.dusk && <fog attach="fog" args={['#e9b8a0', 50, 180]} />}
    </group>
  );
}

/** Ground segments: a grass/sand/rock lip on top of a layered soil block. */
export function GroundPieces({ solids, kind }) {
  const items = useMemo(() => solids.filter((s) => s.kind === 'ground' || s.kind === 'cave' || s.kind === 'wall'), [solids]);
  const mats = useMemo(() => {
    const side = groundSideTexture(kind); const top = groundTopTexture(kind);
    return { side, top };
  }, [kind]);
  return items.map((s) => {
    if (s.kind === 'wall') return null;
    if (s.kind === 'cave') {
      return <mesh key={s.id} position={[s.x + s.w / 2, s.y + s.h / 2, 0]} scale={[s.w, s.h, 4]} geometry={box} material={toon('#6b4a3a', { map: stoneTexture() })} />;
    }
    const sideT = mats.side.clone(); sideT.wrapS = sideT.wrapT = THREE.RepeatWrapping; sideT.repeat.set(s.w / 2, 1); sideT.needsUpdate = true;
    const topT = mats.top.clone(); topT.wrapS = topT.wrapT = THREE.RepeatWrapping; topT.repeat.set(s.w / 2, 2); topT.needsUpdate = true;
    const side = toon('#ffffff', { map: sideT });
    const top = toon('#ffffff', { map: topT });
    return (
      <mesh key={s.id} position={[s.x + s.w / 2, s.y + s.h / 2, -0.5]} material={[side, side, top, side, side, side]}>
        <boxGeometry args={[s.w, s.h, 5]} />
      </mesh>
    );
  });
}

/** Dark falaj cave backdrop for the secret area. */
export function SecretCave({ secret }) {
  if (!secret) return null;
  const { x0, x1, floor } = secret.bounds;
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, floor + 5, -2.6]}><planeGeometry args={[x1 - x0, 12]} /><meshStandardMaterial color="#3a2a40" /></mesh>
      <mesh position={[(x0 + x1) / 2, floor + 0.05, 0.6]} scale={[x1 - x0 - 2, 0.1, 0.7]} geometry={box}><meshStandardMaterial color="#47d6f0" emissive="#1aa7c7" emissiveIntensity={0.6} /></mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <pointLight key={i} position={[x0 + 3 + i * 5.5, floor + 6, 1]} color={i % 2 ? '#ffd34d' : '#5ff2df'} intensity={6} distance={9} />
      ))}
    </group>
  );
}

export { SECRET_FLOOR };
