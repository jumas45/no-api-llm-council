// ============================================================================
// Orchestrator (PRD §3, Goal 2 + §4)
// ----------------------------------------------------------------------------
// Recreates Karpathy's 3-stage council deliberation loop purely in JavaScript
// using the chrome.tabs API. Replaces main.py / council.py.
//
//   Stage 1  First Opinions   -> raw query sent to every member tab
//   Stage 2  Peer Review      -> anonymized responses reviewed by every member
//   Stage 3  Chairman Synth   -> chairman compiles the final authoritative answer
//
// Typing must happen while a tab is FOCUSED (execCommand/paste no-op in a
// background tab), so each tab is briefly activated to type + submit; the long
// generation wait then runs concurrently in the background. No network calls
// (PRD §2, Constraint 2).
// ============================================================================

import {
  COUNCIL_MEMBERS,
  MSG,
  STATUS,
  STATE_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  HISTORY_LIMIT,
  AUTOCLOSE_ALARM,
  PENDING_CLOSE_KEY,
  FOCUS_NUDGE_INTERVAL_MS,
  responseLabel,
} from '../shared/constants.js'
import { buildReviewPrompt, buildSynthesisPrompt, buildRankingBoard } from './prompts.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let state = null
let cancelled = false
// The dedicated council window (if that mode is used), reused/replaced per run.
let councilWindowId = null

function freshState({
  query,
  members,
  chairman,
  timeoutMs,
  dedicatedWindow,
  autoClose,
  autoCloseDelayMs,
  keepActive,
  quickAnswer,
}) {
  const mk = () =>
    Object.fromEntries(
      members.map((m) => [m, { status: STATUS.PENDING, text: '', error: '', ms: null }]),
    )
  return {
    runId: Date.now(),
    status: STATUS.RUNNING,
    stage: 0,
    query,
    members,
    chairman,
    timeoutMs,
    dedicatedWindow: Boolean(dedicatedWindow),
    autoClose: Boolean(autoClose),
    autoCloseDelayMs: autoCloseDelayMs ?? 10000,
    // Periodically bring still-generating tabs forward so their output renders
    // and is scraped (default on). Opt-in "Answer now" clicking for speed.
    keepActive: keepActive !== false,
    quickAnswer: Boolean(quickAnswer),
    tabs: {},
    // Wall-clock durations (ms) per stage, for the "who's fastest" view.
    timings: { stage1: null, stage2: null, stage3: null },
    // Aggregate leaderboard parsed from Stage 2 peer rankings (set after Stage 2).
    ranking: null,
    stage1: mk(),
    stage2: mk(),
    stage3: { status: STATUS.PENDING, text: '', error: '' },
    error: '',
    startedAt: Date.now(),
    finishedAt: null,
  }
}

async function persistAndBroadcast() {
  if (!state) return
  await chrome.storage.local.set({ [STATE_STORAGE_KEY]: state })
  chrome.runtime.sendMessage({ type: MSG.COUNCIL_UPDATE, state }).catch(() => {})
}

export async function getState() {
  if (state) return state
  const stored = await chrome.storage.local.get(STATE_STORAGE_KEY)
  return stored[STATE_STORAGE_KEY] || null
}

export function cancelRun() {
  cancelled = true
  clearAutoClose()
}

// Stop any running session, wipe the current run, and reset the UI to a blank
// slate. Leaves the council tabs/window open (the user may want to read them).
export async function resetRun() {
  cancelled = true
  await clearAutoClose()
  state = null
  await chrome.storage.local.remove(STATE_STORAGE_KEY)
  chrome.runtime.sendMessage({ type: MSG.COUNCIL_UPDATE, state: null }).catch(() => {})
}

// ---- History ----------------------------------------------------------------

export async function getHistory() {
  const stored = await chrome.storage.local.get(HISTORY_STORAGE_KEY)
  return stored[HISTORY_STORAGE_KEY] || []
}

