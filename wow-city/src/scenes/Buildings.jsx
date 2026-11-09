import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { windowTexture, labelTexture } from './textures.js';

const PI = Math.PI;

/* --- tiny primitives to keep the building code readable --- */
function Box({ p = [0, 0, 0], s = [1, 1, 1], c = '#fff', r, m = {}, map, shadow = true }) {
  return (
    <mesh position={p} rotation={r} castShadow={shadow} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} map={map} roughness={0.7} {...m} />
    </mesh>
  );
}
function Cyl({ p = [0, 0, 0], rt = 1, rb, h = 1, c = '#fff', seg = 24, r, m = {}, open = false }) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow>
      <cylinderGeometry args={[rt, rb ?? rt, h, seg, 1, open]} />
      <meshStandardMaterial color={c} roughness={0.7} side={open ? THREE.DoubleSide : THREE.FrontSide} {...m} />
    </mesh>
  );
}
function Cone({ p = [0, 0, 0], rad = 1, h = 1, c = '#fff', seg = 24, r, m = {} }) {
  return (
    <mesh position={p} rotation={r} castShadow>
      <coneGeometry args={[rad, h, seg]} />
      <meshStandardMaterial color={c} roughness={0.6} {...m} />
    </mesh>
  );
}
function Ball({ p = [0, 0, 0], rad = 1, c = '#fff', sc, m = {}, half = false }) {
  return (
    <mesh position={p} scale={sc} castShadow>
      <sphereGeometry args={[rad, 24, 16, 0, PI * 2, 0, half ? PI / 2 : PI]} />
      <meshStandardMaterial color={c} roughness={0.5} {...m} />
    </mesh>
  );
}
const GOLD = { metalness: 0.7, roughness: 0.25, emissive: '#5a3c00', emissiveIntensity: 0.25 };

function Flag({ p, c = '#e91e8c' }) {
  const ref = useRef();
  useFrame(({ clock }) => { ref.current.rotation.y = Math.sin(clock.elapsedTime * 4 + p[0]) * 0.35; });
  return (
    <group position={p}>
      <Cyl p={[0, 0.7, 0]} rt={0.04} h={1.4} c="#555" seg={6} />
      <group ref={ref} position={[0, 1.2, 0]}>
        <mesh position={[0.4, 0, 0]}><planeGeometry args={[0.8, 0.45]} /><meshStandardMaterial color={c} side={THREE.DoubleSide} /></mesh>
      </group>
    </group>
  );
}

/* ---------------- the 12 places ---------------- */

function Castle() {
  const stone = '#c8b7a6';
  return (
    <group>
      <Box p={[0, 1.4, 3.5]} s={[7, 2.8, 0.8]} c={stone} />
      <Box p={[0, 1.4, -3.5]} s={[7, 2.8, 0.8]} c={stone} />
      <Box p={[3.5, 1.4, 0]} s={[0.8, 2.8, 7]} c={stone} />
      <Box p={[-3.5, 1.4, 0]} s={[0.8, 2.8, 7]} c={stone} />
      {[-3, -1.5, 0, 1.5, 3].map((x) => <Box key={x} p={[x, 3.05, 3.5]} s={[0.6, 0.5, 0.85]} c={stone} />)}
      <Box p={[0, 1.1, 3.92]} s={[1.6, 2.2, 0.1]} c="#5d3a1a" />
      <Box p={[0, 3.2, 0]} s={[3.4, 6.4, 3.4]} c="#d7c8b8" />
      <Cone p={[0, 7.4, 0]} rad={2.6} h={2.2} c="#8e24aa" seg={4} r={[0, PI / 4, 0]} />
      {[[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <Cyl p={[0, 2.3, 0]} rt={1.05} h={4.6} c="#bba894" />
          <Cone p={[0, 5.5, 0]} rad={1.3} h={1.9} c="#d81b60" />
          <Flag p={[0, 6.4, 0]} c={x > 0 ? '#ffd23f' : '#26c6da'} />
        </group>
      ))}
      {[-0.8, 0.8].map((x) => <Box key={x} p={[x, 4.2, 1.72]} s={[0.5, 0.8, 0.05]} c="#3b2a6b" />)}
    </group>
  );
}

