import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, restoredIds } from '../game/store.js';
import { CITY_LAYOUT, COINS, PLAYER_START, collide, nearestBuilding } from '../game/city.js';
import { input, readMove } from '../game/input.js';
import { sfx } from '../game/audio.js';
import { Girl, Bear } from './Characters.jsx';
import { Building } from './Buildings.jsx';
import { Sky, Sun, Clouds, City, Coin, Confetti, Sparkles, Tree } from './World.jsx';

const PI = Math.PI;

/** Height and width of each building, used to fit it on the showcase stage. */
const DIMS = {
  castle: [8.5, 8], harbour: [5.5, 10], stadium: [6.5, 11], tower: [16.6, 5], skyscraper: [23, 5], factory: [9, 9],
  hospital: [6.5, 9], palace: [8.5, 10], swimming_pool: [3.2, 10], sports_centre: [7, 9], office_building: [13, 6.5], apartment_building: [9.5, 7.5],
};

function useMood() {
  const bubble = useGame((s) => s.bubble);
  const stageMood = useGame((s) => s.stage.mood);
  return stageMood !== 'idle' ? stageMood : bubble ? bubble.mood || 'talk' : 'idle';
}

/** Camera that adapts to portrait (phones) vs landscape. */
function StageCamera({ pos = [0, 6, 17], look = [0, 2.6, 0] }) {
  const { camera, size } = useThree();
  useFrame(() => {
    const aspect = size.width / size.height;
    const k = aspect < 1 ? Math.min(1.9, 1.15 / aspect) : 1;
    const target = new THREE.Vector3(pos[0], pos[1] + (k - 1) * 2.5, pos[2] * k);
    camera.position.lerp(target, 0.08);
    // On portrait screens the UI covers the bottom, so aim lower to lift the scene up.
    camera.lookAt(look[0], look[1] - (aspect < 1 ? 3.2 * (k - 0.6) : 0.4), look[2]);
  });
  return null;
}

/* ---------------- Hub: whole city seen from the sky ---------------- */
export function HubScene() {
  const progress = useGame((s) => s.progress);
  const restored = useMemo(() => restoredIds(progress), [progress]);
  const { camera, size } = useThree();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.06;
    const aspect = size.width / size.height;
    const r = 58 * Math.max(1, 1.25 / aspect);
    camera.position.set(Math.sin(t) * r, 34 + (aspect < 1 ? 20 : 0), Math.cos(t) * r);
    camera.lookAt(0, aspect < 1 ? -8 : 0, 0);
  });
  return (
    <>
      <Sky />
      <Sun size={45} />
      <Clouds count={10} spread={110} height={30} />
      <City restored={restored} />
      <Girl position={[-1.6, 0, 13.5]} cheer scale={1.4} />
      <Bear position={[1.8, 0, 13.2]} mood="happy" scale={1.2} />
    </>
  );
}

/* ---------------- Stage: island showcase used by levels 1, 2, 4, 5 ---------------- */
function Showcase({ id }) {
  const group = useRef();
  const pop = useRef(0);
  const celebrate = useGame((s) => s.stage.celebrate);
  const jump = useRef(0);
  useEffect(() => { pop.current = 0; }, [id]);
  useEffect(() => { jump.current = 1; }, [celebrate]);
  const [h, w] = DIMS[id] || [6, 8];
  const fit = Math.min(6.2 / h, 8.5 / w);
  useFrame(({ clock }, d) => {
    pop.current = Math.min(1, pop.current + d * 2.5);
    jump.current = Math.max(0, jump.current - d * 1.5);
    const e = 1 - (1 - pop.current) ** 3;
    const over = Math.sin(pop.current * PI) * 0.15;
    group.current.scale.setScalar(fit * (e + over));
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.5) * 0.55;
    group.current.position.y = 0.4 + Math.sin(jump.current * PI * 3) * jump.current * 0.8;
  });
  return <group ref={group} position={[0, 0.4, -1]}><Building id={id} /></group>;
}

