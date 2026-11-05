import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development the SPA runs on :5173 and proxies the API (and uploaded files) to the API server.
// In production the API server serves the built SPA itself, so there is a single origin.
const api = process.env.API_URL ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // keep the browser's Host header (changeOrigin: false): the API checks that the Origin of
    // state-changing requests matches it
    proxy: {
      '/api': { target: api, changeOrigin: false },
      '/uploads': { target: api, changeOrigin: false },
    },
  },
});
