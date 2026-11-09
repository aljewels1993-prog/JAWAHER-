/** City layout for the hub and City Explorer level. Buildings face +z (towards the camera). */
export const CITY_LAYOUT = [
  { id: 'castle', x: -24, z: -18 },
  { id: 'tower', x: -8, z: -18 },
  { id: 'skyscraper', x: 8, z: -18 },
  { id: 'palace', x: 24, z: -18 },
  { id: 'factory', x: -24, z: 0 },
  { id: 'office_building', x: -8, z: 0 },
  { id: 'apartment_building', x: 8, z: 0 },
  { id: 'hospital', x: 24, z: 0 },
  { id: 'harbour', x: -24, z: 18 },
  { id: 'stadium', x: -8, z: 18 },
  { id: 'swimming_pool', x: 8, z: 18 },
  { id: 'sports_centre', x: 24, z: 18 },
];

export const BUILDING_HALF = 5; // collision half-size of each block
export const TRIGGER_DIST = 1.6; // how close the player must get to "visit" a place
export const BOUNDS = { x: 34, z: 29 };
export const PLAYER_START = { x: 0, z: 9 };

/** Distance from point to a building's square footprint (0 when inside). */
export function distToBlock(px, pz, b) {
  const dx = Math.max(Math.abs(px - b.x) - BUILDING_HALF, 0);
  const dz = Math.max(Math.abs(pz - b.z) - BUILDING_HALF, 0);
  return Math.hypot(dx, dz);
}

/** Push a point out of every building footprint (radius r). Returns [x, z]. */
export function collide(px, pz, r = 0.5) {
  let x = px; let z = pz;
  for (const b of CITY_LAYOUT) {
    const h = BUILDING_HALF + r;
    const dx = x - b.x; const dz = z - b.z;
    if (Math.abs(dx) < h && Math.abs(dz) < h) {
      if (h - Math.abs(dx) < h - Math.abs(dz)) x = b.x + Math.sign(dx || 1) * h;
      else z = b.z + Math.sign(dz || 1) * h;
    }
  }
  x = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, x));
  z = Math.max(-BOUNDS.z, Math.min(BOUNDS.z, z));
  return [x, z];
}

/** Nearest building the player is standing next to, or null. */
export function nearestBuilding(px, pz) {
  let best = null; let bd = Infinity;
  for (const b of CITY_LAYOUT) {
    const d = distToBlock(px, pz, b);
    if (d < bd) { bd = d; best = b; }
  }
  return bd <= TRIGGER_DIST ? best : null;
}

/** Coins placed along the roads. */
export const COINS = (() => {
  const out = [];
  [-16, 0, 16].forEach((x) => { for (let z = -24; z <= 24; z += 6) out.push([x, z]); });
  [-9, 9].forEach((z) => { for (let x = -30; x <= 30; x += 6) if (![-16, 0, 16].includes(x)) out.push([x, z]); });
  return out.map(([x, z], i) => ({ id: i, x, z }));
})();
