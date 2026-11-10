/**
 * Every gameplay number lives here so it can be tuned without touching code.
 * Units: 1 world unit = 1 block. Time in seconds.
 */
export const TUNING = {
  player: {
    width: 0.8,
    height: 1.7,
    runSpeed: 7.2,
    accelGround: 55,
    turnBoost: 2.2, // extra grip when reversing direction, so turns feel snappy
    accelAir: 32,
    friction: 48,
    gravity: 40,
    maxFall: 24,
    jumpVelocity: 15.2, // apex ≈ v²/2g ≈ 2.9 blocks
    jumpCut: 0.45, // releasing jump early multiplies upward speed by this
    coyoteTime: 0.1,
    jumpBuffer: 0.12,
    stompBounce: 11,
    hurtKnockback: 7,
    invulnTime: 1.6,
    maxHearts: 3,
  },
  power: {
    superJump: { duration: 14, jumpVelocity: 17.5, doubleJumps: 1 },
    shield: { duration: 10 },
  },
  rewards: {
    coin: 1,
    questionCorrect: 10,
    star: 5,
    blockCoin: 1,
    stomp: 2,
    stageClearBonus: 0,
  },
  enemy: { speed: 1.6, width: 0.9, height: 0.9 },
  plant: { period: 4.2, rise: 1.6, width: 0.8, height: 1.4 },
  mushroom: { speed: 2.6 },
  camera: { distance: 13.5, height: 4.2, lookAt: 2.4, lookAhead: 2.2, lerp: 4 },
  physics: { maxStep: 1 / 120, killDepth: -10 },
  level: {
    // Limits the generator obeys so every jump is reachable without power-ups.
    maxGap: 3.5,
    maxRise: 2.2,
    blockY: 3.6, // bottom of floating blocks above ground (reachable from y=0)
  },
};
