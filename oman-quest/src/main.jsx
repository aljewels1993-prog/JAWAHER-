import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { setupInstall } from './game/install.js';
import { loadVoices } from './game/voiceclips.js';

setupInstall();
loadVoices();

createRoot(document.getElementById('root')).render(<App />);