function Boat({ p, c = '#e53935', phase = 0 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    ref.current.position.y = 0.25 + Math.sin(t * 1.8) * 0.12;
    ref.current.rotation.z = Math.sin(t * 1.3) * 0.06;
  });
  return (
    <group ref={ref} position={p}>
      <Box p={[0, 0.3, 0]} s={[1.6, 0.6, 3.6]} c={c} />
      <Box p={[0, 0.62, 0]} s={[1.65, 0.08, 3.65]} c="#ffffff" />
      <Box p={[0, 1.0, -0.6]} s={[1.1, 0.8, 1.2]} c="#ffffff" />
      <Box p={[0, 1.0, -0.02]} s={[0.9, 0.35, 0.05]} c="#4fc3f7" />
      <Cyl p={[0, 2.0, 0.6]} rt={0.05} h={2.6} c="#795548" seg={6} />
      <mesh position={[0.02, 2.0, 1.2]} rotation={[0, PI / 2, 0]}>
        <shapeGeometry args={[(() => { const s = new THREE.Shape(); s.moveTo(-0.6, -1.1); s.lineTo(0.6, -1.1); s.lineTo(-0.6, 1.1); return s; })()]} />
        <meshStandardMaterial color="#fffde7" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Harbour() {
  const water = useRef();
  useFrame(({ clock }) => { water.current.material.emissiveIntensity = 0.25 + Math.sin(clock.elapsedTime * 2) * 0.08; });
  return (
    <group>
      <mesh ref={water} position={[0, 0.05, -0.5]} receiveShadow>
        <boxGeometry args={[10, 0.1, 9]} />
        <meshStandardMaterial color="#1fb6c8" emissive="#0a6f80" emissiveIntensity={0.25} roughness={0.15} metalness={0.2} />
      </mesh>
      <Box p={[0, 0.35, 4.3]} s={[10, 0.5, 1.6]} c="#a1887f" />
      <Box p={[-2.5, 0.35, 0.5]} s={[1.2, 0.5, 6.5]} c="#8d6e63" />
      {[-2, 0, 2].map((z) => <Cyl key={z} p={[-3.2, 0.4, z]} rt={0.12} h={1} c="#5d4037" seg={8} />)}
      <Boat p={[0.8, 0, 0]} c="#e53935" />
      <Boat p={[3.4, 0, -1.6]} c="#3949ab" phase={1.5} />
      {/* lighthouse */}
      <group position={[-4, 0, -3.8]}>
        {[0, 1, 2, 3].map((i) => <Cyl key={i} p={[0, 0.5 + i, 0]} rt={0.62 - i * 0.07} rb={0.7 - i * 0.07} h={1} c={i % 2 ? '#ffffff' : '#e53935'} />)}
        <Cyl p={[0, 4.3, 0]} rt={0.4} h={0.6} c="#fff59d" m={{ emissive: '#ffeb3b', emissiveIntensity: 0.8 }} />
        <Cone p={[0, 4.9, 0]} rad={0.5} h={0.6} c="#e53935" />
      </group>
      {[[2.5, 4.2], [3.2, 4.4]].map(([x, z]) => <Box key={x} p={[x, 0.9, z]} s={[0.6, 0.6, 0.6]} c="#ffb300" />)}
      <mesh position={[-0.5, 0.95, 4.3]} rotation={[0, 0, 0]}><torusGeometry args={[0.35, 0.12, 8, 16]} /><meshStandardMaterial color="#ff7043" /></mesh>
    </group>
  );
}

function Stadium() {
  const lights = useRef([]);
  const ball = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    lights.current.forEach((l, i) => { if (l) l.material.emissiveIntensity = 0.6 + Math.max(0, Math.sin(t * 3 + i)) * 0.8; });
    ball.current.position.set(Math.sin(t) * 1.6, 0.6 + Math.abs(Math.sin(t * 3)) * 0.8, Math.cos(t * 0.7) * 0.8);
  });
  return (
    <group scale={[1.15, 1, 0.95]}>
      <Cyl p={[0, 1.4, 0]} rt={4.9} rb={4.0} h={2.8} c="#8e24aa" seg={40} open />
      <Cyl p={[0, 1.4, 0]} rt={4.6} rb={3.7} h={2.6} c="#ce93d8" seg={40} open />
      {[0.7, 1.4, 2.1].map((y, i) => (
        <mesh key={y} position={[0, y, 0]} rotation={[PI / 2, 0, 0]}>
          <torusGeometry args={[3.85 + i * 0.3, 0.06, 6, 40]} />
          <meshStandardMaterial color={['#ffd23f', '#26c6da', '#ec407a'][i]} />
        </mesh>
      ))}
      <Cyl p={[0, 0.12, 0]} rt={3.75} h={0.2} c="#43a047" seg={40} />
      <Box p={[0, 0.24, 0]} s={[0.06, 0.02, 4.2]} c="#ffffff" shadow={false} />
      <mesh position={[0, 0.24, 0]} rotation={[-PI / 2, 0, 0]}><ringGeometry args={[0.7, 0.78, 28]} /><meshBasicMaterial color="#ffffff" /></mesh>
      {[-1.6, 1.6].map((z) => <Box key={z} p={[0, 0.55, z * 1.4]} s={[1.2, 0.7, 0.08]} c="#ffffff" />)}
      <mesh ref={ball} castShadow><sphereGeometry args={[0.22, 16, 12]} /><meshStandardMaterial color="#ffffff" /></mesh>
      {[[-4.2, -3], [4.2, -3], [-4.2, 3], [4.2, 3]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cyl p={[0, 2.8, 0]} rt={0.1} h={5.6} c="#9e9e9e" seg={8} />
          <mesh ref={(el) => { lights.current[i] = el; }} position={[0, 5.7, 0]}>
            <boxGeometry args={[0.9, 0.5, 0.3]} />
            <meshStandardMaterial color="#fffde7" emissive="#fff59d" emissiveIntensity={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Tower() {
  const beacon = useRef();
  useFrame(({ clock }) => { beacon.current.rotation.y = clock.elapsedTime * 2; });
  return (
    <group>
      <Cyl p={[0, 0.6, 0]} rt={2.2} rb={2.6} h={1.2} c="#7e57c2" />
      <Cyl p={[0, 6.5, 0]} rt={0.55} rb={1.1} h={11} c="#ede7f6" />
      {[3, 5.5, 8].map((y) => <Cyl key={y} p={[0, y, 0]} rt={0.98 - y * 0.04} h={0.25} c="#ffb300" />)}
      <Cyl p={[0, 12.4, 0]} rt={1.9} rb={1.3} h={1.2} c="#ab47bc" />
      <Cyl p={[0, 13.1, 0]} rt={1.7} h={0.3} c="#4dd0e1" m={{ emissive: '#00acc1', emissiveIntensity: 0.6 }} />
      <Cyl p={[0, 13.5, 0]} rt={1.2} rb={1.6} h={0.6} c="#ec407a" />
      <Cyl p={[0, 15.0, 0]} rt={0.06} rb={0.15} h={2.6} c="#bdbdbd" seg={8} />
      <group ref={beacon} position={[0, 16.3, 0]}>
        <Ball rad={0.28} c="#ff5252" m={{ emissive: '#ff1744', emissiveIntensity: 1.2 }} />
        <Box p={[0.5, 0, 0]} s={[0.8, 0.08, 0.08]} c="#ffd23f" m={{ emissive: '#ffd23f', emissiveIntensity: 1 }} shadow={false} />
      </group>
    </group>
  );
}

function Skyscraper() {
  const tex = useMemo(() => windowTexture(6, 24, '#2c4a7a', '#7fc8ff'), []);
  const top = useRef();
  useFrame(({ clock }) => { top.current.material.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 4) * 0.5; });
  return (
    <group>
      <Box p={[0, 9, 0]} s={[5, 18, 5]} c="#ffffff" map={tex} m={{ metalness: 0.3, roughness: 0.3 }} />
      <Box p={[0, 18.6, 0]} s={[3.6, 1.2, 3.6]} c="#3d5a99" />
      <Box p={[0, 19.8, 0]} s={[2.2, 1.2, 2.2]} c="#5c7cc4" />
      <Cyl p={[0, 21.6, 0]} rt={0.05} rb={0.25} h={2.6} c="#cfd8dc" seg={8} />
      <mesh ref={top} position={[0, 23, 0]}><sphereGeometry args={[0.22, 12, 10]} /><meshStandardMaterial color="#ff4081" emissive="#ff4081" /></mesh>
      <Box p={[0, 1, 2.55]} s={[2, 2, 0.1]} c="#263238" />
    </group>
  );
}

function Smoke({ p }) {
  const puffs = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const k = ((t * 0.5 + i / 4) % 1);
      m.position.set(Math.sin(k * 3 + i) * 0.4, k * 3, 0);
      m.scale.setScalar(0.4 + k * 0.9);
      m.material.opacity = 0.7 * (1 - k);
    });
  });
  return (
    <group position={p}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => { puffs.current[i] = el; }}>
          <sphereGeometry args={[0.6, 10, 8]} />
          <meshStandardMaterial color="#eceff1" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Factory() {
  const gear = useRef();
  useFrame((_, d) => { gear.current.rotation.z += d * 1.5; });
  return (
    <group>
      <Box p={[0, 2, 0]} s={[8.5, 4, 6]} c="#e0a85e" />
      {[-3, -1, 1, 3].map((x) => (
        <group key={x} position={[x, 4, 0]}>
          <mesh position={[0, 0.7, 0]} rotation={[0, 0, PI / 4]} scale={[1, 1, 1]} castShadow>
            <boxGeometry args={[1.4, 1.4, 5.9]} />
            <meshStandardMaterial color="#8d6e63" />
          </mesh>
        </group>
      ))}
      {[-2.5, -0.5].map((x) => (
        <group key={x} position={[x, 0, -1.8]}>
          {[0, 1, 2, 3].map((i) => <Cyl key={i} p={[0, 5 + i * 0.9, 0]} rt={0.5} h={0.9} c={i % 2 ? '#ffffff' : '#e53935'} />)}
        </group>
      ))}
      <Smoke p={[-2.5, 8.6, -1.8]} />
      <Smoke p={[-0.5, 8.6, -1.8]} />
      <Box p={[2, 1.2, 3.02]} s={[2.2, 2.4, 0.1]} c="#546e7a" />
      {[-3.2, -1.6].map((x) => <Box key={x} p={[x, 2.6, 3.02]} s={[1, 0.9, 0.06]} c="#90caf9" />)}
      <group ref={gear} position={[-0.2, 2.6, 3.1]}>
        <mesh><torusGeometry args={[0.55, 0.18, 8, 8]} /><meshStandardMaterial color="#ffd23f" metalness={0.5} roughness={0.3} /></mesh>
        {[0, 1, 2, 3].map((i) => <Box key={i} r={[0, 0, (i * PI) / 4]} s={[1.7, 0.25, 0.2]} c="#ffd23f" shadow={false} />)}
      </group>
    </group>
  );
}