function MysteryBox() {
  const ref = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ref.current.rotation.set(t * 0.6, t * 0.9, 0);
    ref.current.position.y = 3 + Math.sin(t * 2) * 0.3;
  });
  return (
    <group ref={ref} position={[0, 3, -1]}>
      <mesh castShadow><boxGeometry args={[2.4, 2.4, 2.4]} /><meshStandardMaterial color="#8e24aa" emissive="#6a1b9a" emissiveIntensity={0.3} /></mesh>
      {[[0, 0, 1.21], [0, 0, -1.21], [1.21, 0, 0], [-1.21, 0, 0]].map((p, i) => (
        <mesh key={i} position={p} rotation={[0, i < 2 ? 0 : PI / 2, 0]}><planeGeometry args={[1.2, 1.2]} /><meshBasicMaterial color="#ffd23f" transparent opacity={0.9} side={THREE.DoubleSide} /></mesh>
      ))}
    </group>
  );
}

export function StageScene() {
  const building = useGame((s) => s.stage.building);
  const celebrate = useGame((s) => s.stage.celebrate);
  const mood = useMood();
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    if (!celebrate) return undefined;
    setCheer(true);
    const t = setTimeout(() => setCheer(false), 1800);
    return () => clearTimeout(t);
  }, [celebrate]);
  return (
    <>
      <Sky top="#4fc3f7" bottom="#ffd6f6" far={140} />
      <Sun position={[12, 20, 14]} size={16} />
      <StageCamera />
      <Clouds count={7} spread={70} height={16} />
      <mesh position={[0, -0.6, 0]} rotation={[-PI / 2, 0, 0]}><circleGeometry args={[120, 48]} /><meshStandardMaterial color="#2ec4d6" roughness={0.25} /></mesh>
      <mesh position={[0, -0.3, 0]} receiveShadow><cylinderGeometry args={[10, 10.6, 0.8, 48]} /><meshStandardMaterial color="#f3dca0" /></mesh>
      <mesh position={[0, 0.12, 0]} receiveShadow><cylinderGeometry args={[9.6, 9.8, 0.25, 48]} /><meshStandardMaterial color="#86d65f" roughness={1} /></mesh>
      <mesh position={[0, 0.3, -1]} receiveShadow><cylinderGeometry args={[5.2, 5.4, 0.25, 40]} /><meshStandardMaterial color="#ce93d8" /></mesh>
      <mesh position={[0, 0.44, -1]} rotation={[-PI / 2, 0, 0]}><ringGeometry args={[4.6, 5.0, 40]} /><meshBasicMaterial color="#ffd23f" /></mesh>
      {building ? <Showcase key={building} id={building} /> : <MysteryBox />}
      <Girl position={[-5.2, 0.25, 3]} rotation={[0, 0.5, 0]} cheer={cheer} />
      <Bear position={[5.4, 0.25, 2.2]} rotation={[0, -0.5, 0]} scale={0.95} mood={cheer ? 'happy' : mood} />
      <Tree position={[-7.5, 0.25, -4]} s={1.2} />
      <Tree position={[7.8, 0.25, -3.5]} s={1.1} c="#66bb6a" />
      <Tree position={[-8.2, 0.25, 1.5]} s={0.9} c="#2e7d32" />
      <Coin position={[-3, 1.2, 6]} />
      <Coin position={[3, 1.2, 6.2]} />
      <Sparkles position={[0, 0.5, -1]} radius={5} count={40} />
      <Confetti trigger={celebrate} origin={[0, 7, 0]} />
    </>
  );
}

/* ---------------- City Explorer: walk around the 3D city ---------------- */
function lerpAngle(a, b, t) {
  let d = ((b - a + PI) % (2 * PI)) - PI;
  if (d < -PI) d += 2 * PI;
  return a + d * t;
}