async function saveToHistory(runState) {
  if (!runState) return
  const { tabs, ...record } = runState // drop live tab IDs
  const history = await getHistory()
  const next = [record, ...history.filter((r) => r.runId !== record.runId)].slice(
    0,
    HISTORY_LIMIT,
  )
  await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: next })
}

export async function deleteHistoryItem(runId) {
  const history = await getHistory()
  await chrome.storage.local.set({
    [HISTORY_STORAGE_KEY]: history.filter((r) => r.runId !== runId),
  })
  return getHistory()
}

export async function clearHistory() {
  await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: [] })
  return []
}

// ---- tab plumbing -----------------------------------------------------------

function waitForTabComplete(tabId, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('tab load timeout'))
    }, timeoutMs)
    function listener(updatedId, info) {
      if (updatedId === tabId && info.status === 'complete') {
        clearTimeout(timer)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timer)
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      if (tab && tab.status === 'complete') {
        clearTimeout(timer)
        resolve()
      } else {
        chrome.tabs.onUpdated.addListener(listener)
      }
    })
  })
}

// Bring a tab (and its window) to the foreground so text insertion works.
async function focusTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId)
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {})
    await chrome.tabs.update(tabId, { active: true })
  } catch {
    /* tab may have been closed */
  }
  await sleep(500)
}

// While responses generate in the background, some provider UIs defer rendering
// their streamed answer until their tab is visible, so the scraped output can
// stall until focused. This rotates focus through the still-pending council tabs
// on an interval so each renders and is captured (see ADR-0004). `getPendingTabIds`
// is called each tick and returns the tab IDs still awaiting a response; the
// nudger stops itself once that list is empty. Returns a stop function.
function startFocusNudger(getPendingTabIds) {
  if (!state?.keepActive) return () => {}
  let i = 0
  let stopped = false
  const timer = setInterval(async () => {
    if (stopped || !state || cancelled) return
    const ids = getPendingTabIds()
    if (!ids.length) return
    const tabId = ids[i++ % ids.length]
    try {
      const tab = await chrome.tabs.get(tabId)
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {})
      await chrome.tabs.update(tabId, { active: true })
    } catch {
      /* tab closed */
    }
  }, FOCUS_NUDGE_INTERVAL_MS)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}

async function sendToTab(tabId, message, { retries = 8, retryDelay = 800 } = {}) {
  let lastErr
  for (let i = 0; i < retries; i++) {
    try {
      return await chrome.tabs.sendMessage(tabId, message)
    } catch (err) {
      lastErr = err
      await sleep(retryDelay)
    }
  }
  throw new Error('content script unreachable: ' + (lastErr?.message || 'unknown'))
}

// Phase 1: focus the tab, type + submit. Returns the response baseline count.
// `quickAnswer` asks the driver to click a provider's "Answer now" control when
// present — set for Stages 1–2 when the user opts in, never for the synthesis.
async function submitToTab(tabId, prompt, quickAnswer = false) {
  await focusTab(tabId)
  const res = await sendToTab(tabId, { type: MSG.TYPE_AND_SUBMIT, prompt, quickAnswer })
  if (!res || !res.ok) throw new Error(res?.error || 'submit failed')
  return res.baseline ?? 0
}

// Phase 2: wait for the response in the background, honoring the per-tab timeout
// (PRD §3, Goal 2: "Implement a 60-second timeout per tab. Catch timeouts...").
async function awaitTab(tabId, baseline, timeoutMs) {
  // The content script may extend up to timeoutMs×2 while an answer is still
  // streaming, so the orchestrator's safety cap must sit above that.
  const res = await Promise.race([
    sendToTab(tabId, { type: MSG.AWAIT_RESPONSE, baseline, timeoutMs }),
    sleep(timeoutMs * 2 + 25000).then(() => ({
      ok: false,
      error: 'orchestrator timeout',
      timeout: true,
    })),
  ])
  if (!res || !res.ok) {
    const err = new Error(res?.error || 'unknown tab error')
    err.timeout = Boolean(res?.timeout)
    throw err
  }
  return res.text
}

