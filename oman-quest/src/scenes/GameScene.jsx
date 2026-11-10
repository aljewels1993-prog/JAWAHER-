import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildLevel } from '../game/level.js';
import { createWorld, step, progressOf, pipeUnder, gateOpen } from '../game/sim.js';
import { input } from '../game/input.js';
import { sfx } from '../game/audio.js';
import { line } from '../game/lines.js';
import { STRINGS } from '../game/i18n.js';
import { useGame } from '../game/store.js';
import { answeredIds, liveCoins, totals } from '../game/progress.js';
import { STAGE_BY_ID } from '../data/stages.js';
import { TUNING } from '../data/tuning.js';
import { WorldCtx, Block, Coins, Stars, Items, Pipe, Plants, Enemies, Movers, Checkpoint, GateArch, toon, StarModel } from './Props.jsx';
import { Sky, Scenery, GroundPieces, SecretCave } from './Environment.jsx';
import { HeroPuppet } from './Hero.jsx';
import { BurjAlSahwa, RisingFlag } from './Burj.jsx';
import { Particles } from './Effects.jsx';

import { session } from '../game/session.js';

/** Shares the live world with the UI (and with automated play-tests via window.__oeq). */
const exposeWorld = (w) => {
  session.world = w;
  if (typeof window !== 'undefined') window.__oeq = { world: w, input };
};

function Signpost({ x, label }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#8a5a2e'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#ffd34d'; g.lineWidth = 8; g.strokeRect(6, 6, 116, 116);
    g.fillStyle = '#fff'; g.font = 'bold 70px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [label]);
  return (
    <group position={[x, 0, -1.2]}>
      <mesh position={[0, 0.7, 0]} material={toon('#6a4220')}><boxGeometry args={[0.15, 1.4, 0.15]} /></mesh>
      <mesh position={[0, 1.55, 0]}><boxGeometry args={[0.9, 0.9, 0.08]} /><meshStandardMaterial map={tex} /></mesh>
    </group>
  );
}

function StartArch({ x, stage }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#5b2bd6'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#ffd34d'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 118);
    g.fillStyle = '#fff'; g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`STAGE ${stage.id}`, 256, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [stage.id]);
  return (
    <group position={[x, 0, -1.8]}>
      {[-2, 2].map((dx) => <mesh key={dx} position={[dx, 2, 0]} material={toon('#e8d3a8')}><boxGeometry args={[0.6, 4, 0.6]} /></mesh>)}
      <mesh position={[0, 4.3, 0]}><boxGeometry args={[4.8, 1.1, 0.2]} /><meshStandardMaterial map={tex} /></mesh>
    </group>
  );
}

function Fireworks({ fx, active, center }) {
  const timer = useRef(0);
  useFrame((_, dt) => {
    if (!active.current || !fx.current) return;
    timer.current -= dt;
    if (timer.current <= 0) {
      timer.current = 0.35 + Math.random() * 0.35;
      const palettes = [['#ffffff', '#db161b', '#008000'], ['#ffd34d', '#fff2a0'], ['#5ff2df', '#ffd34d'], ['#db161b', '#ffffff']];
      fx.current.burst(center.x + (Math.random() - 0.5) * 22, center.y + 4 + Math.random() * 8, -2 - Math.random() * 6, { n: 90, colors: palettes[Math.floor(Math.random() * palettes.length)], speed: 9, life: 1.6, size: 1.3, gravity: 3 });
      sfx.firework();
    }
  });
  return null;
}

function OrbitingStars({ center, active }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.visible = active.current;
    ref.current.rotation.y = clock.elapsedTime * 0.6;
    ref.current.children.forEach((c, i) => { c.position.y = Math.sin(clock.elapsedTime * 2 + i) * 1.2; c.rotation.y = clock.elapsedTime * 3; });
  });
  return (
    <group ref={ref} position={[center.x, center.y + 2, -5]} visible={false}>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <group key={i} position={[Math.cos(a) * 8, 0, Math.sin(a) * 8]}><StarModel scale={1.4} /></group>;
      })}
    </group>
  );
}