function Player() {
  const girl = useRef();
  const bear = useRef();
  const arrow = useRef();
  const motion = useRef({ speed: 0, air: false });
  const bearMotion = useRef({ speed: 0 });
  const st = useRef({ x: PLAYER_START.x, z: PLAYER_START.z, y: 0, vy: 0, rot: PI, near: null });
  const bst = useRef({ x: PLAYER_START.x + 2.5, z: PLAYER_START.z + 2 });
  const { camera, size } = useThree();

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = st.current;
    const game = useGame.getState();
    const playing = game.city.playing;
    const mv = playing ? readMove() : { x: 0, y: 0 };
    const len = Math.hypot(mv.x, mv.y);
    if (len > 0.05) {
      [s.x, s.z] = collide(s.x + mv.x * 9 * dt, s.z + mv.y * 9 * dt);
      s.rot = lerpAngle(s.rot, Math.atan2(mv.x, mv.y), 0.25);
    }
    motion.current.speed = len;
    if (input.jump) {
      input.jump = false;
      if (playing && s.y <= 0.001) { s.vy = 11; sfx.jump(); }
    }
    s.vy -= 30 * dt;
    s.y = Math.max(0, s.y + s.vy * dt);
    if (s.y === 0) s.vy = 0;
    motion.current.air = s.y > 0.05;
    girl.current.position.set(s.x, s.y, s.z);
    girl.current.rotation.y = s.rot;

    // Bear follows a little behind.
    const b = bst.current;
    const tx = s.x - Math.sin(s.rot) * 2.6 + Math.cos(s.rot) * 1.6;
    const tz = s.z - Math.cos(s.rot) * 2.6 - Math.sin(s.rot) * 1.6;
    const dx = tx - b.x; const dz = tz - b.z; const dist = Math.hypot(dx, dz);
    if (dist > 0.3) {
      const step = Math.min(dist, (dist > 4 ? 12 : 7.5) * dt);
      b.x += (dx / dist) * step; b.z += (dz / dist) * step;
      bear.current.rotation.y = lerpAngle(bear.current.rotation.y, Math.atan2(dx, dz), 0.2);
    }
    bearMotion.current.speed = dist > 0.3 ? 1 : 0;
    bear.current.position.set(b.x, 0, b.z);

    // Camera follows from above and behind.
    const aspect = size.width / size.height;
    const k = aspect < 1 ? 1.5 : 1;
    camera.position.lerp(new THREE.Vector3(s.x, 15 * k, s.z + 17 * k), 0.08);
    camera.lookAt(s.x, 1.5 - (aspect < 1 ? 4 : 0), s.z - 2);

    if (!playing) return;

    // Coins.
    const taken = game.city.coinsTaken;
    for (const c of COINS) {
      if (!taken.includes(c.id) && Math.hypot(c.x - s.x, c.z - s.z) < 1.4 && s.y < 2.5) {
        game.setCity({ coinsTaken: [...taken, c.id] });
        game.addCoin();
        sfx.coin();
        break;
      }
    }

    // Visiting a building.
    const near = nearestBuilding(s.x, s.z);
    const id = near?.id || null;
    if (id !== s.near) {
      s.near = id;
      if (id) game.setCity({ visit: { id, at: performance.now() } });
    }

    // Hint arrow points at the target building.
    const target = CITY_LAYOUT.find((x) => x.id === game.city.target);
    arrow.current.visible = !!(game.city.hint && target);
    if (target) {
      arrow.current.position.set(s.x, s.y + 4.4, s.z);
      arrow.current.rotation.y = Math.atan2(target.x - s.x, target.z - s.z);
    }
  });

  return (
    <>
      <group ref={girl}><Girl motion={motion} /></group>
      <group ref={bear} scale={0.75}><Bear motion={bearMotion} /></group>
      <group ref={arrow} visible={false}>
        <mesh rotation={[PI / 2, 0, 0]} position={[0, 0, 0.9]}>
          <coneGeometry args={[0.5, 1.2, 4]} />
          <meshStandardMaterial color="#ffd23f" emissive="#ffb300" emissiveIntensity={0.8} />
        </mesh>
        <mesh rotation={[PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 1, 8]} /><meshStandardMaterial color="#ffd23f" emissive="#ffb300" emissiveIntensity={0.8} /></mesh>
      </group>
    </>
  );
}

function CityCoins() {
  const taken = useGame((s) => s.city.coinsTaken);
  return COINS.map((c) => <Coin key={c.id} position={[c.x, 1.1, c.z]} visible={!taken.includes(c.id)} />);
}

export function CityScene() {
  const found = useGame((s) => s.city.found);
  const target = useGame((s) => s.city.target);
  const progress = useGame((s) => s.progress);
  const celebrate = useGame((s) => s.stage.celebrate);
  const restored = useMemo(() => [...new Set([...restoredIds(progress), ...found])], [progress, found]);
  const tgt = CITY_LAYOUT.find((b) => b.id === found[found.length - 1]);
  return (
    <>
      <Sky />
      <Sun size={45} />
      <Clouds count={10} spread={110} height={30} />
      <City restored={restored} highlight={target} />
      <CityCoins />
      <Player />
      <Confetti trigger={celebrate} origin={tgt ? [tgt.x, 12, tgt.z] : [0, 12, 0]} />
    </>
  );
}

