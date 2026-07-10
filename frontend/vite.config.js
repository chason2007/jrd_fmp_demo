import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: proxy /api to the backend so the browser sees one origin (localhost:5173).
// This keeps the SameSite=Strict refresh cookie working without cross-site requests.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
    host: true,
  },
});
