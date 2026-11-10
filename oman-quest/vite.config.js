import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { offlineServiceWorker } from './tools/sw-plugin.js';

// `npm run build`        -> static site in dist/ (Netlify, GitHub Pages…)
// BASE_PATH: "/" on Netlify (set in netlify.toml) so deep links like
// /stage/3 still load /assets/…; defaults to "./" (works in any sub-folder).
// `npm run build:single` -> one self-contained HTML file in dist-single/
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH || './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [offlineServiceWorker()])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2500,
    assetsInlineLimit: mode === 'single' ? 100000000 : 4096,
  },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
}));