/* ---------------- Golden Treasure ---------------- */
function Key({ position, got, index }) {
  const ref = useRef();
  const appear = useRef(got ? 1 : 0);
  useFrame(({ clock }, d) => {
    if (got) appear.current = Math.min(1, appear.current + d * 1.5);
    const t = clock.elapsedTime + index;
    ref.current.rotation.y = got ? t * 1.5 + (1 - appear.current) * 10 : 0;
    ref.current.position.y = position[1] + Math.sin(t * 2) * 0.15 + (1 - appear.current) * 4;
    ref.current.scale.setScalar(0.4 + 0.6 * appear.current);
  });
  const m = got
    ? <meshStandardMaterial color="#ffd23f" metalness={0.85} roughness={0.2} emissive="#ffa000" emissiveIntensity={0.5} />
    : <meshStandardMaterial color="#ffffff" transparent opacity={0.25} />;
  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 0.55, 0]}><torusGeometry args={[0.38, 0.12, 10, 22]} />{m}</mesh>
      <mesh position={[0, -0.35, 0]}><boxGeometry args={[0.16, 1.4, 0.16]} />{m}</mesh>
      <mesh position={[0.2, -0.8, 0]}><boxGeometry args={[0.3, 0.14, 0.14]} />{m}</mesh>
      <mesh position={[0.17, -0.55, 0]}><boxGeometry args={[0.24, 0.14, 0.14]} />{m}</mesh>
    </group>
  );
}

function Trophy({ show }) {
  const ref = useRef();
  const k = useRef(0);
  const profile = useMemo(() => [
    [0, 0], [0.9, 0], [0.9, 0.15], [0.3, 0.3], [0.2, 0.9], [0.5, 1.1], [1.0, 1.6], [1.15, 2.6], [1.0, 2.6], [0.85, 1.7], [0, 1.4],
  ].map(([x, y]) => new THREE.Vector2(x, y)), []);
  useFrame(({ clock }, d) => {
    k.current = show ? Math.min(1, k.current + d * 0.6) : 0;
    ref.current.visible = k.current > 0;
    ref.current.position.y = 1.2 + k.current * 3.2;
    ref.current.rotation.y = clock.elapsedTime * 1.2;
    ref.current.scale.setScalar(k.current);
  });
  const gold = <meshStandardMaterial color="#ffd23f" metalness={0.9} roughness={0.18} emissive="#ff8f00" emissiveIntensity={0.35} side={THREE.DoubleSide} />;
  return (
    <group ref={ref} position={[0, 1.2, 0]} visible={false}>
      <mesh castShadow><latheGeometry args={[profile, 32]} />{gold}</mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 1.15, 2.0, 0]} rotation={[0, 0, s * 0.2]}><torusGeometry args={[0.38, 0.09, 8, 18, PI * 1.3]} />{gold}</mesh>)}
      <mesh position={[0, 3.3, 0]}><octahedronGeometry args={[0.45]} /><meshStandardMaterial color="#e91e8c" emissive="#e91e8c" emissiveIntensity={0.6} /></mesh>
    </group>
  );
}

