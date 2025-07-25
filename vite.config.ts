import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  optimizeDeps: {
    include: ['@mediapipe/tasks-vision'],
  },
  build: {
    sourcemap: true,
    outDir: 'dist',
  },
});
