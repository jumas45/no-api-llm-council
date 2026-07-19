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

    await performAutoClose()
    expect(chrome.tabs.remove).toHaveBeenCalledOnce()
  })

  it('removes the dedicated window (not tabs) when the run used one', async () => {
    const { chrome, store } = installChromeHarness({ members: MEMBERS })

    await drainUntilSettled(
      startRun(
        baseConfig({ dedicatedWindow: true, autoClose: true, autoCloseDelayMs: 1000 }),
      ),
    )

    expect(store[PENDING_CLOSE_KEY].dedicated).toBe(true)
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
    expect(first.chrome.windows.create).toHaveBeenCalledOnce()
    expect(first.chrome.tabs.create).toHaveBeenCalledTimes(MEMBERS.length - 1)

    // A second dedicated run must close the previous council window first.
    const second = installChromeHarness({ members: MEMBERS })
    await drainUntilSettled(startRun(baseConfig({ dedicatedWindow: true })))

    expect(second.chrome.windows.remove).toHaveBeenCalledOnce()
    expect((await getState()).status).toBe(STATUS.DONE)
  })
})
