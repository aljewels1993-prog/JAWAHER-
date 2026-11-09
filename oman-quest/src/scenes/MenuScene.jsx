import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Cloud, Palm } from './Environment.jsx';
import { BurjAlSahwa } from './Burj.jsx';
import { HeroPuppet } from './Hero.jsx';
import { StarModel, MushroomModel, toon, coinMaterials } from './Props.jsx';
import { questionTexture, brickTexture } from './textures.js';
import * as THREE from 'three';

const coinGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.09, 28).rotateX(Math.PI / 2);
const coinMats = coinMaterials();

/** Welcome-screen backdrop: Burj Al Sahwa at dusk, the hero, floating treasures. */
export default function MenuScene() {
  const cam = useRef(0);
  const floaters = useRef();
  const hero = useRef({ vx: 0, vy: 0, onGround: true, facing: 1 });
  useFrame(({ camera, clock }, dt) => {
    cam.current += dt * 0.12;
    const a = Math.sin(cam.current) * 0.35;
    camera.position.set(Math.sin(a) * 31, 10, Math.cos(a) * 31);
    camera.lookAt(0, 11, 0);
    if (floaters.current) floaters.current.children.forEach((c, i) => { c.position.y = c.userData.y + Math.sin(clock.elapsedTime * 1.5 + i) * 0.3; c.rotation.y = clock.elapsedTime * (i % 2 ? 1.5 : -1.2); });
    hero.current = { vx: 0, vy: 0, onGround: true, facing: 1, celebrate: Math.sin(clock.elapsedTime * 0.5) > 0.6 };
  });
  return (
    <>
      <Sky top="#4a3f9e" bottom="#ffc58a" />
      <hemisphereLight args={['#ffe9d0', '#4a3a5a', 1.2]} />
      <directionalLight position={[-10, 20, 15]} intensity={1.6} color="#ffe2b8" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[60, 48]} /><meshStandardMaterial color="#5bb85a" /></mesh>
      <BurjAlSahwa position={[3, 0, -6]} showFlag />
      <group position={[-10.5, 0, 6]} scale={2.6}><HeroPuppet state={hero} /></group>
      {[[-14, -10], [14, -12], [-10, 4], [12, 2]].map(([x, z], i) => <Palm key={i} x={x} z={z} h={5 + i * 0.4} />)}
      <group ref={floaters}>
        {[[-9, 9, -2], [-7, 12, -4], [9, 11, 0], [11, 7, 2], [-11, 6, 2], [7, 14, -6]].map(([x, y, z], i) => (
          <group key={i} position={[x, y, z]} userData={{ y }} scale={1.6}>
            {i % 3 === 0 && <StarModel />}
            {i % 3 === 1 && <mesh geometry={coinGeo} material={coinMats} scale={1.4} />}
            {i % 3 === 2 && <MushroomModel kind={i === 5 ? 'shield' : 'jump'} />}
          </group>
        ))}
      </group>
      <group position={[-12, 11, -6]}>
        {[0, 1, 2].map((i) => <mesh key={i} position={[i, 0, 0]} material={toon('#fff', { map: i === 1 ? questionTexture() : brickTexture() })}><boxGeometry args={[1, 1, 1]} /></mesh>)}
      </group>
      <Cloud position={[-16, 16, -14]} scale={1.3} />
      <Cloud position={[16, 18, -18]} scale={1.1} />
    </>
  );
}
