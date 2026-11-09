import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from './game/store.js';
import { SceneRouter } from './scenes/Scenes.jsx';
import { HUD, BearBubble } from './ui/Common.jsx';
import { StartScreen, StoryScreen, HubScreen, CompleteScreen, FinalScreen } from './ui/Screens.jsx';
import { LevelRouter } from './levels/Levels.jsx';

export default function App() {
  const screen = useGame((s) => s.screen);
  const level = useGame((s) => s.level);
  const player = useGame((s) => s.player);
  const showHud = player && screen !== 'start';

  return (
    <div className="app">
      <Canvas
        className="scene"
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 45, near: 0.1, far: 400, position: [0, 30, 60] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <Suspense fallback={null}>
          <SceneRouter />
        </Suspense>
      </Canvas>

      <div className="ui">
        {showHud && <HUD />}
        <BearBubble />
        {screen === 'start' && <StartScreen />}
        {screen === 'story' && <StoryScreen />}
        {screen === 'hub' && <HubScreen />}
        {screen === 'level' && <LevelRouter />}
        {screen === 'complete' && <CompleteScreen />}
        {screen === 'final' && <FinalScreen />}
      </div>
      <div key={`${screen}-${level}`} className="transition" aria-hidden="true" />
    </div>
  );
}