function Hospital() {
  const cross = useRef();
  useFrame(({ clock }) => {
    cross.current.children.forEach((c) => { c.material.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 3) * 0.4; });
  });
  const tex = useMemo(() => windowTexture(6, 4, '#ffffff', '#81d4fa'), []);
  return (
    <group>
      <Box p={[0, 3, 0]} s={[8, 6, 6]} c="#ffffff" map={tex} />
      <Box p={[0, 6.15, 0]} s={[8.2, 0.3, 6.2]} c="#e0e0e0" />
      <group ref={cross} position={[0, 4.6, 3.06]}>
        <Box s={[0.7, 2, 0.12]} c="#e53935" m={{ emissive: '#ff1744' }} shadow={false} />
        <Box s={[2, 0.7, 0.12]} c="#e53935" m={{ emissive: '#ff1744' }} shadow={false} />
      </group>
      <Box p={[0, 1.1, 3.4]} s={[3, 0.2, 1]} c="#26c6da" />
      <Box p={[0, 0.9, 3.03]} s={[1.6, 1.8, 0.08]} c="#4fc3f7" />
      <mesh position={[0, 6.32, 0]} rotation={[-PI / 2, 0, 0]}><circleGeometry args={[1.8, 32]} /><meshStandardMaterial color="#43a047" /></mesh>
      <Box p={[0, 6.34, 0]} s={[0.25, 0.02, 1.6]} c="#ffffff" shadow={false} />
      <Box p={[-0.45, 6.34, 0]} s={[0.25, 0.02, 1.6]} c="#ffffff" shadow={false} r={[0, 0, 0]} />
      <Box p={[0.45, 6.34, 0]} s={[0.25, 0.02, 1.6]} c="#ffffff" shadow={false} />
      <Box p={[0, 6.34, 0]} s={[0.9, 0.02, 0.25]} c="#ffffff" shadow={false} />
      {/* ambulance */}
      <group position={[3.2, 0, 4.2]}>
        <Box p={[0, 0.8, 0]} s={[1.3, 1.2, 2.4]} c="#ffffff" />
        <Box p={[0, 0.8, 0]} s={[1.32, 0.25, 2.42]} c="#e53935" shadow={false} />
        <Box p={[0, 1.5, 0.6]} s={[0.4, 0.15, 0.2]} c="#2196f3" m={{ emissive: '#2196f3', emissiveIntensity: 1 }} />
        {[[-0.6, 0.8], [0.6, 0.8], [-0.6, -0.8], [0.6, -0.8]].map(([x, z]) => (
          <Cyl key={`${x}${z}`} p={[x, 0.25, z]} rt={0.25} h={0.2} c="#212121" r={[0, 0, PI / 2]} seg={12} />
        ))}
      </group>
    </group>
  );
}

