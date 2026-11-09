import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { useGame } from './game/store.js';
import './styles.css';

// Automated tests open the game with ?test to inspect the game state.
if (new URLSearchParams(window.location.search).has('test')) window.__game = useGame;

createRoot(document.getElementById('root')).render(<App />);
