import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  worker: {
    // Radiosity and photon workers are ES modules.
    format: 'es',
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
