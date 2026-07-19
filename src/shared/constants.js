// Shared configuration + message contract used across the background worker,
// content scripts, and the side-panel UI.

// The council members. `id` is the internal key; `url` is the fresh-chat URL
// the orchestrator opens in a background tab.
export const COUNCIL_MEMBERS = {
  chatgpt: {
    id: 'chatgpt',
    label: 'ChatGPT',
    url: 'https://chatgpt.com/',
    color: '#10a37f',
  },
  claude: {
    id: 'claude',
    label: 'Claude',
    url: 'https://claude.ai/new',
    color: '#d97757',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    url: 'https://gemini.google.com/app',
    color: '#4285f4',
  },
}

export const MEMBER_IDS = Object.keys(COUNCIL_MEMBERS)

// PRD §3, Goal 2: "Implement a 60-second timeout per tab." Exposed in the UI so
// the user can raise it for slower/longer generations.
// This is an INACTIVITY budget: the wait only fails if a response makes no
// progress for this long. An actively-streaming answer may run up to ~2× this.
export const DEFAULT_TIMEOUT_MS = 240_000
export const MIN_TIMEOUT_MS = 30_000
export const MAX_TIMEOUT_MS = 600_000

// The default Chairman used for Stage 3 synthesis. Gemini by default for its
// large context window (falls back to another selected member if deselected).
export const DEFAULT_CHAIRMAN = 'gemini'

// Auto-close: how long to wait after a run finishes before closing the council
// window/tabs (gives you a moment to glance at the tabs).
export const DEFAULT_AUTOCLOSE_DELAY_SEC = 30
export const MAX_AUTOCLOSE_DELAY_SEC = 120

// Keep-active nudge: some provider UIs defer rendering their streamed answer
// until the tab is visible, so a background tab's scraped output can stall until
// it's focused. While responses generate we rotate focus through the still-
// pending council tabs on this interval so their output renders and is captured.
// See ADR-0004.
export const FOCUS_NUDGE_INTERVAL_MS = 15_000

// chrome.storage.local key holding the latest run state.
export const STATE_STORAGE_KEY = 'councilState'
// chrome.storage.local key holding the list of past runs (History tab).
export const HISTORY_STORAGE_KEY = 'councilHistory'
export const HISTORY_LIMIT = 50
// chrome.storage.local key holding user-overridden prompt templates
// ({ reviewPrompt?, synthesisPrompt? }). Absent keys fall back to the defaults
// in background/prompts.js. Persisted locally in the browser only.
export const SETTINGS_STORAGE_KEY = 'councilSettings'

// Auto-close is scheduled via chrome.alarms so it survives service-worker
// suspension. The pending close payload is stashed in storage for the alarm
// handler to read on wake.
export const AUTOCLOSE_ALARM = 'llmc-autoclose'
export const PENDING_CLOSE_KEY = 'councilPendingClose'

// ---- Message bus contract (chrome.runtime / chrome.tabs) ----
export const MSG = {
  // UI -> background
  START_COUNCIL: 'START_COUNCIL',
  CANCEL_COUNCIL: 'CANCEL_COUNCIL',
  RESET_COUNCIL: 'RESET_COUNCIL',
  GET_STATE: 'GET_STATE',
  GET_HISTORY: 'GET_HISTORY',
  DELETE_HISTORY_ITEM: 'DELETE_HISTORY_ITEM',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
  // background -> UI (broadcast)
  COUNCIL_UPDATE: 'COUNCIL_UPDATE',
  // background -> content script (two-phase so typing happens while focused,
  // but the long generation wait happens in the background — see orchestrator)
  TYPE_AND_SUBMIT: 'TYPE_AND_SUBMIT',
  AWAIT_RESPONSE: 'AWAIT_RESPONSE',
  PING: 'PING',
}

// Per-item / per-stage status values.
export const STATUS = {
  IDLE: 'idle',
  PENDING: 'pending',
  RUNNING: 'running',
  DONE: 'done',
  ERROR: 'error',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled',
}

// Stage 2 anonymized labels: Response A, Response B, ...
export function responseLabel(index) {
  return String.fromCharCode(65 + index) // 65 = 'A'
}