function Palace() {
  const domes = useRef();
  useFrame(({ clock }) => { domes.current.position.y = Math.sin(clock.elapsedTime * 2) * 0.05; });
  return (
    <group>
      <Box p={[0, 0.25, 0.5]} s={[10, 0.5, 7]} c="#f8f1e3" />
      <Box p={[0, 2.5, -0.5]} s={[8.4, 4, 4.4]} c="#fff3dc" />
      <Box p={[0, 4.6, -0.5]} s={[8.6, 0.3, 4.6]} c="#f2c230" m={GOLD} />
      {[-3, -1.8, -0.6, 0.6, 1.8, 3].map((x) => <Cyl key={x} p={[x, 2.3, 1.95]} rt={0.18} h={3.6} c="#ffffff" seg={12} />)}
      <Box p={[0, 4.3, 2.0]} s={[7, 0.4, 0.5]} c="#f2c230" m={GOLD} />
      <Box p={[0, 1.4, 1.75]} s={[1.6, 2.4, 0.1]} c="#8e24aa" />
      <group ref={domes}>
        <Cyl p={[0, 5.3, -0.5]} rt={1.6} h={1.2} c="#fff3dc" />
        <Ball p={[0, 5.9, -0.5]} rad={1.7} c="#f2c230" m={GOLD} half />
        <Cone p={[0, 8.0, -0.5]} rad={0.25} h={0.9} c="#f2c230" m={GOLD} />
        {[-4.3, 4.3].map((x) => (
          <group key={x} position={[x, 0, -0.5]}>
            <Cyl p={[0, 3, 0]} rt={0.9} h={6} c="#fff3dc" />
            <Ball p={[0, 6.6, 0]} rad={1.05} c="#f2c230" m={GOLD} sc={[1, 1.15, 1]} />
            <Cone p={[0, 8.0, 0]} rad={0.35} h={1.2} c="#f2c230" m={GOLD} />
          </group>
        ))}
      </group>
      {[-1, 1].map((s) => <Flag key={s} p={[s * 2.5, 4.7, -0.5]} c="#8e24aa" />)}
      {[-2, 2].map((x) => <Cone key={x} p={[x * 1.9, 0.9, 3.4]} rad={0.45} h={1} c="#2e7d32" />)}
    </group>
  );
}

