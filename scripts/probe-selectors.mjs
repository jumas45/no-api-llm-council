// ============================================================================
// Live selector probe (Playwright)
// ----------------------------------------------------------------------------
// Verifies whether the content-script's DOM automation still works against a
// council site — i.e. can it find the composer, type the prompt, and submit?
// Sites redesign their markup often: when a composer selector drifts, the prompt
// is never entered yet the run can still advance to "Generating".
//
// Usage:
//   node scripts/probe-selectors.mjs chatgpt       (default)
//   node scripts/probe-selectors.mjs claude
//   node scripts/probe-selectors.mjs gemini
//
// Runs headed against a PERSISTENT profile (./.probe-profile) so you log in
// once and reruns stay authenticated. It types a probe prompt but does NOT
// press submit unless you pass --submit.
// ============================================================================

import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { SELECTORS } from '../src/content/selectors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROFILE_DIR = resolve(__dirname, '..', '.probe-profile')

const DOMAIN_BY_ALIAS = {
  claude: 'claude.ai',
  gemini: 'gemini.google.com',
  chatgpt: 'chatgpt.com',
}
const URL_BY_DOMAIN = {
  'claude.ai': 'https://claude.ai/new',
  'gemini.google.com': 'https://gemini.google.com/app',
  'chatgpt.com': 'https://chatgpt.com/',
}

const alias = (process.argv[2] || 'chatgpt').replace(/^--/, '')
const domain = DOMAIN_BY_ALIAS[alias] || alias
const doSubmit = process.argv.includes('--submit')
const loginMode = process.argv.includes('--login')
const selectors = SELECTORS[domain]
if (!selectors) {
  console.error(`Unknown domain "${domain}". Try: chatgpt | claude | gemini`)
  process.exit(1)
}

const PROMPT = 'Probe test: reply with the single word OK.'

// Mirror of content_script's setPrompt, injected into the page so we test the
// EXACT typing path the extension uses.
const SET_PROMPT_FN = `
({ sel, text }) => {
  function queryFirst(cands) {
    for (const s of cands) { const el = document.querySelector(s); if (el) return el }
    return null
  }
  const candidates = sel.input
  const el = queryFirst(candidates)
  if (!el) return { ok: false, reason: 'no-input-element' }

  const isNative = el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
  el.focus()
  if (isNative) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, text); else el.value = text
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } else {
    const selection = window.getSelection()
    selection.removeAllRanges()
    const range = document.createRange()
    range.selectNodeContents(el)
    selection.addRange(range)
    let ok = false
    try { ok = document.execCommand('insertText', false, text) } catch { ok = false }
    if (!ok || !el.innerText.includes(text.slice(0, 12))) {
      try {
        const dt = new DataTransfer()
        dt.setData('text/plain', text)
        el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
      } catch {}
    }
    if (!el.innerText.includes(text.slice(0, 12))) {
      el.textContent = text
      el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }))
    }
  }
  const landed = isNative ? el.value : el.innerText
  return {
    ok: landed.includes(text.slice(0, 12)),
    isNative,
    matchedSelector: candidates.find((s) => document.querySelector(s) === el),
    tag: el.tagName.toLowerCase(),
    landed: landed.slice(0, 80),
  }
}
`

// Report which of a candidate list currently match, with a short descriptor.
const PROBE_LIST_FN = `
(cands) => cands.map((s) => {
  let els = []
  try { els = Array.from(document.querySelectorAll(s)) } catch { return { selector: s, error: 'invalid' } }
  const first = els[0]
  return {
    selector: s,
    count: els.length,
    sample: first ? {
      tag: first.tagName.toLowerCase(),
      aria: first.getAttribute('aria-label') || null,
      type: first.getAttribute('type') || null,
      disabled: first.disabled ?? (first.getAttribute('aria-disabled') === 'true'),
    } : null,
  }
}).filter((r) => r.count > 0 || r.error)
`

