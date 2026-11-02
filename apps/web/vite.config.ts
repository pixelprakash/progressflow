import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev the API runs on :4000; proxying keeps the session cookie same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/v1': 'http://localhost:4000', '/healthz': 'http://localhost:4000' },
  },
});
