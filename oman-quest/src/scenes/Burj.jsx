import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clockTexture, arabicSignTexture, muralTexture } from './textures.js';
import { toon, WavingFlag } from './Props.jsx';

/**
 * Burj Al Sahwa (برج الصحوة), Muscat — modelled from the reference photo:
 * four massive dark-brown square pillars, round crenellated turrets on the
 * corners, a clock chamber with blue pointed-arch panels, white clock faces
 * framed by a gold eight-pointed star, gold Arabic lettering on the parapet,
 * a warmly lit open underside, and white arched walls with murals at the base.
 *
 * Local units: 9 × 9 footprint centred on x = 0, z = 0; chamber top at y ≈ 16.
 */
const BROWN = '#3f2621';
const BROWN_LIGHT = '#5a3a32';
const GOLD = '#d9a441';
const BLUE = '#1d2f72';

function archShape(w, h, spring) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2, spring);
  s.quadraticCurveTo(-w / 2, h * 0.92, 0, h);
  s.quadraticCurveTo(w / 2, h * 0.92, w / 2, spring);
  s.lineTo(w / 2, 0);
  s.lineTo(-w / 2, 0);
  return s;
}

function Merlons({ length, count, y, z = 0, axis = 'x', size = 0.42, color = BROWN }) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const t = -length / 2 + (length / (count - 1)) * i;
    items.push(<mesh key={i} position={axis === 'x' ? [t, y, z] : [z, y, t]} material={toon(color)}><boxGeometry args={[size, 0.55, size]} /></mesh>);
  }
  return <>{items}</>;
}

function Turret({ x, z }) {
  const merlons = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    merlons.push(<mesh key={i} position={[Math.cos(a) * 1.05, 18.45, Math.sin(a) * 1.05]} rotation={[0, -a, 0]} material={toon(BROWN)}><boxGeometry args={[0.36, 0.55, 0.3]} /></mesh>);
  }
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 15.7, 0]} material={toon(BROWN)}><cylinderGeometry args={[1.15, 1.15, 5, 24]} /></mesh>
      <mesh position={[0, 12.7, 0]} material={toon(BROWN_LIGHT)}><cylinderGeometry args={[1.15, 0.7, 1.1, 24]} /></mesh>
      <mesh position={[0, 18.22, 0]} material={toon(BROWN_LIGHT)}><cylinderGeometry args={[1.22, 1.22, 0.1, 24]} /></mesh>
      {merlons}
    </group>
  );
}

function ClockFace({ position, rotationY = 0 }) {
  const hour = useRef();
  const minute = useRef();
  const arch = useMemo(() => new THREE.ShapeGeometry(archShape(5.2, 5.1, 2.4)), []);
  const archFrame = useMemo(() => {
    const outer = archShape(5.6, 5.5, 2.5);
    outer.holes.push(new THREE.Path(archShape(5.2, 5.1, 2.4).getPoints(24).reverse()));
    return new THREE.ShapeGeometry(outer);
  }, []);
  const star = useMemo(() => {
    const g = [];
    for (const rot of [0, Math.PI / 4]) {
      const sq = new THREE.Shape();
      const r = 1.95; const i = 1.8;
      sq.moveTo(-r, -r); sq.lineTo(r, -r); sq.lineTo(r, r); sq.lineTo(-r, r); sq.lineTo(-r, -r);
      sq.holes.push(new THREE.Path([new THREE.Vector2(-i, -i), new THREE.Vector2(-i, i), new THREE.Vector2(i, i), new THREE.Vector2(i, -i)]));
      const geo = new THREE.ShapeGeometry(sq); geo.rotateZ(rot); g.push(geo);
    }
    return g;
  }, []);
  useFrame(() => {
    const d = new Date();
    const m = d.getMinutes() + d.getSeconds() / 60;
    const h = (d.getHours() % 12) + m / 60;
    if (minute.current) minute.current.rotation.z = -(m / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(h / 12) * Math.PI * 2;
  });
  const goldMat = useMemo(() => new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.7, roughness: 0.3, emissive: '#5a3a00', emissiveIntensity: 0.4, side: THREE.DoubleSide }), []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={archFrame} material={goldMat} position={[0, 0, 0.01]} />
      <mesh geometry={arch} position={[0, 0, 0.02]}><meshStandardMaterial color={BLUE} roughness={0.6} /></mesh>
      {star.map((g, i) => <mesh key={i} geometry={g} material={goldMat} position={[0, 2.75, 0.04]} />)}
      <mesh position={[0, 2.75, 0.06]}>
        <circleGeometry args={[1.32, 48]} />
        <meshStandardMaterial map={clockTexture()} emissive="#fffbe8" emissiveIntensity={0.55} emissiveMap={clockTexture()} />
      </mesh>
      <group position={[0, 2.75, 0.1]}>
        <group ref={hour}><mesh position={[0, 0.36, 0]}><boxGeometry args={[0.12, 0.78, 0.04]} /><meshBasicMaterial color="#111" /></mesh></group>
        <group ref={minute}><mesh position={[0, 0.52, 0.02]}><boxGeometry args={[0.07, 1.1, 0.04]} /><meshBasicMaterial color="#111" /></mesh></group>
        <mesh position={[0, 0, 0.05]}><circleGeometry args={[0.09, 16]} /><meshBasicMaterial color="#111" /></mesh>
      </group>
    </group>
  );
}

