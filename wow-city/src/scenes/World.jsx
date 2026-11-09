import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CITY_LAYOUT } from '../game/city.js';
import { WORD_BY_ID } from '../game/words.js';
import { Building, Sign } from './Buildings.jsx';

/** Gradient sky dome + lights + fog. */
export function Sky({ top = '#5ec8ff', bottom = '#fde3ff', fog = true, far = 160 }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.25,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
  }), [top, bottom]);
  return (
    <>
      <mesh material={mat} renderOrder={-1}><sphereGeometry args={[far * 0.9, 24, 16]} /></mesh>
      {fog && <fog attach="fog" args={[bottom, far * 0.45, far * 0.85]} />}
      <hemisphereLight args={['#ffffff', '#9c6fd6', 0.9]} />
      <ambientLight intensity={0.25} />
    </>
  );
}

export function Sun({ position = [30, 50, 25], size = 60, shadows = true, target }) {
  const ref = useRef();
  useEffect(() => { if (target && ref.current) ref.current.target = target; }, [target]);
  return (
    <directionalLight
      ref={ref}
      position={position}
      intensity={1.6}
      castShadow={shadows}
      shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-size}
      shadow-camera-right={size}
      shadow-camera-top={size}
      shadow-camera-bottom={-size}
      shadow-camera-far={200}
      shadow-bias={-0.0005}
    />
  );
}

export function Clouds({ count = 8, spread = 80, height = 26 }) {
  const group = useRef();
  const clouds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: ((i * 37) % spread) - spread / 2,
    z: ((i * 53) % spread) - spread / 2 - 10,
    y: height + (i % 3) * 3,
    s: 1.4 + (i % 4) * 0.5,
    v: 0.6 + (i % 3) * 0.3,
  })), [count, spread, height]);
  useFrame((_, d) => {
    group.current.children.forEach((c, i) => {
      c.position.x += clouds[i].v * d;
      if (c.position.x > spread / 2 + 10) c.position.x = -spread / 2 - 10;
    });
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {[[0, 0, 0, 1.4], [1.3, -0.2, 0, 1.0], [-1.3, -0.3, 0, 1.0], [0.5, 0.6, 0, 0.9]].map(([x, y, z, r], k) => (
            <mesh key={k} position={[x, y, z]}><sphereGeometry args={[r, 14, 10]} /><meshStandardMaterial color="#ffffff" roughness={1} emissive="#ffffff" emissiveIntensity={0.25} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function Tree({ position, s = 1, c = '#43a047' }) {
  return (
    <group position={position} scale={s}>
      <mesh position={[0, 0.6, 0]} castShadow><cylinderGeometry args={[0.15, 0.22, 1.2, 8]} /><meshStandardMaterial color="#795548" /></mesh>
      <mesh position={[0, 1.7, 0]} castShadow><sphereGeometry args={[0.85, 12, 10]} /><meshStandardMaterial color={c} roughness={0.9} /></mesh>
      <mesh position={[0.3, 2.3, 0.1]} castShadow><sphereGeometry args={[0.55, 12, 10]} /><meshStandardMaterial color={c} roughness={0.9} /></mesh>
    </group>
  );
}

/** Spinning gold coin. */
export function Coin({ position, visible = true }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 3 + position[0];
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 3 + position[2]) * 0.15;
  });
  if (!visible) return null;
  return (
    <group ref={ref} position={position}>
      <mesh rotation={[PI2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.1, 20]} />
        <meshStandardMaterial color="#ffd23f" metalness={0.8} roughness={0.2} emissive="#ffb300" emissiveIntensity={0.45} />
      </mesh>
      <mesh rotation={[PI2, 0, 0]} position={[0, 0, 0.06]}>
        <cylinderGeometry args={[0.28, 0.28, 0.02, 5]} />
        <meshStandardMaterial color="#fff59d" emissive="#ffeb3b" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}
const PI2 = Math.PI / 2;

/** Burst of falling confetti every time `trigger` changes. */
export function Confetti({ trigger, count = 260, origin = [0, 10, 0], spread = 10 }) {
  const mesh = useRef();
  const parts = useMemo(() => Array.from({ length: count }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: Math.random() * 6 })), [count]);
  const life = useRef(99);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => ['#ffd23f', '#e91e8c', '#26c6da', '#8e24aa', '#ffffff', '#ff7043'].map((c) => new THREE.Color(c)), []);

  useEffect(() => {
    if (!trigger) return;
    life.current = 0;
    parts.forEach((pt) => {
      pt.p.set(origin[0] + (Math.random() - 0.5) * 2, origin[1], origin[2] + (Math.random() - 0.5) * 2);
      pt.v.set((Math.random() - 0.5) * spread, 4 + Math.random() * 8, (Math.random() - 0.5) * spread);
    });
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    parts.forEach((_, i) => mesh.current.setColorAt(i, colors[i % colors.length]));
    mesh.current.instanceColor.needsUpdate = true;
  }, [parts, colors]);

  useFrame((_, d) => {
    const dt = Math.min(d, 0.05);
    life.current += dt;
    const on = life.current < 5;
    mesh.current.visible = on;
    if (!on) return;
    parts.forEach((pt, i) => {
      pt.v.y -= 9 * dt;
      pt.v.multiplyScalar(0.985);
      if (pt.v.y < -2.5) pt.v.y = -2.5;
      pt.p.addScaledVector(pt.v, dt);
      pt.r.x += pt.w * dt; pt.r.y += pt.w * 0.7 * dt;
      dummy.position.copy(pt.p);
      dummy.rotation.copy(pt.r);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[0.22, 0.34]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

/** Stars that twinkle around a point (used for rewards). */
export function Sparkles({ position = [0, 0, 0], radius = 3, count = 30, color = '#fff59d' }) {
  const ref = useRef();
  const pos = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const th = Math.random() * Math.PI * 2; const r = radius * (0.4 + Math.random() * 0.6);
      a[i * 3] = Math.cos(th) * r; a[i * 3 + 1] = Math.random() * radius * 1.5; a[i * 3 + 2] = Math.sin(th) * r;
    }
    return a;
  }, [count, radius]);
  useFrame(({ clock }) => {
    ref.current.rotation.y = clock.elapsedTime * 0.4;
    ref.current.material.size = 0.25 + Math.sin(clock.elapsedTime * 5) * 0.08;
  });
  return (
    <points ref={ref} position={position}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]} /></bufferGeometry>
      <pointsMaterial color={color} size={0.25} sizeAttenuation transparent opacity={0.9} toneMapped={false} />
    </points>
  );
}

