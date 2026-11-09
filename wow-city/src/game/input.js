/** Shared, mutable movement input for the City Explorer level (joystick + keyboard). */
export const input = { jx: 0, jy: 0, keys: new Set(), jump: false };

export function readMove() {
  let x = input.jx;
  let y = input.jy;
  const k = input.keys;
  if (k.has('ArrowLeft') || k.has('KeyA')) x -= 1;
  if (k.has('ArrowRight') || k.has('KeyD')) x += 1;
  if (k.has('ArrowUp') || k.has('KeyW')) y -= 1;
  if (k.has('ArrowDown') || k.has('KeyS')) y += 1;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}