// ---- stages -----------------------------------------------------------------

async function openMemberTabs() {
  const dedicated = state.dedicatedWindow

  // In dedicated mode, close any leftover council window from a previous run so
  // windows don't pile up.
  if (dedicated && councilWindowId != null) {
    try {
      await chrome.windows.remove(councilWindowId)
    } catch {
      /* already closed */
    }
    councilWindowId = null
  }

  let windowId // target window for tabs created after the first (dedicated mode)

  for (let i = 0; i < state.members.length; i++) {
    const id = state.members[i]
    const member = COUNCIL_MEMBERS[id]
    let tab

    if (dedicated && i === 0) {
      // First member seeds a new, unfocused window; the rest join it.
      const win = await chrome.windows.create({
        url: member.url,
        focused: false,
        type: 'normal',
        width: 1200,
        height: 900,
      })
      windowId = win.id
      councilWindowId = win.id
      tab = win.tabs?.[0]
      await waitForComposer(tab.id)
    } else {
      tab = await openMemberTab(id, { windowId, dedicated })
    }

    state.tabs[id] = tab.id
  }
  await persistAndBroadcast()
}

// Wait for a freshly-opened provider tab to finish loading and give its SPA a
// moment to hydrate its composer (the sleep sits outside the per-tab timeout).
async function waitForComposer(tabId) {
  await waitForTabComplete(tabId).catch(() => {})
  await sleep(1500)
}

// Open one fresh background tab for a member and wait for it to be usable.
// Shared by the initial open and the between-stage reopen.
async function openMemberTab(id, { windowId, dedicated }) {
  const tab = await chrome.tabs.create({
    url: COUNCIL_MEMBERS[id].url,
    active: false,
    pinned: !dedicated, // pin only when sharing the user's window
    ...(windowId ? { windowId } : {}),
  })
  await waitForComposer(tab.id)
  return tab
}

// Close each member's current tab and open a fresh one, so the next stage runs
// in a brand-new conversation with no memory of the prior stage. This defeats
// self-preference bias in the anonymized peer review (a model recognizing its
// own Stage-1 answer still sitting in the same chat thread and up-ranking it),
// and hands the Stage-3 chairman a clean context. Fresh tabs are opened BEFORE
// the old ones close so a dedicated council window is never momentarily left
// empty (which would close the window). See ADR-0012.
async function reopenTabsFor(memberIds) {
  if (!state || cancelled) return
  const dedicated = state.dedicatedWindow
  const windowId = dedicated ? councilWindowId : undefined
  const oldTabIds = Object.values(state.tabs).filter(Boolean)

  const fresh = {}
  for (const id of memberIds) {
    if (!state || cancelled) return
    const tab = await openMemberTab(id, { windowId, dedicated })
    fresh[id] = tab.id
  }

  if (oldTabIds.length) {
    try {
      await chrome.tabs.remove(oldTabIds)
    } catch {
      /* already closed */
    }
  }

  if (!state) return
  state.tabs = fresh
  await persistAndBroadcast()
}

