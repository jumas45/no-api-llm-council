import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installChromeHarness, drainUntilSettled } from '../test/chromeHarness.js'
import {
  startRun,
  getState,
  getHistory,
  resetRun,
  cancelRun,
  performAutoClose,
} from './orchestrator.js'
import { STATUS, PENDING_CLOSE_KEY, AUTOCLOSE_ALARM } from '../shared/constants.js'

// Full 3-stage state-machine coverage. Each test installs a fake chrome.* that
// scripts the content-script responses, fires startRun, and drains the run to
// completion under fake timers, then asserts on the resulting state + history.

const MEMBERS = ['chatgpt', 'claude', 'gemini']

function baseConfig(overrides = {}) {
  return {
    query: 'What is the best sorting algorithm?',
    members: MEMBERS,
    chairman: 'gemini',
    timeoutMs: 5000,
    dedicatedWindow: false,
    autoClose: false,
    keepActive: false, // disables the focus-nudger interval (no perpetual timers)
    quickAnswer: false,
    ...overrides,
  }
}

// Delegate to the default happy responder but override a single member's Nth
// AWAIT_RESPONSE (1=stage1, 2=stage2, 3=stage3) with a failure/timeout result.
function respondExcept(failMember, failAwaitIndex, failResult) {
  return ({ member, type, awaitIndex }) => {
    if (type === 'TYPE_AND_SUBMIT') return { ok: true, baseline: 0 }
    if (member === failMember && awaitIndex === failAwaitIndex) return failResult
    if (awaitIndex === 2) {
      return {
        ok: true,
        text: `Review by ${member}.\n\nFINAL RANKING:\n1. Response A\n2. Response B\n3. Response C`,
      }
    }
    return { ok: true, text: `${member} answer #${awaitIndex}` }
  }
}