function SwimmingPool() {
  const water = useRef(); const ring = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    water.current.material.emissiveIntensity = 0.35 + Math.sin(t * 2.5) * 0.12;
    ring.current.position.set(Math.sin(t * 0.6) * 1.5, 0.55 + Math.sin(t * 2) * 0.05, Math.cos(t * 0.5) * 1);
  });
  return (
    <group>
      <Box p={[0, 0.25, 0]} s={[10, 0.5, 8]} c="#eceff1" />
      <mesh ref={water} position={[0, 0.48, -0.3]}>
        <boxGeometry args={[7.4, 0.06, 5.2]} />
        <meshStandardMaterial color="#29b6f6" emissive="#00b8d4" emissiveIntensity={0.35} roughness={0.1} />
      </mesh>
      {[-1.3, 0, 1.3].map((z) => <Box key={z} p={[0, 0.53, z - 0.3]} s={[7.2, 0.05, 0.06]} c={z === 0 ? '#ffd23f' : '#ec407a'} shadow={false} />)}
      <mesh ref={ring} rotation={[PI / 2, 0, 0]}><torusGeometry args={[0.45, 0.16, 10, 20]} /><meshStandardMaterial color="#ff4081" /></mesh>
      {/* diving board */}
      <Box p={[-4.4, 1.0, -0.3]} s={[0.6, 1.0, 0.8]} c="#26c6da" />
      <Box p={[-3.6, 1.55, -0.3]} s={[2.2, 0.12, 0.6]} c="#ffffff" />
      {/* ladder */}
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[3.2 + x, 0.9, 2.3]}><torusGeometry args={[0.3, 0.05, 6, 12, PI]} /><meshStandardMaterial color="#b0bec5" metalness={0.8} roughness={0.2} /></mesh>
      ))}
      {[[-3.5, 3.2, '#ec407a'], [3.8, -3.2, '#ffd23f']].map(([x, z, c]) => (
        <group key={x} position={[x, 0.5, z]}>
          <Cyl p={[0, 1, 0]} rt={0.05} h={2} c="#795548" seg={6} />
          <Cone p={[0, 2.1, 0]} rad={1.2} h={0.6} c={c} seg={8} />
        </group>
      ))}
      <Box p={[1.5, 0.65, 3.4]} s={[1.8, 0.2, 0.7]} c="#ffffff" />
    </group>
  );
}

