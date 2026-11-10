import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * A small particle system (one draw call): sparkles for coins and stars,
 * dust when landing, puffs for stomps and fireworks for the finale.
 * Call fx.current.burst(...) from the game loop.
 */
const MAX = 1500;

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.8)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function Particles({ api }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { map: { value: dotTexture() } },
    vertexShader: `attribute float size; varying vec3 vColor; void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vColor; void main(){ vec4 t = texture2D(map, gl_PointCoord); if (t.a < 0.02) discard; gl_FragColor = vec4(vColor, t.a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
  }), []);
  const parts = useRef([]);
  const col = useMemo(() => new THREE.Color(), []);

  api.current = {
    burst(x, y, z, { n = 14, colors = ['#ffd34d'], speed = 4, life = 0.7, size = 0.35, gravity = 6, spread = Math.PI * 2, up = 0 } = {}) {
      for (let i = 0; i < n; i++) {
        if (parts.current.length >= MAX) parts.current.shift();
        const a = Math.random() * spread - spread / 2 + Math.PI / 2 * (spread < Math.PI * 2 ? 1 : 0);
        const v = speed * (0.4 + Math.random() * 0.6);
        const ang = spread >= Math.PI * 2 ? Math.random() * Math.PI * 2 : a;
        const el = Math.random() * Math.PI - Math.PI / 2;
        parts.current.push({
          x, y, z,
          vx: Math.cos(ang) * Math.cos(el) * v, vy: Math.sin(ang) * v + up, vz: Math.sin(el) * v * 0.5,
          life, max: life, size: size * (0.6 + Math.random() * 0.8), gravity, color: colors[i % colors.length],
        });
      }
    },
  };

  useFrame((_, dt) => {
    const arr = parts.current;
    const pos = geo.attributes.position.array; const c = geo.attributes.color.array; const s = geo.attributes.size.array;
    let n = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) { arr.splice(i, 1); continue; }
      p.vy -= p.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
      col.set(p.color);
      const k = Math.min(1, p.life / p.max * 1.5);
      c[n * 3] = col.r * k; c[n * 3 + 1] = col.g * k; c[n * 3 + 2] = col.b * k;
      s[n] = p.size;
      n++;
    }
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.attributes.size.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
