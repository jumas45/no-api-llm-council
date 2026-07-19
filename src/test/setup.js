// Global test setup, loaded before every test file (see vitest.config.js).
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount React trees between tests so the jsdom document stays clean.
afterEach(() => {
  cleanup()
})

// Minimal chrome.* stub so modules that touch the extension APIs at import time
// don't throw under jsdom. Individual tests can override or spy on these.
globalThis.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    getURL: (path) => path,
    lastError: null,
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
  tabs: {
    create: vi.fn(),
    remove: vi.fn(),
    sendMessage: vi.fn(),
    query: vi.fn().mockResolvedValue([]),
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  },
}