function SportsCentre() {
  const ball = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ball.current.position.y = 5.2 + Math.abs(Math.sin(t * 3)) * 1.2;
    ball.current.rotation.y = t * 2;
  });
  return (
    <group>
      <Box p={[0, 1.8, 0]} s={[8.5, 3.6, 7]} c="#2ec4b6" />
      <mesh position={[0, 3.6, 0]} rotation={[0, 0, PI / 2]} scale={[1, 1, 1]} castShadow>
        <cylinderGeometry args={[1.6, 1.6, 8.5, 24, 1, false, 0, PI]} />
        <meshStandardMaterial color="#ff8a3d" side={THREE.DoubleSide} />
      </mesh>
      <Box p={[0, 3.62, 0]} s={[8.5, 0.05, 3.2]} c="#ff8a3d" shadow={false} />
      <Box p={[0, 1.4, 3.52]} s={[2.4, 2.8, 0.08]} c="#1565c0" />
      {[-3, 3].map((x) => <Box key={x} p={[x, 2.2, 3.52]} s={[1.6, 1.4, 0.06]} c="#b3e5fc" />)}
      <group ref={ball} position={[0, 5.2, 0]}>
        <Ball rad={0.8} c="#ff6f00" />
        <mesh rotation={[0, 0, 0]}><torusGeometry args={[0.81, 0.03, 6, 24]} /><meshBasicMaterial color="#222" /></mesh>
        <mesh rotation={[PI / 2, 0, 0]}><torusGeometry args={[0.81, 0.03, 6, 24]} /><meshBasicMaterial color="#222" /></mesh>
      </group>
      {/* outdoor basketball hoop */}
      <group position={[4, 0, 4.2]}>
        <Cyl p={[0, 1.4, 0]} rt={0.07} h={2.8} c="#616161" seg={8} />
        <Box p={[0, 2.8, 0.1]} s={[1, 0.7, 0.06]} c="#ffffff" />
        <mesh position={[0, 2.55, 0.35]} rotation={[PI / 2, 0, 0]}><torusGeometry args={[0.22, 0.03, 6, 16]} /><meshStandardMaterial color="#ff5722" /></mesh>
      </group>
    </group>
  );
}

