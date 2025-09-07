import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Use relative paths for assets
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5173,
  },
});