function BaseWall({ x, z, w, rotY = 0 }) {
  const arches = useMemo(() => new THREE.ShapeGeometry(archShape(1.1, 2.4, 1.4)), []);
  const n = Math.max(1, Math.floor(w / 4));
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 1.8, 0]} material={toon('#f2ece6')}><boxGeometry args={[w, 3.6, 0.9]} /></mesh>
      <mesh position={[0, 3.7, 0]} material={toon('#e4dbd2')}><boxGeometry args={[w + 0.2, 0.25, 1.0]} /></mesh>
      {Array.from({ length: n }, (_, i) => {
        const px = -w / 2 + (w / n) * (i + 0.5);
        return (
          <group key={i} position={[px, 0, 0.46]}>
            {i % 2 === 0 ? (
              <mesh geometry={arches} position={[0, 0.2, 0]}><meshBasicMaterial color="#2a211d" /></mesh>
            ) : (
              <mesh position={[0, 1.9, 0]}><planeGeometry args={[2.6, 1.8]} /><meshStandardMaterial map={muralTexture()} /></mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function BurjAlSahwa({ position = [0, 0, 0], showFlag = false }) {
  const sign = useMemo(() => arabicSignTexture('برج الصحوة', ''), []);
  const PIL = 3.7;
  return (
    <group position={position}>
      {/* plinth */}
      <mesh position={[0, 0.3, 0]} material={toon('#efe7df')}><boxGeometry args={[10.4, 0.6, 10.4]} /></mesh>
      {/* four great pillars */}
      {[[-PIL, -PIL], [PIL, -PIL], [-PIL, PIL], [PIL, PIL]].map(([x, z]) => (
        <group key={`${x}${z}`}>
          <mesh position={[x, 7.8, z]} material={toon(BROWN)}><boxGeometry args={[1.7, 15, 1.7]} /></mesh>
          <Turret x={x} z={z} />
        </group>
      ))}
      {/* inner columns with slit windows */}
      {[-1.9, 1.9].map((x) => (
        <group key={x} position={[x, 0, -1.2]}>
          <mesh position={[0, 5, 0]} material={toon('#e9dfd6')}><boxGeometry args={[1.1, 9.6, 1.1]} /></mesh>
          {[2.5, 6].map((y) => <mesh key={y} position={[0, y, 0.56]}><planeGeometry args={[0.28, 1.3]} /><meshBasicMaterial color="#2b2320" /></mesh>)}
        </group>
      ))}
      {/* clock chamber */}
      <mesh position={[0, 12.6, 0]} material={toon(BROWN)}><boxGeometry args={[8.9, 6.2, 8.9]} /></mesh>
      {/* glowing underside */}
      <mesh position={[0, 9.48, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[8.8, 8.8]} /><meshBasicMaterial color="#fff1d6" /></mesh>
      <pointLight position={[0, 8.6, 0]} color="#ffd9a0" intensity={18} distance={14} />
      {/* clock faces on all four sides */}
      <ClockFace position={[0, 9.95, 4.46]} />
      <ClockFace position={[0, 9.95, -4.46]} rotationY={Math.PI} />
      <ClockFace position={[4.46, 9.95, 0]} rotationY={Math.PI / 2} />
      <ClockFace position={[-4.46, 9.95, 0]} rotationY={-Math.PI / 2} />
      {/* parapet with merlons */}
      <mesh position={[0, 16.2, 0]} material={toon(BROWN)}><boxGeometry args={[8.9, 1.2, 8.9]} /></mesh>
      <Merlons length={6.4} count={12} y={17.05} z={4.25} />
      <Merlons length={6.4} count={12} y={17.05} z={-4.25} />
      <Merlons length={6.4} count={12} y={17.05} z={4.25} axis="z" />
      <Merlons length={6.4} count={12} y={17.05} z={-4.25} axis="z" />
      {/* gold Arabic lettering on the front and left faces */}
      <mesh position={[0, 15.95, 4.47]}><planeGeometry args={[5.6, 1.75]} /><meshBasicMaterial map={sign} transparent depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[-4.47, 15.95, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[5.6, 1.75]} /><meshBasicMaterial map={sign} transparent depthWrite={false} toneMapped={false} /></mesh>
      {/* white walls with arches and murals around the base */}
      <BaseWall x={0} z={-7.5} w={22} />
      <BaseWall x={-11} z={-3.2} w={8} rotY={Math.PI / 2} />
      <BaseWall x={11} z={-3.2} w={8} rotY={-Math.PI / 2} />
      {/* warm uplights */}
      <pointLight position={[0, 2, 7]} color="#ffcf8a" intensity={10} distance={16} />
      {showFlag && (
        <group position={[0, 17.5, 0]}>
          <mesh position={[0, 3, 0]} material={toon('#e0e0e0')}><cylinderGeometry args={[0.08, 0.08, 6, 8]} /></mesh>
          <group position={[0.08, 5.3, 0]}><WavingFlag width={2.6} height={1.3} /></group>
        </group>
      )}
    </group>
  );
}

/** Flag pole whose flag rises when `raise` (0..1) grows — used at the finale. */
export function RisingFlag({ position, raise }) {
  const flag = useRef();
  useFrame((_, dt) => {
    if (!flag.current) return;
    const target = 0.8 + raise.current * 5.2;
    flag.current.position.y += (target - flag.current.position.y) * Math.min(1, dt * 2);
  });
  return (
    <group position={position}>
      <mesh position={[0, 3.2, 0]} material={toon('#e9e9e9')}><cylinderGeometry args={[0.08, 0.1, 6.4, 10]} /></mesh>
      <mesh position={[0, 6.45, 0]} material={toon('#ffd34d', { emissive: '#a07000', emissiveIntensity: 0.5 })}><sphereGeometry args={[0.16, 12, 8]} /></mesh>
      <group ref={flag} position={[0.08, 0.8, 0]}><WavingFlag width={2.6} height={1.3} /></group>
    </group>
  );
}