function OfficeBuilding() {
  const tex = useMemo(() => windowTexture(5, 10, '#455a64', '#b3e5fc'), []);
  const sign = useRef();
  useFrame(({ clock }) => { sign.current.rotation.y = clock.elapsedTime * 0.8; });
  return (
    <group>
      <Box p={[0, 5.5, 0]} s={[6, 11, 6]} c="#ffffff" map={tex} m={{ metalness: 0.2, roughness: 0.35 }} />
      <Box p={[0, 11.2, 0]} s={[6.2, 0.4, 6.2]} c="#37474f" />
      <Box p={[1.5, 11.9, -1]} s={[1.6, 1, 1.6]} c="#78909c" />
      <Box p={[0, 1.2, 3.25]} s={[3.6, 0.2, 1.2]} c="#7b1fa2" />
      <Box p={[0, 0.6, 3.02]} s={[2, 1.2, 0.06]} c="#80deea" />
      <group ref={sign} position={[-1.2, 12.6, 1]}>
        <Box s={[1.4, 0.8, 0.12]} c="#ffd23f" m={{ emissive: '#ffb300', emissiveIntensity: 0.5 }} />
        <Box p={[0, 0, 0.07]} s={[1, 0.15, 0.02]} c="#7b1fa2" shadow={false} />
      </group>
    </group>
  );
}

function ApartmentBuilding() {
  const tex = useMemo(() => windowTexture(5, 8, '#f4a58a', '#80d8ff'), []);
  const colors = ['#ec407a', '#ffd23f', '#26c6da', '#8e24aa'];
  return (
    <group>
      <Box p={[0, 4.5, 0]} s={[7, 9, 5]} c="#ffffff" map={tex} />
      <Box p={[0, 9.15, 0]} s={[7.4, 0.3, 5.4]} c="#c2185b" />
      {[2, 4, 6, 8].map((y, row) => [-2.2, 0, 2.2].map((x, col) => (
        <group key={`${y}${x}`} position={[x, y - 0.9, 2.7]}>
          <Box s={[1.6, 0.15, 0.8]} c="#fafafa" />
          <Box p={[0, 0.3, 0.38]} s={[1.6, 0.45, 0.05]} c={colors[(row + col) % 4]} m={{ transparent: true, opacity: 0.85 }} />
          <Ball p={[0.5, 0.25, 0.1]} rad={0.13} c="#e91e63" />
          <Ball p={[-0.5, 0.25, 0.1]} rad={0.13} c="#fdd835" />
        </group>
      )))}
      <Box p={[0, 0.8, 2.55]} s={[1.4, 1.6, 0.1]} c="#6d4c41" />
      <Box p={[0, 1.75, 2.9]} s={[2, 0.12, 0.8]} c="#c2185b" />
    </group>
  );
}

export const BUILDINGS = {
  castle: Castle,
  harbour: Harbour,
  stadium: Stadium,
  tower: Tower,
  skyscraper: Skyscraper,
  factory: Factory,
  hospital: Hospital,
  palace: Palace,
  swimming_pool: SwimmingPool,
  sports_centre: SportsCentre,
  office_building: OfficeBuilding,
  apartment_building: ApartmentBuilding,
};

/** Name sign. Shows "? ? ?" until the name is restored. */
export function Sign({ text, restored, highlight = false, ...props }) {
  const tex = useMemo(
    () => labelTexture(restored ? text : '? ? ?', restored ? '#7b1fa2' : '#455a64', restored ? '#ffffff' : '#ffd23f'),
    [text, restored],
  );
  const board = useRef();
  useFrame(({ clock }) => {
    if (board.current) board.current.scale.setScalar(highlight ? 1 + Math.sin(clock.elapsedTime * 6) * 0.06 : 1);
  });
  return (
    <group {...props}>
      <Cyl p={[-1.4, 0.9, 0]} rt={0.08} h={1.8} c="#5d4037" seg={6} />
      <Cyl p={[1.4, 0.9, 0]} rt={0.08} h={1.8} c="#5d4037" seg={6} />
      <mesh ref={board} position={[0, 1.8, 0.05]}>
        <planeGeometry args={[3.6, 0.9]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** A building by id. */
export function Building({ id, ...props }) {
  const C = BUILDINGS[id];
  if (!C) return null;
  return <group {...props}><C /></group>;
}