function section(title) {
  console.log('\n' + '─'.repeat(64) + '\n' + title + '\n' + '─'.repeat(64))
}

// page.evaluate treats a string arg as an expression (args ignored), so wrap the
// function-source in a real function that rebuilds and calls it with our arg.
function callInPage(page, fnStr, arg) {
  return page.evaluate(
    ({ fnStr, arg }) => new Function('return (' + fnStr + ')')()(arg),
    { fnStr, arg },
  )
}

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1280, height: 900 },
})
const page = context.pages()[0] || (await context.newPage())

console.log(`\n▶ Probing ${domain}  (submit=${doSubmit})`)
console.log(`  profile: ${PROFILE_DIR}`)

try {
  await page.goto(URL_BY_DOMAIN[domain], { waitUntil: 'domcontentloaded', timeout: 60000 })

  // --login: just hold the window open so you can authenticate into this probe
  // profile; the session persists so the next (probe) run is logged in.
  if (loginMode) {
    console.log(
      '\n  LOGIN MODE: log into ' +
        domain +
        ' in the window that opened.\n  When done, CLOSE the browser window (or wait — auto-exits in 6 min).',
    )
    for (let i = 0; i < 180; i++) {
      if (context.pages().length === 0) break
      await new Promise((r) => setTimeout(r, 2000))
    }
    console.log('  Login session saved. Now run: node scripts/probe-selectors.mjs ' + alias)
    await context.close()
    process.exit(0)
  }

  // Give the SPA time to hydrate its composer, and you a moment to log in.
  console.log('\n  Waiting 8s for the page/composer to hydrate (log in if prompted)…')
  await page.waitForTimeout(8000)

  section('INPUT candidates (composer) — which match right now')
  console.log(JSON.stringify(await callInPage(page, PROBE_LIST_FN, selectors.input), null, 2))

  section('SEND BUTTON candidates — which match right now')
  console.log(JSON.stringify(await callInPage(page, PROBE_LIST_FN, selectors.sendButton), null, 2))

  section('STOP BUTTON candidates (only present while generating)')
  console.log(JSON.stringify(await callInPage(page, PROBE_LIST_FN, selectors.stopButton), null, 2))

  section('RESPONSE candidates')
  console.log(JSON.stringify(await callInPage(page, PROBE_LIST_FN, selectors.response), null, 2))

  section('TYPE TEST — replicating the extension\'s setPrompt path')
  const typeResult = await callInPage(page, SET_PROMPT_FN, { sel: selectors, text: PROMPT })
  console.log(JSON.stringify(typeResult, null, 2))
  console.log(
    typeResult.ok
      ? '\n  ✅ Prompt landed in the composer — typing works.'
      : '\n  ❌ Prompt did NOT land — the input selector is stale for this site.',
  )

  if (doSubmit && typeResult.ok) {
    section('SUBMIT TEST')
    const clicked = await page.evaluate((cands) => {
      for (const s of cands) {
        const b = document.querySelector(s)
        if (b && !b.disabled && b.getAttribute('aria-disabled') !== 'true') {
          b.click()
          return { clicked: true, selector: s }
        }
      }
      return { clicked: false }
    }, selectors.sendButton)
    if (!clicked.clicked) {
      await page.keyboard.press('Enter')
      console.log('  No enabled send button matched — pressed Enter instead.')
    } else {
      console.log('  Clicked send button: ' + clicked.selector)
    }
    await page.waitForTimeout(3000)
    const generating = await page.evaluate(
      (cands) => cands.some((s) => document.querySelector(s)),
      selectors.stopButton,
    )
    console.log('  Stop button present (⇒ generation started): ' + generating)
  }

  const shot = resolve(__dirname, '..', `.probe-${alias}.png`)
  await page.screenshot({ path: shot, fullPage: false })
  console.log(`\n  📸 Screenshot: ${shot}`)

  console.log('\n  Keeping the browser open 12s so you can inspect… (Ctrl+C to keep it open)')
  await page.waitForTimeout(12000)
} finally {
  await context.close()
}
