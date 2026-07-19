import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runOptionsFrom, DEFAULT_RUN_OPTIONS, loadSettings, saveSettings } from './settings.js'
import { SETTINGS_STORAGE_KEY } from '../shared/constants.js'

describe('runOptionsFrom', () => {
  it('fills every option with its default when settings are empty', () => {
    expect(runOptionsFrom({})).toEqual(DEFAULT_RUN_OPTIONS)
  })

  it('keeps user-provided values and defaults the rest', () => {
    const opts = runOptionsFrom({ timeoutSec: 90, quickAnswer: true })
    expect(opts.timeoutSec).toBe(90)
    expect(opts.quickAnswer).toBe(true)
    expect(opts.autoClose).toBe(DEFAULT_RUN_OPTIONS.autoClose)
  })

  it('preserves falsy overrides (does not clobber false with the default)', () => {
    // autoClose defaults to true; an explicit false must survive.
    expect(runOptionsFrom({ autoClose: false }).autoClose).toBe(false)
  })
})

describe('loadSettings / saveSettings', () => {
  beforeEach(() => {
    const store = {}
    chrome.storage.local = {
      get: vi.fn(async (key) => ({ [key]: store[key] })),
      set: vi.fn(async (obj) => Object.assign(store, obj)),
    }
  })

  it('round-trips settings through chrome.storage.local', async () => {
    await saveSettings({ timeoutSec: 42 })
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      [SETTINGS_STORAGE_KEY]: { timeoutSec: 42 },
    })
    expect(await loadSettings()).toEqual({ timeoutSec: 42 })
  })

  it('returns an empty object when nothing is stored', async () => {
    expect(await loadSettings()).toEqual({})
  })
})
