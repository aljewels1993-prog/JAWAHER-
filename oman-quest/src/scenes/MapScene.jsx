import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { STAGES } from '../data/stages.js';
import { useGame } from '../game/store.js';
import { isStageUnlocked } from '../game/progress.js';
import { toon, WavingFlag, StarModel } from './Props.jsx';
import { Sky, Cloud, Palm } from './Environment.jsx';
import { BurjAlSahwa } from './Burj.jsx';
import { HeroPuppet } from './Hero.jsx';

/**
 * 3D adventure map. Oman's outline (mainland + Musandam) is extruded into a
 * sandy-green island; the 10 stage markers sit on their governorates and are
 * joined by a golden path.
 */
const MAINLAND = [
  [56.37, 24.98], [56.6, 24.5], [57.0, 24.05], [57.5, 23.75], [58.1, 23.65], [58.6, 23.6], [58.95, 23.35], [59.4, 22.85],
  [59.83, 22.5], [59.7, 22.15], [59.3, 21.5], [58.9, 21.0], [58.5, 20.55], [58.1, 20.4], [57.8, 20.05], [57.75, 19.6],
  [57.8, 19.05], [57.3, 18.85], [56.6, 18.4], [56.2, 17.95], [55.4, 17.6], [55.0, 17.2], [54.6, 16.98], [54.1, 17.0],
  [53.6, 16.8], [53.1, 16.68], [52.0, 16.65], [52.0, 19.0], [55.0, 20.0], [55.66, 22.0], [55.2, 22.7], [55.6, 23.6],
  [55.8, 24.2], [56.0, 24.6],
];
const MUSANDAM = [[56.08, 26.06], [56.2, 26.38], [56.42, 26.36], [56.5, 26.1], [56.36, 25.86], [56.12, 25.72]];

export const toMap = ([lon, lat]) => [(lon - 56) * 2.3, -(lat - 21.5) * 2.3];

function landGeometry(points, depth = 0.8) {
  const shape = new THREE.Shape();
  points.forEach((p, i) => { const [x, z] = toMap(p); if (i === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z); });
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.3, bevelSegments: 3 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function Marker({ stage, unlocked, done, current, onPick }) {
  const ref = useRef();
  const [x, z] = toMap(stage.map);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.children[0].scale.setScalar(unlocked ? 1 + Math.sin(t * 3 + stage.id) * 0.08 : 1);
    ref.current.children[0].rotation.y = t * 0.8;
  });
  const color = done ? '#ffd34d' : unlocked ? '#5ff2df' : '#8a7f99';
  return (
    <group ref={ref} position={[x, 1.1, z]} onClick={(e) => { e.stopPropagation(); onPick(stage.id); }}
      onPointerOver={() => { document.body.style.cursor = unlocked ? 'pointer' : 'not-allowed'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.85, 1, 0.5, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={unlocked ? 0.6 : 0.1} />
      </mesh>
      <mesh position={[0, 1.6, 0]} material={toon('#eeeeee')}><cylinderGeometry args={[0.05, 0.05, 2.4, 6]} /></mesh>
      {unlocked ? <group position={[0.03, 2.4, 0]}><WavingFlag width={1.1} height={0.55} /></group> : (
        <group position={[0, 1.2, 0]}>
          <mesh material={toon('#5a5266')}><boxGeometry args={[0.6, 0.5, 0.3]} /></mesh>
          <mesh position={[0, 0.35, 0]}><torusGeometry args={[0.18, 0.06, 8, 16, Math.PI]} /><meshStandardMaterial color="#aaa" metalness={0.8} /></mesh>
        </group>
      )}
      {done && <TreasureChest position={[1.2, 0.2, 0.4]} open />}
      {current && <mesh position={[0, 3.6, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.35, 0.6, 4]} /><meshBasicMaterial color="#ff3d6e" /></mesh>}
      <NumberBadge n={stage.id} />
    </group>
  );
}

function NumberBadge({ n }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#4b1f9e'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.strokeStyle = '#ffd34d'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 68);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [n]);
  return <sprite position={[-1.1, 1.0, 0]} scale={0.9}><spriteMaterial map={tex} /></sprite>;
}

export function TreasureChest({ position, open }) {
  const lid = useRef();
  useFrame(({ clock }) => { if (lid.current) lid.current.rotation.x = open ? -1.1 + Math.sin(clock.elapsedTime * 2) * 0.05 : 0; });
  return (
    <group position={position} scale={0.55}>
      <mesh position={[0, 0.4, 0]} material={toon('#8a4f22')}><boxGeometry args={[1.2, 0.8, 0.8]} /></mesh>
      <mesh position={[0, 0.4, 0.41]} material={toon('#ffd34d')}><boxGeometry args={[0.2, 0.8, 0.02]} /></mesh>
      <group ref={lid} position={[0, 0.8, -0.4]}>
        <mesh position={[0, 0.15, 0.4]} material={toon('#9c5a28')}><boxGeometry args={[1.2, 0.3, 0.8]} /></mesh>
      </group>
      {open && <mesh position={[0, 0.85, 0]}><sphereGeometry args={[0.38, 12, 8]} /><meshStandardMaterial color="#ffd34d" emissive="#ffb300" emissiveIntensity={0.8} metalness={0.6} /></mesh>}
    </group>
  );
}

function GoldenPath({ points }) {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 1.05, z)));
    return new THREE.TubeGeometry(curve, 200, 0.12, 8, false);
  }, [points]);
  return <mesh geometry={geo}><meshStandardMaterial color="#ffd34d" emissive="#d99a00" emissiveIntensity={0.6} metalness={0.5} roughness={0.3} /></mesh>;
}