// Fire a run and let it advance (via microtasks only, no timer advance) until it
// parks on its first tab-hydration sleep — i.e. state is set and RUNNING, but the
// run hasn't progressed through the stages. Returns the run promise to drain later.
async function startAndPause(config) {
  const promise = startRun(config)
  for (let i = 0; i < 20; i++) await Promise.resolve()
  // Wrap in an object so the async fn doesn't adopt (and thus await) the still-
  // pending run promise — we only want the microtask flush to have happened.
  return { promise }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(async () => {
  await resetRun()
  vi.useRealTimers()
})

describe('startRun — happy path', () => {
  it('drives all three stages to DONE and records history', async () => {
    installChromeHarness({ members: MEMBERS })

    await drainUntilSettled(startRun(baseConfig()))

    const state = await getState()
    expect(state.status).toBe(STATUS.DONE)

    for (const id of MEMBERS) {
      expect(state.stage1[id].status).toBe(STATUS.DONE)
      expect(state.stage1[id].text).toBeTruthy()
      expect(state.stage2[id].status).toBe(STATUS.DONE)
    }
    expect(state.stage3.status).toBe(STATUS.DONE)
    expect(state.stage3.chairman).toBe('gemini')

    // Every stage was timed, and a leaderboard was built from the 3 ballots.
    expect(state.timings.stage1).toBeTypeOf('number')
    expect(state.timings.stage2).toBeTypeOf('number')
    expect(state.timings.stage3).toBeTypeOf('number')
    expect(state.ranking.ballots).toBe(3)

    const history = await getHistory()
    expect(history).toHaveLength(1)
    expect(history[0].status).toBe(STATUS.DONE)
  })
})

describe('startRun — fresh tab per stage (anti self-preference bias)', () => {
  it('reopens a new tab for Stage 2 & 3 and closes the prior stage tabs', async () => {
    // Reusing a member's tab would leave its own Stage-1 answer scrolled up in
    // the same conversation, letting the model recognize and up-rank itself in
    // the anonymized peer review. Each stage must run in a brand-new tab.
    const { submits, removedTabs } = installChromeHarness({ members: MEMBERS })

    await drainUntilSettled(startRun(baseConfig()))

    expect((await getState()).status).toBe(STATUS.DONE)

    // Group the tab ids each member submitted into, in stage order.
    const byMember = {}
    for (const { member, tabId } of submits) (byMember[member] ??= []).push(tabId)

    // A non-chairman answered Stages 1 & 2 — each in a different tab.
    expect(byMember.chatgpt).toHaveLength(2)
    expect(new Set(byMember.chatgpt).size).toBe(2)

    // The chairman (gemini) additionally synthesizes in Stage 3 — three tabs,
    // all distinct.
    expect(byMember.gemini).toHaveLength(3)
    expect(new Set(byMember.gemini).size).toBe(3)

    // Every Stage-1 tab was closed once its stage was over.
    for (const ids of Object.values(byMember)) {
      expect(removedTabs).toContain(ids[0])
    }
  })
})

describe('startRun — waits for composer hydration before submitting', () => {
  it('waits for every opened tab to load, including the dedicated first tab', async () => {
    // Typing into a provider SPA before its composer mounts silently drops the
    // text, so waitForComposer (waitForTabComplete + hydration sleep) must run
    // for EVERY opened tab before we submit to it. Dedicated mode exercises the
    // first-member tab opened via windows.create — the path that once skipped
    // the wait. `waitedTabs` records the tabs waitForTabComplete waited on.
    const { submits, waitedTabs } = installChromeHarness({ members: MEMBERS })

    await drainUntilSettled(startRun(baseConfig({ dedicatedWindow: true })))

    expect((await getState()).status).toBe(STATUS.DONE)

    const submittedTabs = [...new Set(submits.map((s) => s.tabId))]
    expect(submittedTabs.length).toBeGreaterThan(0)
    for (const tabId of submittedTabs) {
      expect(
        waitedTabs.has(tabId),
        `tab ${tabId} was submitted to without a load/hydration wait`,
      ).toBe(true)
    }
  })
})

describe('startRun — no Stage 1 answers', () => {
  it('errors out and never reaches Stage 3', async () => {
    // Every member's Stage-1 await fails.
    installChromeHarness({
      members: MEMBERS,
      respond: ({ type }) =>
        type === 'TYPE_AND_SUBMIT'
          ? { ok: true, baseline: 0 }
          : { ok: false, error: 'nothing scraped' },
    })

    await drainUntilSettled(startRun(baseConfig()))

    const state = await getState()
    expect(state.status).toBe(STATUS.ERROR)
    expect(state.error).toMatch(/no council member/i)
    expect(state.stage3.status).toBe(STATUS.PENDING) // synthesis never started
  })
})

describe('startRun — chairman did not answer Stage 1', () => {
  it('falls back to the first member that did answer', async () => {
    // gemini is the configured chairman but fails its Stage-1 response.
    installChromeHarness({
      members: MEMBERS,
      respond: respondExcept('gemini', 1, { ok: false, error: 'boom' }),
    })

    await drainUntilSettled(startRun(baseConfig({ chairman: 'gemini' })))

    const state = await getState()
    expect(state.status).toBe(STATUS.DONE)
    expect(state.stage1.gemini.status).toBe(STATUS.ERROR)
    expect(state.stage3.chairman).toBe('chatgpt') // first member that answered
    expect(state.stage3.status).toBe(STATUS.DONE)
  })
})

describe('startRun — a member times out', () => {
  it('marks that member TIMEOUT but still completes the run', async () => {
    installChromeHarness({
      members: MEMBERS,
      respond: respondExcept('claude', 1, {
        ok: false,
        error: 'orchestrator timeout',
        timeout: true,
      }),
    })

    await drainUntilSettled(startRun(baseConfig()))

    const state = await getState()
    expect(state.stage1.claude.status).toBe(STATUS.TIMEOUT)
    expect(state.status).toBe(STATUS.DONE) // chatgpt + gemini carried the run
    expect(state.stage3.status).toBe(STATUS.DONE)
  })
})

describe('startRun — auto-close', () => {
  it('arms an alarm and performAutoClose removes the opened tabs', async () => {
    const { chrome, store } = installChromeHarness({ members: MEMBERS })

    await drainUntilSettled(
      startRun(baseConfig({ autoClose: true, autoCloseDelayMs: 1000 })),
    )

    // Run finished DONE and scheduled the close.
    expect((await getState()).status).toBe(STATUS.DONE)
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      AUTOCLOSE_ALARM,
      expect.objectContaining({ when: expect.any(Number) }),
    )
    expect(store[PENDING_CLOSE_KEY]).toBeTruthy()

    // The run also closes tabs between stages (fresh-tab reopen); ignore those
    // and assert only that auto-close removes the one remaining chairman tab.
    chrome.tabs.remove.mockClear()
    await performAutoClose()
    expect(chrome.tabs.remove).toHaveBeenCalledOnce()
  })

  it('queues only the Stage-3 chairman tab for close (earlier tabs already gone)', async () => {
    // The between-stage reopens close Stage 1 & 2 tabs during the run, so by the
    // time it finishes only the chairman's fresh Stage-3 tab is open. The post-run
    // auto-close payload must therefore contain exactly that one tab — not the
    // stale, already-closed earlier tab ids.
    const { store, submits } = installChromeHarness({ members: MEMBERS })

    await drainUntilSettled(
      startRun(baseConfig({ autoClose: true, autoCloseDelayMs: 1000 })),
    )
    expect((await getState()).status).toBe(STATUS.DONE)

    // gemini is the chairman; its 3rd (Stage-3) submit lands in the final tab.
    const geminiTabs = submits.filter((s) => s.member === 'gemini').map((s) => s.tabId)
    expect(geminiTabs).toHaveLength(3)
    expect(store[PENDING_CLOSE_KEY].tabIds).toEqual([geminiTabs[2]])
  })

  it('removes the dedicated window (not tabs) when the run used one', async () => {
    const { chrome, store } = installChromeHarness({ members: MEMBERS })

    await drainUntilSettled(
      startRun(
        baseConfig({ dedicatedWindow: true, autoClose: true, autoCloseDelayMs: 1000 }),
      ),
    )

    expect(store[PENDING_CLOSE_KEY].dedicated).toBe(true)
    // Isolate performAutoClose: ignore the in-run between-stage tab closes and
    // any leftover-window cleanup a prior dedicated run may have triggered, then
    // assert auto-close removes the whole dedicated window (not tabs).
    chrome.tabs.remove.mockClear()
    chrome.windows.remove.mockClear()
    await performAutoClose()
    expect(chrome.windows.remove).toHaveBeenCalledOnce()
    expect(chrome.tabs.remove).not.toHaveBeenCalled()
  })

  it('skips closing when a newer run is still active', async () => {
    const { chrome, store } = installChromeHarness({ members: MEMBERS })

    // Hold a run in the RUNNING state (parked on its first tab-hydration sleep).
    const { promise: inFlight } = await startAndPause(baseConfig({ autoClose: false }))
    const active = await getState()
    expect(active.status).toBe(STATUS.RUNNING)

    // A stale auto-close payload from an OLDER run must not close the new run's
    // tabs (guards against a late alarm firing after a fresh run started).
    store[PENDING_CLOSE_KEY] = {
      runId: active.runId - 1,
      dedicated: false,
      tabIds: [100],
    }
    await performAutoClose()
    expect(chrome.tabs.remove).not.toHaveBeenCalled()

    await drainUntilSettled(inFlight) // let the paused run finish cleanly
  })
})

