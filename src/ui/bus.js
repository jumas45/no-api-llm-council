// Thin promise wrappers around the runtime message bus for the side panel.
import { MSG } from '../shared/constants.js'

export function startCouncil(payload) {
  return chrome.runtime.sendMessage({ type: MSG.START_COUNCIL, payload })
}

export function cancelCouncil() {
  return chrome.runtime.sendMessage({ type: MSG.CANCEL_COUNCIL })
}

export function resetCouncil() {
  return chrome.runtime.sendMessage({ type: MSG.RESET_COUNCIL }).catch(() => {})
}

export function getState() {
  return chrome.runtime
    .sendMessage({ type: MSG.GET_STATE })
    .then((r) => r?.state || null)
    .catch(() => null)
}

// Subscribe to COUNCIL_UPDATE broadcasts. Returns an unsubscribe fn.
export function onCouncilUpdate(handler) {
  const listener = (message) => {
    if (message?.type === MSG.COUNCIL_UPDATE) handler(message.state)
  }
  chrome.runtime.onMessage.addListener(listener)
  return () => chrome.runtime.onMessage.removeListener(listener)
}

export function getHistory() {
  return chrome.runtime
    .sendMessage({ type: MSG.GET_HISTORY })
    .then((r) => r?.history || [])
    .catch(() => [])
}

export function deleteHistoryItem(runId) {
  return chrome.runtime
    .sendMessage({ type: MSG.DELETE_HISTORY_ITEM, runId })
    .then((r) => r?.history || [])
    .catch(() => [])
}

export function clearHistory() {
  return chrome.runtime
    .sendMessage({ type: MSG.CLEAR_HISTORY })
    .then((r) => r?.history || [])
    .catch(() => [])
}