function HeroOnMap({ stageId }) {
  const ref = useRef();
  const state = useRef({ vx: 0, vy: 0, onGround: true, facing: 1 });
  const target = toMap(STAGES[stageId - 1].map);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const p = ref.current.position;
    const tx = target[0] + 0.9; const tz = target[1] + 0.9;
    const dx = tx - p.x; const dz = tz - p.z;
    p.x += dx * Math.min(1, dt * 2.5); p.z += dz * Math.min(1, dt * 2.5);
    const moving = Math.hypot(dx, dz) > 0.1;
    state.current = { vx: moving ? 5 : 0, vy: 0, onGround: true, facing: dx < -0.05 ? -1 : 1 };
  });
  return <group ref={ref} position={[target[0] + 0.9, 1.1, target[1] + 0.9]} scale={0.9}><HeroPuppet state={state} /></group>;
}

function Mountains() {
  // Al Hajar range in the north and the Dhofar hills in the south
  const peaks = [[57.0, 23.25, 2.6], [57.3, 23.15, 3.2], [57.6, 23.1, 2.8], [58.0, 23.2, 2.4], [56.8, 23.5, 2.2], [58.4, 23.1, 2], [56.2, 24.3, 1.8], [53.8, 17.25, 1.6], [54.5, 17.3, 1.8], [56.25, 26.1, 1.4]];
  return peaks.map(([lon, lat, h], i) => {
    const [x, z] = toMap([lon, lat]);
    return (
      <group key={i} position={[x, 1, z]}>
        <mesh position={[0, h / 2, 0]} material={toon('#9a7b5c')}><coneGeometry args={[h * 0.8, h, 6]} /></mesh>
        <mesh position={[0, h * 0.86, 0]} material={toon('#c9b29a')}><coneGeometry args={[h * 0.24, h * 0.3, 6]} /></mesh>
      </group>
    );
  });
}

export default function MapScene({ onPick }) {
  const profile = useGame((s) => s.profile);
  const selected = useGame((s) => s.mapSelected) || 1;
  const { camera, size } = useThree();
  const land = useMemo(() => landGeometry(MAINLAND), []);
  const mus = useMemo(() => landGeometry(MUSANDAM), []);
  const pathPts = useMemo(() => STAGES.map((s) => toMap(s.map)), []);
  const current = STAGES.find((s) => !profile?.stages[s.id]?.completed)?.id || 10;
  const burjAt = toMap(STAGES[9].map);

  useFrame((_, dt) => {
    const aspect = size.width / size.height;
    const [sx, sz] = toMap(STAGES[selected - 1].map);
    const dist = aspect < 1 ? 30 : 22;
    const target = new THREE.Vector3(sx * 0.5, dist, sz * 0.5 + dist * 0.75);
    camera.position.lerp(target, Math.min(1, dt * 2));
    camera.lookAt(sx * 0.5, 0, sz * 0.5 - 1);
  });

  return (
    <>
      <Sky top="#4fb7f5" bottom="#d6f3ff" />
      <hemisphereLight args={['#ffffff', '#6a8a9a', 1.1]} />
      <directionalLight position={[10, 30, 15]} intensity={1.8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}><planeGeometry args={[220, 220]} /><meshStandardMaterial color="#2ba7d6" roughness={0.3} /></mesh>
      <mesh geometry={land} material={toon('#e8c48a')} />
      <mesh geometry={mus} material={toon('#d9b27a')} />
      {[[54.2, 17.2, 2.2], [57.6, 23.0, 1.6], [56.9, 24.2, 1.4], [55.8, 24.2, 0.9]].map(([lon, lat, r], i) => {
        const [x, z] = toMap([lon, lat]);
        return <mesh key={`g${i}`} position={[x, 1.06, z]} rotation={[-Math.PI / 2, 0, 0]} material={toon('#8fcf5a')}><circleGeometry args={[r, 20]} /></mesh>;
      })}
      <Mountains />
      {[[56.9, 24.3], [57.6, 23.6], [54.2, 17.1], [57.5, 22.8], [58.5, 23.6], [55.8, 24.1]].map(([lon, lat], i) => {
        const [x, z] = toMap([lon, lat]);
        return <group key={i} position={[x + 0.6, 1, z + 0.4]} scale={0.35}><Palm x={0} z={0} /></group>;
      })}
      <GoldenPath points={pathPts} />
      {STAGES.map((s) => (
        <Marker key={s.id} stage={s} unlocked={!!profile && isStageUnlocked(profile, s.id)} done={!!profile?.stages[s.id]?.completed} current={s.id === current} onPick={onPick} />
      ))}
      <group position={[burjAt[0] + 2.4, 1, burjAt[1] - 1.2]} scale={0.16}><BurjAlSahwa showFlag /></group>
      <HeroOnMap stageId={selected} />
      {[[-12, 8, -8], [14, 9, 4], [-14, 8, 10], [12, 8, -12]].map((p, i) => <Cloud key={i} position={p} scale={0.8} />)}
      <group position={[toMap([52.8, 18.5])[0], 3, toMap([52.8, 18.5])[1]]}><StarModel scale={1.4} /></group>
    </>
  );
}