function Fountain({ on }) {
  const mesh = useRef();
  const N = 60;
  const parts = useMemo(() => Array.from({ length: N }, (_, i) => ({ t: i / N })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, d) => {
    mesh.current.visible = on;
    if (!on) return;
    parts.forEach((p, i) => {
      p.t = (p.t + d * 0.6) % 1;
      const a = i * 2.4;
      const r = p.t * 3.2;
      dummy.position.set(Math.cos(a) * r, 2 + p.t * 7 - p.t * p.t * 8, Math.sin(a) * r);
      dummy.rotation.set(p.t * 10, a, 0);
      dummy.scale.setScalar(1 - p.t * 0.4);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
      <cylinderGeometry args={[0.22, 0.22, 0.06, 14]} />
      <meshStandardMaterial color="#ffd23f" metalness={0.8} roughness={0.2} emissive="#ffb300" emissiveIntensity={0.5} />
    </instancedMesh>
  );
}

function Chest({ open }) {
  const lid = useRef();
  const beam = useRef();
  useFrame(({ clock }) => {
    lid.current.rotation.x = THREE.MathUtils.lerp(lid.current.rotation.x, open ? -1.9 : 0, 0.05);
    beam.current.visible = open;
    beam.current.material.opacity = 0.35 + Math.sin(clock.elapsedTime * 4) * 0.1;
  });
  const wood = '#8d4f22';
  const gold = { color: '#ffd23f', metalness: 0.85, roughness: 0.25, emissive: '#ff9800', emissiveIntensity: 0.25 };
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[3.2, 1.8, 2.2]} /><meshStandardMaterial color={wood} /></mesh>
      {[-1.2, 1.2].map((x) => <mesh key={x} position={[x, 0.9, 0]}><boxGeometry args={[0.25, 1.85, 2.25]} /><meshStandardMaterial {...gold} /></mesh>)}
      <mesh position={[0, 1.4, 1.13]}><boxGeometry args={[0.6, 0.7, 0.12]} /><meshStandardMaterial {...gold} /></mesh>
      <group ref={lid} position={[0, 1.8, -1.1]}>
        <mesh position={[0, 0, 1.1]} rotation={[0, 0, PI / 2]} castShadow>
          <cylinderGeometry args={[1.1, 1.1, 3.2, 24, 1, false, 0, PI]} />
          <meshStandardMaterial color={wood} side={THREE.DoubleSide} />
        </mesh>
        {[-1.2, 1.2].map((x) => (
          <mesh key={x} position={[x, 0, 1.1]} rotation={[0, 0, PI / 2]}><cylinderGeometry args={[1.13, 1.13, 0.25, 24, 1, false, 0, PI]} /><meshStandardMaterial {...gold} /></mesh>
        ))}
      </group>
      <mesh ref={beam} position={[0, 6, 0]} visible={false}>
        <cylinderGeometry args={[2.2, 1.3, 10, 24, 1, true]} />
        <meshBasicMaterial color="#fff59d" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function TreasureScene() {
  const keys = useGame((s) => s.stage.keys);
  const open = useGame((s) => s.stage.open);
  const celebrate = useGame((s) => s.stage.celebrate);
  const mood = useMood();
  const slots = [-4, -2, 0, 2, 4];
  return (
    <>
      <Sky top="#7c4dff" bottom="#ffd6f6" far={140} />
      <Sun position={[10, 20, 14]} size={16} />
      <StageCamera pos={[0, 6, 17]} look={[0, 3, 0]} />
      <pointLight position={[0, 4, 3]} intensity={open ? 40 : 8} color="#ffd54f" distance={20} />
      <mesh position={[0, -0.6, 0]} rotation={[-PI / 2, 0, 0]}><circleGeometry args={[120, 48]} /><meshStandardMaterial color="#26c6da" /></mesh>
      <mesh position={[0, -0.3, 0]} receiveShadow><cylinderGeometry args={[10, 10.6, 0.8, 48]} /><meshStandardMaterial color="#f3dca0" /></mesh>
      <mesh position={[0, 0.12, 0]} receiveShadow><cylinderGeometry args={[9.6, 9.8, 0.25, 48]} /><meshStandardMaterial color="#86d65f" roughness={1} /></mesh>
      <group position={[0, 0.25, 0]}>
        <Chest open={open} />
        <Fountain on={open} />
        <Trophy show={open} />
      </group>
      {slots.map((x, i) => <Key key={i} index={i} position={[x, 6.6 - Math.abs(x) * 0.25, -1]} got={i < keys} />)}
      <Girl position={[-5, 0.25, 2.6]} rotation={[0, 0.5, 0]} cheer={open} />
      <Bear position={[5.2, 0.25, 2]} rotation={[0, -0.5, 0]} scale={0.95} mood={open ? 'happy' : mood} />
      <Tree position={[-7.6, 0.25, -4]} s={1.2} c="#ec407a" />
      <Tree position={[7.8, 0.25, -3.5]} s={1.1} c="#ab47bc" />
      <Clouds count={7} spread={70} height={16} />
      <Sparkles position={[0, 0.5, 0]} radius={6} count={60} color="#ffd23f" />
      <Confetti trigger={celebrate} origin={[0, 8, 0]} count={320} spread={14} />
    </>
  );
}

/** Picks the 3D scene for the current screen. */
export function SceneRouter() {
  const screen = useGame((s) => s.screen);
  const level = useGame((s) => s.level);
  if (screen === 'level' && level === 3) return <CityScene />;
  if ((screen === 'level' && level === 6) || screen === 'final') return <TreasureScene />;
  if (screen === 'level' || screen === 'complete') return <StageScene />;
  return <HubScene />;
}
