import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from './game/store.js';
import { dirOf } from './game/i18n.js';
import { bindKeyboard } from './game/input.js';
import GameScene from './scenes/GameScene.jsx';
import MapScene from './scenes/MapScene.jsx';
import MenuScene from './scenes/MenuScene.jsx';
import { Welcome, NameEntry, MapPanel, Instructions, Leaderboard, Toasts, TopBar, InstallHelp } from './ui/Screens.jsx';
import { HUD, TouchControls, PauseMenu, GameOver, Results } from './ui/HUD.jsx';
import { QuestionPanel } from './ui/QuestionPanel.jsx';
import { Certificate } from './ui/Certificate.jsx';
import { TeacherDashboard } from './ui/Teacher.jsx';

function Scene() {
  const screen = useGame((s) => s.screen);
  const runKey = useGame((s) => s.runKey);
  const playStage = useGame((s) => s.playStage);
  const selectOnMap = useGame((s) => s.selectOnMap);
  if (screen === 'game') return <GameScene key={runKey} />;
  if (screen === 'map') return <MapScene onPick={(id) => selectOnMap(id)} onPlay={playStage} />;
  return <MenuScene />;
}

export default function App() {
  const s = useGame();
  const { screen, lang, overlay, question, ready } = s;

  useEffect(() => { s.init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
  }, [lang]);
  useEffect(() => bindKeyboard(() => {
    const g = useGame.getState();
    if (g.screen === 'game' && !g.question && !g.results) g.setOverlay(g.overlay === 'pause' ? null : 'pause');
  }), []);

  const threeScreens = ['welcome', 'name', 'map', 'game'];
  return (
    <div className={`app screen-${screen}`} dir={dirOf(lang)}>
      {threeScreens.includes(screen) && (
        <Canvas
          className="stage-canvas"
          dpr={[1, 2]}
          camera={{ fov: 50, near: 0.1, far: 900, position: [0, 6, 18] }}
          gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
          onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
        >
          <Suspense fallback={null}><Scene /></Suspense>
        </Canvas>
      )}
      {!ready && <div className="loading">Loading… جارِ التحميل</div>}
      {ready && (
        <>
          {screen !== 'game' && screen !== 'teacher' && screen !== 'certificate' && <TopBar />}
          {screen === 'welcome' && <Welcome />}
          {screen === 'name' && <NameEntry />}
          {screen === 'map' && <MapPanel />}
          {screen === 'game' && (
            <>
              <HUD />
              <TouchControls />
              {question && <QuestionPanel key={question.questionId} />}
              {overlay === 'pause' && <PauseMenu />}
              <GameOver />
              <Results />
            </>
          )}
          {screen === 'certificate' && <Certificate />}
          {screen === 'teacher' && <TeacherDashboard />}
          {overlay === 'instructions' && <Instructions />}
          {overlay === 'leaderboard' && <Leaderboard />}
          <InstallHelp />
          <Toasts />
        </>
      )}
    </div>
  );
}
