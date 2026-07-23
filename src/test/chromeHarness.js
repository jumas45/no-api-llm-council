// A fake `chrome.*` extension API for driving the orchestrator end-to-end in
// jsdom. It simulates tabs/windows/storage/alarms and the content-script message
// round-trip (TYPE_AND_SUBMIT / AWAIT_RESPONSE) so a full 3-stage council run can
// execute against fully controllable inputs.
//
// Design notes:
//   • Tabs are assigned to council members by the fresh-chat URL the orchestrator
//     opens (COUNCIL_MEMBERS[id].url), so a member keeps its identity even when
//     its tab is closed and reopened between stages.
//   • Stage detection uses a per-MEMBER await counter (1=stage1, 2=stage2,
//     3=stage3), not per-tab — a member's stage survives a fresh tab.
//   • `chrome.tabs.get` supports BOTH the callback form (waitForTabComplete) and
//     the promise form (focusTab) the orchestrator uses.
//   • All tabs report status:'complete' immediately, so no load timers are armed.
import { vi } from 'vitest'
import { MSG, COUNCIL_MEMBERS } from '../shared/constants.js'

// Default "happy path" content-script behavior: every submit succeeds, every
// await returns text. The 2nd await for a member is its Stage-2 review, so it
// carries a well-formed FINAL RANKING block for the leaderboard parser.
function defaultRespond({ member, type, awaitIndex }) {
  if (type === MSG.TYPE_AND_SUBMIT) return { ok: true, baseline: 0 }
  if (awaitIndex === 2) {
    return {
      ok: true,
      text: `Review by ${member}.\n\nFINAL RANKING:\n1. Response A\n2. Response B\n3. Response C`,
    }
  }
  return { ok: true, text: `${member} answer #${awaitIndex}` }
}

export function installChromeHarness({ members, respond = defaultRespond } = {}) {
  if (!members) throw new Error('installChromeHarness needs a members array')

  const store = {}
  let nextTabId = 100
  let nextWinId = 900
  const tabToWindow = new Map()
  const tabToMember = new Map()
  const awaitCounts = new Map() // keyed by MEMBER, so it survives a fresh tab
  const removedTabs = []
  const submits = [] // { member, tabId } per TYPE_AND_SUBMIT, in order
  // Tabs the orchestrator waited on via waitForTabComplete — the ONLY caller of
  // the callback form of chrome.tabs.get (focusTab/nudger use the promise form),
  // so this set records exactly the tabs whose load/hydration we waited for.
  const waitedTabs = new Set()

  const urlToMember = {}
  for (const id of Object.keys(COUNCIL_MEMBERS)) urlToMember[COUNCIL_MEMBERS[id].url] = id

  const makeTab = (windowId, url) => {
    const id = nextTabId++
    tabToWindow.set(id, windowId ?? null)
    tabToMember.set(id, urlToMember[url])
    return { id, windowId: windowId ?? null, status: 'complete' }
  }

  async function dispatch(tabId, message) {
    const member = tabToMember.get(tabId)
    let awaitIndex = 0
    if (message?.type === MSG.AWAIT_RESPONSE) {
      awaitIndex = (awaitCounts.get(member) || 0) + 1
      awaitCounts.set(member, awaitIndex)
    }
    if (message?.type === MSG.TYPE_AND_SUBMIT) submits.push({ member, tabId })
    return respond({ member, type: message?.type, awaitIndex, message })
  }

  const chrome = {
    runtime: {
      lastError: null,
      sendMessage: vi.fn(() => Promise.resolve()),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
      getURL: (p) => p,
    },
    storage: {
      local: {
        get: vi.fn(async (key) => (key ? { [key]: store[key] } : { ...store })),
        set: vi.fn(async (obj) => {
          Object.assign(store, obj)
        }),
        remove: vi.fn(async (key) => {
          delete store[key]
        }),
      },
    },
    tabs: {
      create: vi.fn(async ({ windowId, url } = {}) => makeTab(windowId, url)),
      get: vi.fn((tabId, cb) => {
        const tab = {
          id: tabId,
          windowId: tabToWindow.get(tabId) ?? null,
          status: 'complete',
        }
        if (typeof cb === 'function') {
          waitedTabs.add(tabId) // callback form == waitForTabComplete
          cb(tab)
          return undefined
        }
        return Promise.resolve(tab)
      }),
      update: vi.fn(() => Promise.resolve()),
      remove: vi.fn(async (ids) => {
        removedTabs.push(...(Array.isArray(ids) ? ids : [ids]))
      }),
      sendMessage: vi.fn((tabId, message) => dispatch(tabId, message)),
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    windows: {
      create: vi.fn(async ({ url } = {}) => {
        const id = nextWinId++
        const tab = makeTab(id, url)
        return { id, tabs: [tab] }
      }),
      update: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    },
    alarms: {
      create: vi.fn(),
      clear: vi.fn(async () => true),
      onAlarm: { addListener: vi.fn() },
    },
  }

  globalThis.chrome = chrome
  return { chrome, store, removedTabs, submits, waitedTabs }
}

// Drive a fired-off orchestrator promise to completion under fake timers.
// The orchestrator interleaves awaited chrome calls (microtasks) with sleeps
// (timers); we pump both until the promise settles. Requires vi.useFakeTimers().
export async function drainUntilSettled(promise, { maxTicks = 2000 } = {}) {
  let settled = false
  promise.then(
    () => {
      settled = true
    },
    () => {
      settled = true
    },
  )
  for (let i = 0; i < maxTicks && !settled; i++) {
    await vi.runAllTimersAsync()
    await Promise.resolve()
  }
  if (!settled) throw new Error('orchestrator run did not settle within tick budget')
  return promise
}