describe('startRun — cancellation', () => {
  it('aborts to CANCELLED and records the partial run', async () => {
    // Cancel the moment the first member is submitted, so the run bails after
    // Stage 1 via the `if (cancelled) return abort()` checkpoint.
    installChromeHarness({
      members: MEMBERS,
      respond: ({ member, type, awaitIndex }) => {
        if (type === 'TYPE_AND_SUBMIT') {
          if (member === 'chatgpt') cancelRun()
          return { ok: true, baseline: 0 }
        }
        return { ok: true, text: `${member} answer #${awaitIndex}` }
      },
    })

    await drainUntilSettled(startRun(baseConfig()))

    const state = await getState()
    expect(state.status).toBe(STATUS.CANCELLED)
    expect(state.stage3.status).toBe(STATUS.PENDING) // never synthesized

    const history = await getHistory()
    expect(history).toHaveLength(1)
    expect(history[0].status).toBe(STATUS.CANCELLED)
  })
})

describe('startRun — dedicated window', () => {
  it('opens a dedicated window and closes the leftover one on re-run', async () => {
    const first = installChromeHarness({ members: MEMBERS })
    await drainUntilSettled(startRun(baseConfig({ dedicatedWindow: true })))

    expect((await getState()).status).toBe(STATUS.DONE)
    // The council window is seeded exactly once; the other members and every
    // between-stage reopen add their tabs into that same window (no new window
    // per reopen), so windows.create stays at one.
    expect(first.chrome.windows.create).toHaveBeenCalledOnce()

    // A second dedicated run must close the previous council window first.
    const second = installChromeHarness({ members: MEMBERS })
    await drainUntilSettled(startRun(baseConfig({ dedicatedWindow: true })))

    expect(second.chrome.windows.remove).toHaveBeenCalledOnce()
    expect((await getState()).status).toBe(STATUS.DONE)
  })
})
