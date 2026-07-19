import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest deliberately does NOT reuse vite.config.js: the @crxjs/vite-plugin
// there builds the MV3 manifest and rewrites entry points, which breaks the
// test runner. We only need React transform + JSX here.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}', 'test/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.{test,spec}.{js,jsx}', 'src/test/**', 'src/main.jsx'],
      // Per-file floors on the core logic only — locks in the coverage of the
      // modules that can silently produce wrong results, without imposing a
      // global number the UI/DOM-driver layers (deliberately untested — see
      // ADR-0011) would drag down. Set just under measured values to avoid flake.
      thresholds: {
        'src/background/orchestrator.js': {
          statements: 84,
          branches: 68,
          functions: 92,
          lines: 84,
        },
        'src/background/prompts.js': {
          statements: 100,
          branches: 80,
          functions: 100,
          lines: 100,
        },
        'src/content/selectors.js': { statements: 100, functions: 100, lines: 100 },
        'src/shared/constants.js': { statements: 100, functions: 100, lines: 100 },
        'src/ui/settings.js': { statements: 100, functions: 100, lines: 100 },
      },
    },
  },
})