export default function GameScene() {
  const stageId = useGame((s) => s.stageId);
  const runKey = useGame((s) => s.runKey);
  const stage = STAGE_BY_ID[stageId];
  const level = useMemo(() => buildLevel(stage), [stage]);
  const world = useRef(null);
  const heroState = useRef({ vx: 0, vy: 0, onGround: true, facing: 1 });
  const hero = useRef();
  const fx = useRef(null);
  const celebrate = useRef(false);
  const flagRaise = useRef(0);
  const victoryT = useRef(-1);
  const hudTimer = useRef(0);
  const shadow = useRef();
  const emote = useRef(null); // { type, start } in clock seconds
  const idle = useRef(0);
  const bubble = useRef({ text: '', until: 0, nextGuide: 6 });
  const bubbleEl = useRef(null);
  const coinCount = useRef(0);
  const clockRef = useRef(0);
  const { camera, size } = useThree();

  /** Make the hero react: a short animation plus an optional speech bubble. */
  const react = (type, text, secs = 2.2, mood = 'happy') => {
    if (type) emote.current = { type, start: clockRef.current };
    if (text) bubble.current = { ...bubble.current, text, mood, until: clockRef.current + secs };
    idle.current = 0;
  };
  const MOOD_EMOTE = { happy: 'cheer', excited: 'spin', sad: 'sad', calm: 'learn' };
  /**
   * In the level she reacts with a (silent) speech bubble and body language.
   * Her voice is used only for right / wrong answers, in the question panel.
   */
  const talk = (lnOrKind, n, { emote: em, secs = 2.6 } = {}) => {
    const ln = typeof lnOrKind === 'string' ? line(lnOrKind, n) : lnOrKind;
    const lang = useGame.getState().lang;
    react(em || MOOD_EMOTE[ln.mood], lang === 'ar' ? ln.ar : ln.en, secs, ln.mood);
  };


  // fresh world for each run
  if (!world.current || world.current.runKey !== runKey) {
    const profile = useGame.getState().profile;
    world.current = createWorld(level, { answered: answeredIds(profile) });
    world.current.runKey = runKey;
    exposeWorld(world.current);
  }

  useEffect(() => {
    celebrate.current = false; flagRaise.current = 0; victoryT.current = -1;
    emote.current = null; idle.current = 0;
    bubble.current = { text: '', until: 0, nextGuide: 6 };

    const w = world.current;
    const aspect = size.width / size.height;
    camera.position.set(w.player.x + 2, w.player.y + TUNING.camera.height, TUNING.camera.distance * (aspect < 1 ? Math.max(1, 0.95 / aspect) : 1));
  }, [runKey, camera]); // eslint-disable-line react-hooks/exhaustive-deps

  const towerCenter = level.tower ? new THREE.Vector3(level.tower.x + level.tower.w / 2, level.tower.roofY, 0) : null;

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const w = world.current;
    const G = useGame.getState();
    const paused = G.overlay === 'pause' || G.question || G.results || G.gameOver;
    clockRef.current = state.clock.elapsedTime;
    // reaction after a grammar question closes
    if (session.heroReaction && !G.question) {
      const r = session.heroReaction; session.heroReaction = null;
      react(r.type, r.text || null, 2.6, r.mood); // bubble only if she spoke in the panel
      if (r.type === 'cheer') fx.current?.burst(w.player.x, w.player.y + 2.2, 0.5, { n: 30, colors: ['#ffd34d', '#5ff2df', '#c79bff'], speed: 4, life: 0.9, size: 0.4 });
    }

    if (!paused && (w.status === 'playing')) {
      const ev = step(w, dt, input);
      input.jumpPressed = false; input.downPressed = false;
      for (const e of ev) handleEvent(e, w, G);
    }

    // finale: flag rises, fireworks, then the champion screen
    if (w.status === 'victory') {
      if (victoryT.current < 0) { victoryT.current = 0; celebrate.current = true; sfx.fanfare(); G.toast('🎆 برج الصحوة! 🎆', 'win'); }
      victoryT.current += dt;
      flagRaise.current = Math.min(1, victoryT.current / 3);
      if (victoryT.current > 5.5 && !G.results) G.finishStage({ coins: w.stats.coins, stars: w.stats.stars, secret: w.secretFound, totalStars: level.totalStars });
    }

    // hero puppet
    const p = w.player;
    // idle time (no input, standing) drives the "look at the player" pose and guidance
    const active = input.left || input.right || input.jump || !p.onGround;
    idle.current = active || paused ? 0 : idle.current + dt;
    if (!paused && w.status === 'playing' && idle.current > 8 && clockRef.current > bubble.current.nextGuide) {
      talk({ ...guideLine(w, level), mood: 'calm' }, 0, { emote: 'wave', secs: 3.2 });
      bubble.current.nextGuide = clockRef.current + 30;
    }
    heroState.current = {
      vx: p.vx, vy: p.vy, onGround: p.onGround, facing: p.facing, invuln: p.invuln,
      power: p.power?.type, celebrate: celebrate.current, landedAt: p.landedAt, t: w.t,
      skid: p.onGround && Math.abs(p.vx) > 1.5 && Math.sign(p.vx) !== p.facing,
      idleFor: idle.current, emote: emote.current,
    };
    // speech bubble above her head (a DOM element positioned from 3D)
    if (!bubbleEl.current) bubbleEl.current = document.getElementById('hero-bubble');
    const el = bubbleEl.current;
    if (el) {
      const show = clockRef.current < bubble.current.until && !paused && w.status === 'playing';
      if (show) {
        const v = new THREE.Vector3(p.x, p.y + 2.55, 0.3).project(camera);
        el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -100%)`;
        if (el.textContent !== bubble.current.text) el.textContent = bubble.current.text;
        if (el.dataset.mood !== bubble.current.mood) el.dataset.mood = bubble.current.mood || 'happy';
      }
      el.classList.toggle('show', show);
    }
    if (hero.current) hero.current.position.set(p.x, p.y, 0.3);
    if (shadow.current) {
      const top = groundBelow(w, p);
      shadow.current.position.set(p.x, top + 0.03, 0.3);
      const h = Math.max(0, p.y - top);
      shadow.current.scale.setScalar(Math.max(0.3, 1 - h * 0.12));
      shadow.current.visible = top > -50 || p.inSecret;
    }

    // camera follow (wider view on portrait phones)
    const aspect = size.width / size.height;
    const C = TUNING.camera;
    const dist = C.distance * (aspect < 1 ? Math.max(1, 0.95 / aspect) : 1);
    let tx; let ty; let tz;
    if (w.status === 'victory' && towerCenter) {
      const a = victoryT.current * 0.35;
      tx = towerCenter.x + Math.sin(a) * 18; ty = towerCenter.y + 3; tz = Math.cos(a) * 18;
      camera.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, dt * 1.5));
      camera.lookAt(towerCenter.x, towerCenter.y - 2, -4);
    } else {
      tx = p.x + p.facing * C.lookAhead;
      ty = Math.max(p.y + C.height, p.inSecret ? p.y + C.height : C.height);
      tz = dist;
      const k = Math.min(1, dt * C.lerp);
      camera.position.x += (tx - camera.position.x) * k;
      camera.position.y += (ty - camera.position.y) * k;
      camera.position.z += (tz - camera.position.z) * k;
      camera.lookAt(camera.position.x, camera.position.y - C.lookAt, 0);
    }

    // HUD snapshot ~8x per second
    hudTimer.current -= dt;
    if (hudTimer.current <= 0) {
      hudTimer.current = 0.12;
      const prof = G.profile;
      if (prof) {
        G.setHud({
          coins: liveCoins(prof, stageId, w.stats.coins), stars: totals(prof).stars + w.stats.stars, hearts: p.hearts,
          progress: progressOf(w), power: p.power?.type || null, powerT: p.power ? p.power.t / p.power.total : 0,
          onPipe: !!pipeUnder(w)?.target, runCoins: w.stats.coins, runStars: w.stats.stars,
          questionsDone: level.grammar.filter((g) => w.answered.has(g.questionId)).length,
          stageStars: w.stats.stars, stageStarsTotal: level.totalStars,
          gateOpen: gateOpen(w),
        });
      }
    }
  });

  /** The student taps / clicks the hero: she hops, waves and says something useful. */
  function tapHero() {
    const w = world.current;
    if (w.status !== 'playing') return;
    sfx.click();
    if (Math.random() < 0.4) talk({ ...guideLine(w, level), mood: 'happy' }, 0, { emote: 'wave' });
    else talk('tap', 0, { emote: Math.random() < 0.5 ? 'cheer' : 'hop' });
  }

  function handleEvent(e, w, G) {
    const p = w.player;
    const f = fx.current;
    switch (e.type) {
      case 'jump': e.double ? sfx.doubleJump() : sfx.jump(); if (e.double) f?.burst(p.x, p.y + 0.3, 0.3, { n: 12, colors: ['#ff4d4d', '#ffd34d'], speed: 3, gravity: 2 }); break;
      case 'land': if (p.vy === 0) f?.burst(p.x, p.y + 0.05, 0.4, { n: 6, colors: ['#e8d8b8'], speed: 1.5, life: 0.35, size: 0.25, gravity: 1 }); break;
      case 'coin': sfx.coin(); if (!emote.current || clockRef.current - emote.current.start > 0.8) react('hop');
        coinCount.current += 1;
        f?.burst(e.x, e.y, 0.2, { n: 10, colors: ['#ffd34d', '#fff2a0'], speed: 3, life: 0.5, size: 0.3 }); break;
      case 'star': sfx.star(); f?.burst(e.x, e.y, 0.2, { n: 30, colors: ['#ffd34d', '#ffffff', '#ff9d2e'], speed: 5, life: 0.8, size: 0.45 }); if (w.stats.stars >= level.totalStars) talk('allStars', 0, { emote: 'spin' }); // special moment only
        else react('spin');
        break;
      case 'bump': sfx.bump(); break;
      case 'reveal': sfx.reveal(); break;
      case 'power': sfx.power(); react('spin'); G.toast(e.power === 'jump' ? `🍄 ${G.t().powerJump}` : `🛡️ ${G.t().powerShield}`, 'power'); break;
      case 'powerEnd': sfx.powerEnd(); break;
      case 'stomp': sfx.stomp(); f?.burst(e.x, e.y + 0.4, 0.3, { n: 14, colors: ['#ffffff', '#c9a26b'], speed: 3, life: 0.5 }); break;
      case 'hurt': sfx.hurt(); react('ouch'); break;
      case 'fall': sfx.hurt(); react('sad'); break;
      case 'gameover': G.setGameOver(true); break;
      case 'checkpoint': sfx.checkpoint(); react('wave'); break;
      case 'pipe':
        sfx.pipe();
        if (e.into === 'secret') { w.secretFound = true; G.toast(`🗝️ ${G.t().secretFound}`, 'star'); }
        camera.position.set(p.x, p.y + 3, camera.position.z);
        break;
      case 'question': sfx.reveal(); G.openQuestion(e.questionId); break;
      case 'gateLocked': sfx.locked(); react('learn'); G.toast(`🔒 ${(level.final ? G.t().towerLocked : G.t().gateLocked)(e.remaining)}`, 'warn'); break;
      case 'finished':
        sfx.fanfare(); celebrate.current = true;
        f?.burst(p.x, p.y + 2, 0.5, { n: 60, colors: ['#ffd34d', '#5ff2df', '#ffffff'], speed: 6, life: 1.2 });
        setTimeout(() => useGame.getState().finishStage({ coins: w.stats.coins, stars: w.stats.stars, secret: w.secretFound, totalStars: level.totalStars }), 1400);
        break;
      default: break;
    }
  }

  const blocks = level.solids.filter((s) => ['brick', 'qblock', 'grammar', 'stone'].includes(s.kind));
  const finishX = level.finish?.x ?? 0;

  return (
    <WorldCtx.Provider value={world}>
      <Sky top={stage.theme.sky[0]} bottom={stage.theme.sky[1]} />
      <hemisphereLight args={['#ffffff', '#7a6a50', 1.2]} />
      <directionalLight position={[20, 30, 20]} intensity={1.8} />
      <ambientLight intensity={0.35} />
      <Scenery stage={stage} length={level.length} />
      <SecretCave secret={level.secret} />
      <GroundPieces solids={level.solids} kind={stage.theme.ground} />
      {blocks.map((s) => <Block key={s.id} s={s} />)}
      {level.pipes.map((p) => <Pipe key={p.id} p={p} />)}
      <Coins coins={level.coins} />
      <Stars stars={level.stars} />
      <Items />
      <Plants plants={level.plants} />
      <Enemies enemies={level.enemies} />
      <Movers movers={level.movers} />
      {level.checkpoints.map((cp) => <Checkpoint key={cp.id} cp={cp} />)}
      {level.decor.map((d, i) => {
        if (d.type === 'sign') return <Signpost key={i} x={d.x} label={d.label} />;
        if (d.type === 'startArch') return <StartArch key={i} x={d.x} stage={stage} />;
        if (d.type === 'finishArch') return <GateArch key={i} x={d.x} locked />;
        return null;
      })}
      {level.finish && !level.final && (
        <RisingFlag position={[finishX + 1, 0, -0.5]} raise={{ current: 1 }} />
      )}
      {level.tower && (
        <>
          <BurjAlSahwa position={[level.tower.x + level.tower.w / 2, -0.8, -5.4]} />
          {/* walkway along the top, where she raises the flag */}
          <mesh position={[level.tower.x + level.tower.w / 2, level.tower.roofY - 0.06, -0.2]} material={toon('#5a3a32')}><boxGeometry args={[level.tower.w, 0.12, 1.4]} /></mesh>
          <mesh position={[level.tower.x + level.tower.w / 2, level.tower.roofY + 0.02, 0.45]} material={toon('#d9a441')}><boxGeometry args={[level.tower.w, 0.08, 0.1]} /></mesh>
          <RisingFlag position={[level.tower.flagX, level.tower.roofY, -0.4]} raise={flagRaise} />
          <Fireworks fx={fx} active={celebrate} center={towerCenter} />
          <OrbitingStars center={towerCenter} active={celebrate} />
        </>
      )}
      <group ref={hero} onClick={(e) => { e.stopPropagation(); tapHero(); }}><HeroPuppet state={heroState} /></group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <Particles api={fx} />
    </WorldCtx.Provider>
  );
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** What the hero suggests next (both languages): the next grammar block, or the open gate. */
function guideLine(w, level) {
  const p = w.player;
  const left = level.grammar.filter((g) => !w.answered.has(g.questionId));
  const both = (key, ...a) => {
    const [en, ar] = ['en', 'ar'].map((l) => { const b = STRINGS[l].bubble[key]; return typeof b === 'function' ? b(...a) : b; });
    return { en, ar };
  };
  if (left.length === 0) return both('gateOpen');
  if (left.some((g) => g.x < p.x - 2) && !left.some((g) => g.x >= p.x - 2)) return both('behind');
  return both('ahead', left.length);
}

/** Height of the highest surface under the player (for the blob shadow). */
function groundBelow(w, p) {
  let best = -100;
  for (const s of w.level.solids) {
    const top = s.y + s.h;
    if (p.x >= s.x && p.x <= s.x + s.w && top <= p.y + 0.05 && top > best) best = top;
  }
  for (const m of w.movers) {
    const top = m.cy + m.h;
    if (Math.abs(p.x - m.cx) <= m.w / 2 && top <= p.y + 0.05 && top > best) best = top;
  }
  return best;
}