// Type+submit sequentially (each needs focus), then await responses concurrently.
async function runStageAcrossMembers(stageKey, memberIds, promptFor, quickAnswer = false) {
  const baselines = {}
  const starts = {} // per-member start time (submit → done), for durations

  for (const id of memberIds) {
    if (cancelled || !state) return
    starts[id] = Date.now()
    state[stageKey][id].status = STATUS.RUNNING
    await persistAndBroadcast()
    try {
      baselines[id] = await submitToTab(state.tabs[id], promptFor(id), quickAnswer)
    } catch (err) {
      if (!state) return
      state[stageKey][id] = {
        status: STATUS.ERROR,
        text: '',
        error: err.message || String(err),
        ms: Date.now() - starts[id],
      }
      await persistAndBroadcast()
    }
  }

  // Keep still-pending tabs rendering (and thus scrapable) while we wait.
  const stopNudge = startFocusNudger(() =>
    memberIds
      .filter((id) => state?.[stageKey]?.[id]?.status === STATUS.RUNNING)
      .map((id) => state.tabs[id])
      .filter(Boolean),
  )
  try {
    await Promise.all(
      memberIds.map(async (id) => {
        if (cancelled || !state) return
        if (state[stageKey][id].status !== STATUS.RUNNING) return // submit failed
        try {
          const text = await awaitTab(state.tabs[id], baselines[id], state.timeoutMs)
          if (!state) return
          state[stageKey][id] = {
            status: STATUS.DONE,
            text,
            error: '',
            ms: Date.now() - starts[id],
          }
        } catch (err) {
          if (!state) return
          state[stageKey][id] = {
            status: err.timeout ? STATUS.TIMEOUT : STATUS.ERROR,
            text: '',
            error: err.message || String(err),
            ms: Date.now() - starts[id],
          }
        }
        await persistAndBroadcast()
      }),
    )
  } finally {
    stopNudge()
  }
}

function membersWithStage1() {
  return state.members.filter(
    (id) => state.stage1[id].status === STATUS.DONE && state.stage1[id].text,
  )
}

function labeledResponses(stageKey, memberIds) {
  return memberIds.map((id, i) => ({
    id,
    label: responseLabel(i),
    text: state[stageKey][id].text,
  }))
}

export async function startRun(config) {
  cancelled = false
  await clearAutoClose() // cancel any pending close from a previous run
  // Optional user prompt overrides. Not stored on state (they'd bloat every
  // history record); the builders fall back to the Karpathy defaults when null.
  const reviewTemplate = config.reviewPrompt || null
  const synthTemplate = config.synthesisPrompt || null
  state = freshState(config)
  await persistAndBroadcast()

  try {
    await openMemberTabs()
    if (cancelled) return abort()

    // --- Stage 1: First Opinions (raw query, unaltered) ---
    state.stage = 1
    await persistAndBroadcast()
    const t1 = Date.now()
    await runStageAcrossMembers('stage1', state.members, () => state.query, state.quickAnswer)
    if (!state) return
    state.timings.stage1 = Date.now() - t1
    if (cancelled) return abort()

    const answered = membersWithStage1()
    if (answered.length === 0) {
      throw new Error('No council member returned a Stage 1 response.')
    }

    // Fresh tabs before peer review so no model can see (and favor) its own
    // Stage-1 answer in its own conversation thread (ADR-0012).
    await reopenTabsFor(answered)
    if (cancelled) return abort()

    // --- Stage 2: Anonymized Peer Review ---
    state.stage = 2
    await persistAndBroadcast()
    const stage1Labeled = labeledResponses('stage1', answered)
    const reviewPrompt = buildReviewPrompt(state.query, stage1Labeled, reviewTemplate)
    const t2 = Date.now()
    await runStageAcrossMembers('stage2', answered, () => reviewPrompt, state.quickAnswer)
    if (!state) return
    state.timings.stage2 = Date.now() - t2
    if (cancelled) return abort()

    const reviewers = answered.filter(
      (id) => state.stage2[id].status === STATUS.DONE && state.stage2[id].text,
    )

    // Parse each reviewer's FINAL RANKING into an aggregate leaderboard.
    state.ranking = buildRankingBoard(
      stage1Labeled,
      reviewers.map((id) => ({ id, text: state.stage2[id].text })),
    )
    await persistAndBroadcast()

    // --- Stage 3: The Chairman's Synthesis ---
    state.stage = 3
    state.stage3.status = STATUS.RUNNING
    await persistAndBroadcast()

    let chairman = state.chairman
    if (!answered.includes(chairman)) chairman = answered[0]

    // Close every council tab and give the chairman a single fresh one, so the
    // synthesis is judged purely on the anonymized materials in the prompt, not
    // on the chairman's own earlier turns (ADR-0012).
    await reopenTabsFor([chairman])
    if (cancelled) return abort()

    const reviewsLabeled = labeledResponses('stage2', reviewers)
    const synthPrompt = buildSynthesisPrompt(
      state.query,
      stage1Labeled,
      reviewsLabeled,
      synthTemplate,
    )

    const t3 = Date.now()
    let stopNudge = () => {}
    try {
      // Never request a quick answer for the synthesis — the final decision
      // should get the model's full reasoning.
      const baseline = await submitToTab(state.tabs[chairman], synthPrompt, false)
      stopNudge = startFocusNudger(() =>
        state?.stage3?.status === STATUS.RUNNING ? [state.tabs[chairman]].filter(Boolean) : [],
      )
      const text = await awaitTab(state.tabs[chairman], baseline, state.timeoutMs)
      if (!state) return
      state.stage3 = { status: STATUS.DONE, text, error: '', chairman, ms: Date.now() - t3 }
    } catch (err) {
      if (!state) return
      state.stage3 = {
        status: err.timeout ? STATUS.TIMEOUT : STATUS.ERROR,
        text: '',
        error: err.message || String(err),
        chairman,
        ms: Date.now() - t3,
      }
    } finally {
      stopNudge()
    }
    if (state) state.timings.stage3 = Date.now() - t3

    if (!state) return // reset mid-run
    state.status = STATUS.DONE
    state.finishedAt = Date.now()
    await persistAndBroadcast()
    await saveToHistory(state)
    await scheduleAutoClose()
  } catch (err) {
    if (!state) return // run was reset; nothing to record
    state.status = STATUS.ERROR
    state.error = err?.message || String(err)
    state.finishedAt = Date.now()
    await persistAndBroadcast()
    await saveToHistory(state)
    await scheduleAutoClose()
  }
}

