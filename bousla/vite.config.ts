/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode artifact` builds one self-contained HTML file (preview/demo page).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'artifact' ? [react(), viteSingleFile()] : [react()],
  base: process.env.BASE_PATH || '/',
  build: mode === 'artifact'
    ? { target: 'es2020', outDir: 'dist-artifact', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 5000 }
    : { target: 'es2020', chunkSizeWarningLimit: 900 },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
}));
