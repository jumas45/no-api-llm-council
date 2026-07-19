import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getHistory, deleteHistoryItem, clearHistory } from './orchestrator.js'
import { HISTORY_STORAGE_KEY } from '../shared/constants.js'

// Template: testing background code that touches the chrome.* extension APIs.
// We swap in an in-memory chrome.storage.local so reads/writes actually round-
// trip, then assert on the resulting state. (The global stub in setup.js is a
// no-op; per-test we give it real behavior.)
function memoryStorage(initial = {}) {
  let store = { ...initial }
  return {
    get: vi.fn(async (key) => (key ? { [key]: store[key] } : { ...store })),
    set: vi.fn(async (obj) => {
      store = { ...store, ...obj }
    }),
    remove: vi.fn(async (key) => {
      delete store[key]
    }),
  }
}

beforeEach(() => {
  chrome.storage.local = memoryStorage({
    [HISTORY_STORAGE_KEY]: [{ runId: 1 }, { runId: 2 }],
  })
})

describe('history helpers', () => {
  it('getHistory returns the stored runs', async () => {
    expect(await getHistory()).toEqual([{ runId: 1 }, { runId: 2 }])
  })

  it('deleteHistoryItem removes the run with the given id', async () => {
    const remaining = await deleteHistoryItem(1)
    expect(remaining).toEqual([{ runId: 2 }])
  })

  it('clearHistory empties the history', async () => {
    expect(await clearHistory()).toEqual([])
    expect(await getHistory()).toEqual([])
  })
})
