// ============================================================================
// DOM Adapter / Browser Driver (PRD §3, Goal 1)
// ----------------------------------------------------------------------------
// Injected into chatgpt.com / claude.ai / gemini.google.com only (see manifest
// host_permissions jail).
//
// Two-phase protocol (fixes the "needs a click" bug):
//   TYPE_AND_SUBMIT  -> types the prompt into the composer bypassing React's
//                       onChange suppression and submits. This MUST run while
//                       the tab is focused, because execCommand/paste text
//                       insertion silently no-ops in a background tab. The
//                       orchestrator activates the tab before sending this.
//   AWAIT_RESPONSE   -> waits for generation to finish (MutationObserver on the
//                       "Stop" button, with a poll backstop) and scrapes the
//                       newest response bubble. Works fine in a background tab.
//
// Never makes network calls (PRD §2, Constraint 2) — DOM only.
// ============================================================================

import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { MSG } from '../shared/constants.js'
import { selectorsForHost } from './selectors.js'

// Converts a response's rendered DOM back into clean Markdown, so code blocks,
// headings, lists, tables, and ASCII diagrams survive — instead of scraping
// innerText (which drops all markdown structure).
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  hr: '---',
})
turndown.use(gfm)
// Keep fenced code blocks verbatim (don't let Turndown escape their contents).
turndown.addRule('fencedFromPre', {
  filter: (node) =>
    node.nodeName === 'PRE' && node.querySelector('code') != null,
  replacement: (_content, node) => {
    const code = node.querySelector('code')
    const cls = code.getAttribute('class') || ''
    const m = cls.match(/language-([\w+-]+)/)
    const lang = m ? m[1] : ''
    const text = code.textContent.replace(/\n$/, '')
    return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`
  },
})

const POLL_MS = 400
const STABLE_MS = 2500 // quiet period (no text change) before we trust "done"
const STUCK_MS = 9000 // if the "generating" flag looks stuck but text is stable
const ACTIVE_MS = 4000 // recent text change ⇒ still actively streaming
const OVERRUN_FACTOR = 2 // allow up to timeoutMs × this while still streaming

const sel = selectorsForHost()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- selector helpers -------------------------------------------------------

function queryFirst(candidates) {
  for (const s of candidates) {
    const el = document.querySelector(s)
    if (el) return el
  }
  return null
}

function queryLast(candidates) {
  for (const s of candidates) {
    const els = document.querySelectorAll(s)
    if (els.length) return els[els.length - 1]
  }
  return null
}

function countResponses(candidates) {
  for (const s of candidates) {
    const els = document.querySelectorAll(s)
    if (els.length) return els.length
  }
  return 0
}

async function waitForElement(candidates, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  let el = queryFirst(candidates)
  while (!el && Date.now() < deadline) {
    await sleep(200)
    el = queryFirst(candidates)
  }
  return el
}

function composerText(el) {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value || ''
  }
  return el.innerText || ''
}

// ---- typing (bypassing React onChange suppression) --------------------------

// Native <textarea>/<input>: call the prototype value setter React overrode.
function setNativeValue(el, value) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, value)
  else el.value = value
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function selectAll(el) {
  el.focus()
  const selection = window.getSelection()
  selection.removeAllRanges()
  const range = document.createRange()
  range.selectNodeContents(el)
  selection.addRange(range)
}

// Simulate a paste — ProseMirror (ChatGPT/Claude) and Quill (Gemini) all have
// robust paste handlers, and this is the most reliable focus-tolerant path.
function tryPaste(el, text) {
  try {
    selectAll(el)
    const dt = new DataTransfer()
    dt.setData('text/plain', text)
    const evt = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    })
    el.dispatchEvent(evt)
    return true
  } catch {
    return false
  }
}

// Contenteditable: execCommand insertText, then paste, then a raw fallback.
function setContentEditable(el, text) {
  selectAll(el)
  let ok = false
  try {
    ok = document.execCommand('insertText', false, text)
  } catch {
    ok = false
  }
  const probe = text.slice(0, 24)
  if (ok && el.innerText.includes(probe)) return

  if (tryPaste(el, text) && el.innerText.includes(probe)) return

  // Last resort: set text directly and fire an input event.
  el.textContent = text
  el.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    }),
  )
}

function setPrompt(el, text) {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    setNativeValue(el, text)
  } else {
    setContentEditable(el, text)
  }
}

// ---- submit -----------------------------------------------------------------

function pressEnter(el) {
  const opts = {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
  }
  el.dispatchEvent(new KeyboardEvent('keydown', opts))
  el.dispatchEvent(new KeyboardEvent('keypress', opts))
  el.dispatchEvent(new KeyboardEvent('keyup', opts))
}

async function submit(inputEl) {
  const deadline = Date.now() + 4000
  while (Date.now() < deadline) {
    const btn = queryFirst(sel.sendButton)
    if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
      btn.click()
      return
    }
    await sleep(150)
  }
  pressEnter(inputEl)
}

// ---- quick answer ("Answer now") --------------------------------------------

// Is this element a real, visible, enabled clickable target?
function isClickable(el) {
  if (!el || el.disabled) return false
  if (el.getAttribute?.('aria-disabled') === 'true') return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

// Is this element rendered *inside* a model response bubble? Response content is
// attacker-influenceable (a model can emit a link/button labeled "answer now"),
// so we must never treat it as a clickable UI control. See ADR-0004 (security
// update) and the LLM06 audit finding.
function isInsideResponse(el) {
  return (sel.response || []).some((s) => el.closest?.(s))
}

// Find the provider's optional "Answer now" / quick-answer control, by CSS
// candidate first, then by a short button label match. Deliberately strict:
//   • never a candidate that lives inside a response bubble (see above), and
//   • text matches must be EXACT (not prefix) against the short known labels,
// so a model's own output can't trigger an unintended click.
function findQuickAnswerButton() {
  const qa = sel.quickAnswer
  if (!qa) return null
  const css = queryFirst(qa.selectors || [])
  if (css && isClickable(css) && !isInsideResponse(css)) return css
  const texts = qa.texts || []
  if (!texts.length) return null
  const clickables = document.querySelectorAll(
    'button, [role="button"], [role="menuitem"], a',
  )
  for (const el of clickables) {
    if (!isClickable(el) || isInsideResponse(el)) continue
    const t = (el.innerText || el.textContent || '').trim().toLowerCase()
    if (!t || t.length > 40) continue
    if (texts.some((frag) => t === frag)) return el
  }
  return null
}

// Poll briefly for the quick-answer control (it only appears once the model
// starts thinking) and click it once. Best-effort: never throws, never blocks
// the submit response — callers fire-and-forget.
async function clickQuickAnswer(timeoutMs = 12000) {
  if (!sel?.quickAnswer) return false
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const btn = findQuickAnswerButton()
    if (btn) {
      btn.click()
      return true
    }
    await sleep(500)
  }
  return false
}

// ---- generation state -------------------------------------------------------

function isGenerating() {
  return Boolean(queryFirst(sel.stopButton))
}

// Confirm the submit actually took: generation started, OR a new bubble
// appeared, OR the composer cleared. Returns true if acknowledged.
async function waitForSubmitAck(prevCount, prevText, inputEl, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (isGenerating()) return true
    if (countResponses(sel.response) > prevCount) return true
    const now = composerText(inputEl)
    if (prevText && now !== prevText && now.trim() === '') return true
    await sleep(200)
  }
  return false
}

// Fast plain-text scrape — used for change/stability detection.
function scrapeLatestResponse() {
  const el = queryLast(sel.response)
  return el ? el.innerText.trim() : ''
}

// Replace an element with its children, preserving the inner text/markup.
function unwrap(node) {
  const parent = node.parentNode
  if (!parent) return
  while (node.firstChild) parent.insertBefore(node.firstChild, node)
  parent.removeChild(node)
}

// Rich scrape — DOM converted to Markdown, used for the final stored result.
function scrapeMarkdown() {
  const el = queryLast(sel.response)
  if (!el) return ''
  try {
    const clone = el.cloneNode(true)
    // Strip icon graphics first, so icon-only UI buttons become empty below.
    clone.querySelectorAll('svg, [aria-hidden="true"]').forEach((n) => n.remove())
    // Interactive controls: drop icon-only UI chrome (copy/edit/regenerate),
    // but PRESERVE the text of buttons that carry answer content — e.g. ChatGPT
    // renders inline suggestion chips as <button>s ("I can also [X], [Y], or
    // [Z]."). Removing those outright left broken sentences like "I can also , ,
    // or ." — the response looked truncated when it wasn't.
    clone.querySelectorAll('button, [role="button"]').forEach((n) => {
      if ((n.textContent || '').trim()) unwrap(n)
      else n.remove()
    })
    const md = turndown.turndown(clone).trim()
    return md || el.innerText.trim()
  } catch {
    return el.innerText.trim()
  }
}

// Wait for the new response and return its text. Resilient by design:
//   • Completion is detected primarily by TEXT STABILITY (the latest response
//     stops changing) — this does NOT depend on the fragile Stop-button
//     selector, so a stale stop selector no longer causes a false timeout.
//   • The Stop button, when detected, just keeps us waiting (still generating).
//   • The timeout is INACTIVITY-based: as long as the answer is actively
//     streaming we keep going, up to a hard overrun cap — so long answers to
//     hard questions aren't cut off mid-stream.
//   • If we DO give up but there's text on the page, we return it rather than
//     failing. Only a genuinely missing response element is a hard error
//     (surfaced distinctly so it's clear the selectors need updating).
function waitForResult(baseline, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const hardCap = timeoutMs * OVERRUN_FACTOR
    const initialText = scrapeLatestResponse()
    let lastText = initialText
    let lastChange = Date.now()
    let sawGeneration = false
    let sawResponseEl = Boolean(queryLast(sel.response))
    let poll = null
    let observer = null

    function cleanup() {
      if (poll) clearInterval(poll)
      if (observer) observer.disconnect()
    }
    function done() {
      cleanup()
      resolve(scrapeMarkdown()) // return rich Markdown, not innerText
    }

    function check() {
      const now = Date.now()
      const elapsed = now - start
      const generating = isGenerating()
      if (generating) sawGeneration = true

      const el = queryLast(sel.response)
      if (el) sawResponseEl = true
      const text = el ? el.innerText.trim() : ''

      if (text && text !== lastText) {
        lastText = text
        lastChange = now
      }

      const quiet = now - lastChange
      const isNewAnswer =
        countResponses(sel.response) > baseline ||
        sawGeneration ||
        (text && text !== initialText)
      const activelyWorking = generating || now - lastChange < ACTIVE_MS

      // Normal completion: a new, non-empty answer that has gone quiet.
      if (text && isNewAnswer && !generating && quiet >= STABLE_MS) {
        return done()
      }
      // Defensive: "generating" flag appears stuck, but output is long-stable.
      if (text && isNewAnswer && quiet >= STUCK_MS) {
        return done()
      }

      // Inactivity timeout — but keep going if still streaming (up to hardCap).
      if (elapsed >= timeoutMs) {
        if (activelyWorking && elapsed < hardCap) return
        cleanup()
        if (!sawResponseEl && !el) {
          reject(new Error('no-response-element')) // selectors likely outdated
        } else if (text) {
          resolve(scrapeMarkdown()) // best-effort: return whatever is on the page
        } else {
          reject(new Error('timeout'))
        }
      }
    }

    observer = new MutationObserver(check)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    poll = setInterval(check, POLL_MS)
    check()
  })
}

// ---- handlers ---------------------------------------------------------------

async function handleTypeAndSubmit(prompt, quickAnswer = false) {
  if (!sel) throw new Error('Unsupported host: ' + location.hostname)
  const inputEl = await waitForElement(sel.input, 20000)
  if (!inputEl) {
    throw new Error(
      `Composer input not found on ${sel.key} — its input selector may be out of date.`,
    )
  }

  const baseline = countResponses(sel.response)
  const beforeText = composerText(inputEl)

  setPrompt(inputEl, prompt)
  await sleep(350)

  // Verify the text actually landed in the composer. If it didn't, the input
  // selector matched the wrong element (or typing was rejected) — fail loudly
  // instead of submitting nothing and then waiting forever on a phantom answer.
  const probe = prompt.slice(0, 24)
  const entered = composerText(inputEl)
  if (probe && !entered.includes(probe) && entered.trim() !== beforeText.trim()) {
    // one retry via the paste path before giving up
    tryPaste(inputEl, prompt)
    await sleep(250)
  }
  if (probe && !composerText(inputEl).includes(probe)) {
    throw new Error(
      `Could not enter the prompt into the ${sel.key} composer — its input selector may be out of date.`,
    )
  }

  await submit(inputEl)

  // Confirm submission actually took (generation started / a new bubble appeared
  // / the composer cleared). Otherwise the send button selector is stale and we'd
  // otherwise sit in a false "Generating" state indefinitely.
  const acked = await waitForSubmitAck(baseline, beforeText, inputEl)
  if (!acked) {
    throw new Error(
      `The ${sel.key} prompt was typed but submitting it didn't take — its send-button selector may be out of date.`,
    )
  }

  // If the user opted into faster answers, click the provider's "Answer now"
  // control when it appears. Fire-and-forget so we don't delay the pipeline; the
  // orchestrator never sets this for the Chairman synthesis.
  if (quickAnswer) clickQuickAnswer().catch(() => {})

  return { baseline, acked }
}

async function handleAwaitResponse(baseline, timeoutMs) {
  if (!sel) throw new Error('Unsupported host: ' + location.hostname)
  const text = await waitForResult(baseline ?? 0, timeoutMs)
  if (!text) throw new Error('Empty response scraped from ' + sel.key)
  return text
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MSG.PING) {
    sendResponse({ ok: true, host: sel?.key || location.hostname })
    return false
  }

  if (message?.type === MSG.TYPE_AND_SUBMIT) {
    handleTypeAndSubmit(message.prompt, message.quickAnswer)
      .then((r) => sendResponse({ ok: true, ...r }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }))
    return true
  }

  if (message?.type === MSG.AWAIT_RESPONSE) {
    handleAwaitResponse(message.baseline, message.timeoutMs || 120000)
      .then((text) => sendResponse({ ok: true, text }))
      .catch((err) => {
        const code = err?.message
        const error =
          code === 'no-response-element'
            ? `Could not find the response on ${sel?.key} — its DOM selectors may be out of date.`
            : code
        sendResponse({ ok: false, error, timeout: code === 'timeout' })
      })
    return true
  }

  return false
})

console.debug(
  '[LLM Council] content adapter ready on',
  sel?.key || location.hostname,
)
