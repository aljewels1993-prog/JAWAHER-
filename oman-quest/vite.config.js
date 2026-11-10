import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { offlineServiceWorker } from './tools/sw-plugin.js';

// `npm run build`        -> static site in dist/ (deploy anywhere, e.g. GitHub Pages)
// `npm run build:single` -> one self-contained HTML file in dist-single/
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [offlineServiceWorker()])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2500,
    assetsInlineLimit: mode === 'single' ? 100000000 : 4096,
  },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
}));
