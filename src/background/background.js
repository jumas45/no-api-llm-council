// ============================================================================
// Background Service Worker — message-bus entry point (PRD §3, Goal 2)
// ----------------------------------------------------------------------------
// Thin dispatcher: wires the side-panel UI to the orchestrator. All heavy
// lifting lives in orchestrator.js. No network calls (PRD §2, Constraint 2).
// ============================================================================

import { MSG, AUTOCLOSE_ALARM } from '../shared/constants.js'
import {
  startRun,
  cancelRun,
  resetRun,
  getState,
  getHistory,
  deleteHistoryItem,
  clearHistory,
  performAutoClose,
} from './orchestrator.js'

// Open the side panel when the toolbar icon is clicked.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.warn('sidePanel setPanelBehavior failed', e))
})

// Fire the auto-close when its alarm elapses (survives worker suspension).
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTOCLOSE_ALARM) performAutoClose()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message?.type) {
    case MSG.START_COUNCIL: {
      // Fire-and-forget; progress is streamed via COUNCIL_UPDATE broadcasts.
      startRun(message.payload)
      sendResponse({ ok: true })
      return false
    }

    case MSG.CANCEL_COUNCIL: {
      cancelRun()
      sendResponse({ ok: true })
      return false
    }

    case MSG.RESET_COUNCIL: {
      resetRun().then(() => sendResponse({ ok: true }))
      return true
    }

    case MSG.GET_STATE: {
      getState().then((state) => sendResponse({ ok: true, state }))
      return true // async
    }

    case MSG.GET_HISTORY: {
      getHistory().then((history) => sendResponse({ ok: true, history }))
      return true
    }

    case MSG.DELETE_HISTORY_ITEM: {
      deleteHistoryItem(message.runId).then((history) =>
        sendResponse({ ok: true, history }),
      )
      return true
    }

    case MSG.CLEAR_HISTORY: {
      clearHistory().then((history) => sendResponse({ ok: true, history }))
      return true
    }

    default:
      return false
  }
})