// After a finished run, optionally close the council window (or the tabs we
// opened) once the configured delay elapses. Uses chrome.alarms so it fires even
// if the service worker is suspended in the meantime. The pending payload is
// persisted so the alarm handler can act on a freshly-woken worker.
async function scheduleAutoClose() {
  if (!state || !state.autoClose || cancelled) return
  const pending = {
    runId: state.runId,
    dedicated: state.dedicatedWindow,
    windowId: councilWindowId,
    tabIds: Object.values(state.tabs).filter(Boolean),
  }
  await chrome.storage.local.set({ [PENDING_CLOSE_KEY]: pending })
  const delayMs = state.autoCloseDelayMs ?? 10000
  // Alarms take minutes; a `when` timestamp gives us sub-minute precision.
  chrome.alarms.create(AUTOCLOSE_ALARM, { when: Date.now() + delayMs })
}

async function clearAutoClose() {
  try {
    await chrome.alarms.clear(AUTOCLOSE_ALARM)
  } catch {
    /* no-op */
  }
  await chrome.storage.local.remove(PENDING_CLOSE_KEY)
}

// Invoked from the background alarm listener when AUTOCLOSE_ALARM fires.
export async function performAutoClose() {
  const stored = await chrome.storage.local.get(PENDING_CLOSE_KEY)
  const pending = stored[PENDING_CLOSE_KEY]
  await chrome.storage.local.remove(PENDING_CLOSE_KEY)
  if (!pending) return

  // If a newer run has started (and is still active), don't close its window.
  if (state && state.runId !== pending.runId && state.status === STATUS.RUNNING) {
    return
  }

  try {
    if (pending.dedicated && pending.windowId != null) {
      await chrome.windows.remove(pending.windowId)
      if (councilWindowId === pending.windowId) councilWindowId = null
    } else if (pending.tabIds?.length) {
      await chrome.tabs.remove(pending.tabIds)
    }
  } catch {
    /* window/tabs already closed */
  }
}

async function abort() {
  if (!state) return
  state.status = STATUS.CANCELLED
  state.finishedAt = Date.now()
  await persistAndBroadcast()
  await saveToHistory(state)
}
