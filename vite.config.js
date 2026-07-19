import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config.js'

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  build: {
    // Chrome extensions cannot use inline scripts under MV3 CSP; keep output clean.
    rollupOptions: {
      input: {
        // The side panel HTML entry.
        index: 'index.html',
      },
    },
  },
})