/** Ground, roads, trees, sea and all 12 buildings with their signs. */
export function City({ restored = [], highlight = null }) {
  const trees = useMemo(() => {
    const out = [];
    CITY_LAYOUT.forEach((b, i) => {
      out.push([b.x - 5.6, b.z + 5.6, i]);
      out.push([b.x + 5.6, b.z - 5.6, i + 1]);
    });
    for (let x = -30; x <= 30; x += 10) out.push([x, -28.5, x]);
    return out;
  }, []);
  const lineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff59d' }), []);
  return (
    <group>
      {/* sea */}
      <mesh position={[0, -0.3, 0]} rotation={[-PI2, 0, 0]}><planeGeometry args={[400, 400]} /><meshStandardMaterial color="#25b5d6" roughness={0.2} metalness={0.1} /></mesh>
      {/* grass island */}
      <mesh position={[0, -0.15, 0]} receiveShadow><boxGeometry args={[74, 0.3, 64]} /><meshStandardMaterial color="#7ccf5a" roughness={1} /></mesh>
      <mesh position={[0, -0.32, 0]}><boxGeometry args={[75, 0.3, 65]} /><meshStandardMaterial color="#f3dca0" /></mesh>
      {/* roads */}
      {[-16, 0, 16].map((x) => (
        <group key={`v${x}`}>
          <mesh position={[x, 0.02, 0]} receiveShadow><boxGeometry args={[4, 0.04, 60]} /><meshStandardMaterial color="#5b5f78" /></mesh>
          {Array.from({ length: 15 }, (_, i) => <mesh key={i} material={lineMat} position={[x, 0.05, -28 + i * 4]}><boxGeometry args={[0.15, 0.01, 1.6]} /></mesh>)}
        </group>
      ))}
      {[-9, 9].map((z) => (
        <group key={`h${z}`}>
          <mesh position={[0, 0.03, z]} receiveShadow><boxGeometry args={[70, 0.04, 4]} /><meshStandardMaterial color="#5b5f78" /></mesh>
          {Array.from({ length: 17 }, (_, i) => <mesh key={i} material={lineMat} position={[-32 + i * 4, 0.06, z]}><boxGeometry args={[1.6, 0.01, 0.15]} /></mesh>)}
        </group>
      ))}
      {/* fountain plaza in the middle */}
      <group position={[0, 0, 9]}>
        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[1.8, 2, 0.4, 24]} /><meshStandardMaterial color="#ce93d8" /></mesh>
        <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[1.5, 1.5, 0.05, 24]} /><meshStandardMaterial color="#4dd0e1" emissive="#00bcd4" emissiveIntensity={0.3} /></mesh>
        <mesh position={[0, 1.0, 0]}><cylinderGeometry args={[0.2, 0.3, 1.2, 10]} /><meshStandardMaterial color="#f8bbd0" /></mesh>
      </group>
      {CITY_LAYOUT.map((b) => (
        <group key={b.id} position={[b.x, 0, b.z]}>
          <mesh position={[0, 0.06, 0]} receiveShadow><boxGeometry args={[11.5, 0.12, 11.5]} /><meshStandardMaterial color="#e8e4f3" /></mesh>
          <Building id={b.id} position={[0, 0.12, -0.3]} />
          <Sign text={WORD_BY_ID[b.id].word} restored={restored.includes(b.id)} highlight={highlight === b.id} position={[0, 0, 5.4]} scale={0.95} />
        </group>
      ))}
      {trees.map(([x, z, k]) => <Tree key={`${x},${z}`} position={[x, 0, z]} s={0.9 + (Math.abs(k) % 3) * 0.15} c={['#43a047', '#66bb6a', '#2e7d32'][Math.abs(k) % 3]} />)}
    </group>
  );
}
