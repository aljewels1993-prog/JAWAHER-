import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PI = Math.PI;
const DS = THREE.DoubleSide;

function Mat({ c, rough = 0.75, ...rest }) {
  return <meshStandardMaterial color={c} roughness={rough} {...rest} />;
}

/* Palette taken from the reference picture of the girl. */
const SKIN = '#fbd8c2';
const SCARF = '#a01f86';
const DRESS = '#9a1c80';
const BLOUSE = '#e8eef7';
const HAIR = '#f1d391';
const EYE = '#1f9e5a';

/**
 * The player: a little girl in a purple headscarf and purple dress.
 * `motion` is a ref: { speed (0..1), air (bool), cheer (bool) } updated by the scene.
 */
export function Girl({ motion, cheer = false, ...props }) {
  const legL = useRef(); const legR = useRef();
  const armL = useRef(); const armR = useRef();
  const body = useRef(); const head = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const m = motion?.current || {};
    const sp = Math.min(1, m.speed || 0);
    const air = !!m.air;
    const happy = cheer || m.cheer;
    const swing = air ? 0.6 : Math.sin(t * 13) * 0.75 * sp;
    legL.current.rotation.x = swing;
    legR.current.rotation.x = air ? -0.3 : -swing;
    if (happy || air) {
      armL.current.rotation.set(0, 0, -2.5 + Math.sin(t * 10) * 0.25);
      armR.current.rotation.set(0, 0, 2.5 - Math.sin(t * 10) * 0.25);
    } else {
      armL.current.rotation.set(-swing * 0.8, 0, -0.18);
      armR.current.rotation.set(swing * 0.8, 0, 0.18);
    }
    const bob = sp > 0.1 && !air ? Math.abs(Math.sin(t * 13)) * 0.07 : Math.sin(t * 2.2) * 0.025;
    body.current.position.y = bob + (happy && !air ? Math.abs(Math.sin(t * 6)) * 0.25 : 0);
    head.current.rotation.z = Math.sin(t * 1.6) * 0.06;
    head.current.rotation.y = Math.sin(t * 0.7) * 0.12;
  });

  return (
    <group {...props}>
      <group ref={body}>
        {/* legs + shoes */}
        {[[-0.17, legL], [0.17, legR]].map(([x, ref]) => (
          <group key={x} ref={ref} position={[x, 0.58, 0]}>
            <mesh position={[0, -0.24, 0]} castShadow><cylinderGeometry args={[0.085, 0.08, 0.48, 12]} /><Mat c="#f6f2ef" /></mesh>
            <mesh position={[0, -0.5, 0.06]} scale={[1, 0.6, 1.5]} castShadow><sphereGeometry args={[0.13, 16, 12]} /><Mat c="#d6339f" /></mesh>
            <mesh position={[0, -0.565, 0.06]} scale={[1.05, 0.25, 1.55]}><sphereGeometry args={[0.13, 16, 8]} /><Mat c="#f7c600" /></mesh>
          </group>
        ))}
        {/* dress */}
        <mesh position={[0, 1.0, 0]} castShadow><cylinderGeometry args={[0.3, 0.64, 0.98, 28]} /><Mat c={DRESS} /></mesh>
        <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.645, 0.645, 0.1, 28, 1, true]} /><Mat c="#e2475f" side={DS} /></mesh>
        <mesh position={[0, 0.615, 0]}><cylinderGeometry args={[0.635, 0.635, 0.025, 28, 1, true]} /><Mat c="#ffffff" side={DS} /></mesh>
        {/* blouse front + collar */}
        <mesh position={[0, 1.33, 0.25]} rotation={[-0.25, 0, 0]}><boxGeometry args={[0.34, 0.2, 0.05]} /><Mat c={BLOUSE} /></mesh>
        {/* arms (white sleeves, blue cuffs) */}
        {[[-0.37, armL], [0.37, armR]].map(([x, ref]) => (
          <group key={x} ref={ref} position={[x, 1.38, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow><capsuleGeometry args={[0.12, 0.3, 6, 12]} /><Mat c={BLOUSE} /></mesh>
            <mesh position={[0, -0.44, 0]}><cylinderGeometry args={[0.125, 0.125, 0.07, 14]} /><Mat c="#6c84b8" /></mesh>
            <mesh position={[0, -0.54, 0]}><sphereGeometry args={[0.1, 12, 10]} /><Mat c={SKIN} /></mesh>
          </group>
        ))}
        {/* head */}
        <group ref={head} position={[0, 2.0, 0]}>
          <mesh castShadow><sphereGeometry args={[0.56, 32, 24]} /><Mat c={SKIN} rough={0.6} /></mesh>
          {/* fringe */}
          <mesh><sphereGeometry args={[0.575, 32, 12, PI / 2 - 1.05, 2.1, 0.1 * PI, 0.33 * PI]} /><Mat c={HAIR} side={DS} /></mesh>
          {/* headscarf: shell open at the face + top cap + knot */}
          <mesh castShadow><sphereGeometry args={[0.64, 32, 24, PI / 2 + 1.0, 2 * PI - 2.0, 0, 0.8 * PI]} /><Mat c={SCARF} side={DS} rough={0.9} /></mesh>
          <mesh><sphereGeometry args={[0.645, 32, 8, 0, 2 * PI, 0, 0.16 * PI]} /><Mat c={SCARF} side={DS} rough={0.9} /></mesh>
          <mesh position={[0.22, -0.56, 0.32]}><sphereGeometry args={[0.12, 14, 12]} /><Mat c={SCARF} rough={0.9} /></mesh>
          <mesh position={[0.42, -0.62, 0.3]} rotation={[0, 0, 1.1]}><coneGeometry args={[0.14, 0.42, 4]} /><Mat c={SCARF} rough={0.9} /></mesh>
          <mesh position={[0.1, -0.75, 0.34]} rotation={[0, 0, -0.25]}><coneGeometry args={[0.12, 0.38, 4]} /><Mat c={SCARF} rough={0.9} /></mesh>
          {/* eyes */}
          {[-0.2, 0.2].map((x) => (
            <group key={x} position={[x, 0.0, 0.47]}>
              <mesh scale={[1, 1.15, 0.6]}><sphereGeometry args={[0.14, 20, 16]} /><Mat c="#ffffff" rough={0.3} /></mesh>
              <mesh position={[0.01, -0.01, 0.065]} scale={[1, 1, 0.5]}><sphereGeometry args={[0.092, 18, 14]} /><Mat c={EYE} rough={0.3} /></mesh>
              <mesh position={[0.01, -0.01, 0.1]} scale={[1, 1, 0.5]}><sphereGeometry args={[0.048, 14, 10]} /><Mat c="#0b0b0b" rough={0.2} /></mesh>
              <mesh position={[0.04, 0.035, 0.12]}><sphereGeometry args={[0.022, 8, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
              <mesh position={[0, 0.17, 0.02]} rotation={[0, 0, x > 0 ? -0.15 : 0.15]}><boxGeometry args={[0.16, 0.022, 0.02]} /><Mat c="#b98a4a" /></mesh>
            </group>
          ))}
          {/* cheeks, nose, smile */}
          {[-0.33, 0.33].map((x) => (
            <mesh key={x} position={[x, -0.17, 0.4]} scale={[1, 0.75, 0.4]}><sphereGeometry args={[0.11, 12, 10]} /><Mat c="#f39a9a" transparent opacity={0.7} /></mesh>
          ))}
          <mesh position={[0, -0.1, 0.55]}><sphereGeometry args={[0.055, 12, 10]} /><Mat c="#f5bfa6" /></mesh>
          <mesh position={[0.04, -0.24, 0.5]} rotation={[0.2, 0, PI + 0.15]}><torusGeometry args={[0.12, 0.022, 8, 20, PI * 0.85]} /><Mat c="#c4505c" /></mesh>
        </group>
        {/* back of the scarf hanging down */}
        <mesh position={[0, 1.55, -0.32]} rotation={[0.2, 0, 0]}><coneGeometry args={[0.38, 0.6, 4]} /><Mat c={SCARF} rough={0.9} /></mesh>
      </group>
    </group>
  );
}

const FUR = '#8c4a1d';
const BELLY = '#d9a04c';
const FACE = '#f1cf86';

/**
 * The bear companion. `mood`: idle | talk | happy | sad. `motion` ref like the girl's.
 */
export function Bear({ mood = 'idle', motion, ...props }) {
  const root = useRef(); const head = useRef();
  const armL = useRef(); const armR = useRef();
  const legL = useRef(); const legR = useRef(); const brow = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const sp = Math.min(1, motion?.current?.speed || 0);
    const swing = Math.sin(t * 9) * 0.5 * sp;
    legL.current.rotation.x = swing; legR.current.rotation.x = -swing;
    let y = Math.sin(t * 1.8) * 0.03;
    let headX = 0; let headZ = Math.sin(t * 0.9) * 0.05;
    let aL = -0.25 - swing * 0.6; let aR = 0.25;
    if (mood === 'talk') { headX = Math.sin(t * 9) * 0.07; aR = 0.6 + Math.sin(t * 4) * 0.4; }
    if (mood === 'happy') { y = Math.abs(Math.sin(t * 6)) * 0.45; aL = -2.4; aR = 2.4; }
    if (mood === 'sad') { headX = 0.25; headZ = 0.15; }
    root.current.position.y = y;
    head.current.rotation.x = headX;
    head.current.rotation.z = headZ;
    armL.current.rotation.z = THREE.MathUtils.lerp(armL.current.rotation.z, aL, 0.15);
    armR.current.rotation.z = THREE.MathUtils.lerp(armR.current.rotation.z, aR, 0.15);
    armR.current.rotation.x = mood === 'idle' ? -0.5 : 0; // hand-on-hip pose when idle
    brow.current.position.y = 0.42 + (mood === 'sad' ? -0.03 : mood === 'happy' ? 0.05 : 0);
  });

  return (
    <group {...props}>
      <group ref={root}>
        {[[-0.45, legL], [0.45, legR]].map(([x, ref]) => (
          <group key={x} ref={ref} position={[x, 0.75, 0]}>
            <mesh position={[0, -0.38, 0]} castShadow><cylinderGeometry args={[0.36, 0.4, 0.78, 16]} /><Mat c={FUR} rough={1} /></mesh>
            <mesh position={[0, -0.72, 0.15]} scale={[1, 0.45, 1.3]} castShadow><sphereGeometry args={[0.38, 16, 12]} /><Mat c={FUR} rough={1} /></mesh>
          </group>
        ))}
        <mesh position={[0, 1.65, 0]} scale={[1, 1.22, 0.88]} castShadow><sphereGeometry args={[1.1, 32, 24]} /><Mat c={FUR} rough={1} /></mesh>
        <mesh position={[0, 1.55, 0.5]} scale={[0.78, 1.0, 0.55]}><sphereGeometry args={[1.0, 32, 24]} /><Mat c={BELLY} rough={1} /></mesh>
        {[[-1.02, armL, -1], [1.02, armR, 1]].map(([x, ref, s]) => (
          <group key={x} ref={ref} position={[x, 2.25, 0]}>
            <mesh position={[0, -0.55, 0]} castShadow><capsuleGeometry args={[0.28, 0.75, 8, 14]} /><Mat c={FUR} rough={1} /></mesh>
            {[-0.1, 0, 0.1].map((cx) => (
              <mesh key={cx} position={[cx * s, -1.08, 0.1]} rotation={[0.3, 0, 0]}><coneGeometry args={[0.04, 0.16, 6]} /><Mat c="#6b3d1a" /></mesh>
            ))}
          </group>
        ))}
        <group ref={head} position={[0, 3.12, 0.05]}>
          <mesh castShadow><sphereGeometry args={[0.75, 32, 24]} /><Mat c={FUR} rough={1} /></mesh>
          <mesh position={[0, -0.05, 0.36]} scale={[0.95, 0.95, 0.62]}><sphereGeometry args={[0.62, 32, 24]} /><Mat c={FACE} rough={1} /></mesh>
          <mesh position={[0, -0.18, 0.66]} scale={[1.05, 0.85, 0.8]}><sphereGeometry args={[0.34, 24, 18]} /><Mat c={FACE} rough={1} /></mesh>
          <mesh position={[0, -0.06, 0.95]} scale={[1.35, 0.95, 1]}><sphereGeometry args={[0.17, 20, 16]} /><Mat c="#111111" rough={0.25} /></mesh>
          <mesh position={[-0.05, -0.01, 1.1]}><sphereGeometry args={[0.035, 8, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
          <mesh position={[0, -0.36, 0.86]} rotation={[0.3, 0, PI]}><torusGeometry args={[0.13, 0.02, 8, 16, PI * 0.8]} /><Mat c="#5a2c0c" /></mesh>
          {[-0.2, 0.2].map((x) => (
            <group key={x} position={[x, 0.24, 0.66]}>
              <mesh><sphereGeometry args={[0.085, 14, 12]} /><Mat c="#ffffff" rough={0.3} /></mesh>
              <mesh position={[0, 0, 0.05]}><sphereGeometry args={[0.05, 12, 10]} /><Mat c="#6b3a12" rough={0.3} /></mesh>
              <mesh position={[0, 0, 0.085]}><sphereGeometry args={[0.022, 8, 8]} /><Mat c="#000" /></mesh>
            </group>
          ))}
          <group ref={brow} position={[0, 0.42, 0.58]}>
            {[-0.22, 0.22].map((x) => (
              <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, x > 0 ? PI / 2 - 0.25 : PI / 2 + 0.25]}><capsuleGeometry args={[0.04, 0.22, 4, 8]} /><Mat c="#4a250b" /></mesh>
            ))}
          </group>
          {[-0.58, 0.58].map((x) => (
            <group key={x} position={[x, 0.55, -0.05]}>
              <mesh scale={[1, 1, 0.6]}><sphereGeometry args={[0.26, 16, 12]} /><Mat c={FUR} rough={1} /></mesh>
              <mesh position={[0, 0, 0.1]} scale={[1, 1, 0.4]}><sphereGeometry args={[0.15, 12, 10]} /><Mat c="#d7a074" /></mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
