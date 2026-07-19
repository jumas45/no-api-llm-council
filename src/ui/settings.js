// Read/write user settings, persisted in the browser via chrome.storage.local.
// Shape: { reviewPrompt?, synthesisPrompt?, ...runOptions }. Absent (or empty)
// prompt keys mean "use the Karpathy default" (see background/prompts.js);
// absent run-option keys fall back to DEFAULT_RUN_OPTIONS below.
import {
  SETTINGS_STORAGE_KEY,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_AUTOCLOSE_DELAY_SEC,
} from '../shared/constants.js'

// Per-run execution options, edited on the Settings tab and read at launch.
export const DEFAULT_RUN_OPTIONS = {
  timeoutSec: DEFAULT_TIMEOUT_MS / 1000,
  dedicatedWindow: false,
  autoClose: true,
  autoCloseSec: DEFAULT_AUTOCLOSE_DELAY_SEC,
  keepActive: true,
  quickAnswer: false,
}

export async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY)
  return stored[SETTINGS_STORAGE_KEY] || {}
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings })
}

// Run options with defaults applied for any keys the user hasn't set.
export function runOptionsFrom(settings) {
  return {
    timeoutSec: settings.timeoutSec ?? DEFAULT_RUN_OPTIONS.timeoutSec,
    dedicatedWindow: settings.dedicatedWindow ?? DEFAULT_RUN_OPTIONS.dedicatedWindow,
    autoClose: settings.autoClose ?? DEFAULT_RUN_OPTIONS.autoClose,
    autoCloseSec: settings.autoCloseSec ?? DEFAULT_RUN_OPTIONS.autoCloseSec,
    keepActive: settings.keepActive ?? DEFAULT_RUN_OPTIONS.keepActive,
    quickAnswer: settings.quickAnswer ?? DEFAULT_RUN_OPTIONS.quickAnswer,
  }
}
