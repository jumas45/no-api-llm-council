# ADR-0004: Focus nudging to capture background-tab output, and opt-in quick answers

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The orchestrator submits each member's prompt while its tab is focused, then
awaits all responses concurrently **in the background** (ADR-0002 drives web UIs,
so the answer is scraped from the DOM). In practice some provider SPAs defer
rendering their streamed answer while their tab is hidden — the network stream
arrives but the DOM isn't painted until the tab becomes visible. Because we scrape
the DOM, the captured output then stalls (or is missed entirely) until the user
manually focuses that tab. Users reported responses "not captured until I click
the tab."

Separately, some providers surface an optional **"Answer now" / quick-answer**
control while a model is thinking. Using it trades answer depth for speed, which
is a reasonable choice for the two debate stages but not for the final decision.

## Decision

1. **Focus nudge (default on).** While responses generate, rotate focus through
   the still-pending council tabs on a fixed interval (`FOCUS_NUDGE_INTERVAL_MS`,
   15s) — `chrome.windows.update({focused})` + `chrome.tabs.update({active})`.
   Each pending tab thus becomes visible periodically (and again once it
   finishes), forcing the deferred render so the content script can scrape it.
   The nudger reads the pending set each tick and stops itself when empty. Exposed
   as the **"Keep tabs active while generating"** toggle.

2. **Quick answers (default off, opt-in).** A per-run `quickAnswer` flag is
   threaded to the content driver via `TYPE_AND_SUBMIT`. When set, after a
   successful submit the driver polls briefly for the provider's quick-answer
   control (CSS candidates in `selectors.js` `quickAnswer.selectors`, then a
   strict short-label text match in `quickAnswer.texts`) and clicks it once,
   fire-and-forget. The orchestrator sets it for **Stage 1 and Stage 2 only** and
   **never for the Stage 3 Chairman synthesis**, so the final decision always
   gets the model's full reasoning.

## Consequences

- Fixes the "response not captured until focused" failure without polling the
  provider's network layer (still DOM-only, ADR-0002).
- The nudge **steals OS focus** roughly every 15s while any response is pending.
  This mirrors the focus-steal already required to type each prompt, and is
  opt-out. It is most tolerable in the default dedicated-window mode; in shared
  mode it will switch the active tab in the user's own window.
- Quick-answer targeting is **label/selector-based and brittle** (like all site
  selectors — see `selectors.js`). A provider redesign may make it a no-op; that
  degrades gracefully to "no speedup," never a broken run. Update only the
  `quickAnswer` candidate lists when that happens.

## Security update (2026-07-18)

The quick-answer text-fallback originally scanned **every** `button`/`[role]`/`a`
on the page and matched labels by prefix. Because model responses render into the
same DOM, a model could emit a link/button labeled e.g. "answer now" and have the
driver auto-click it — an indirect-injection → navigation vector in the user's
authenticated tab (OWASP LLM06). `findQuickAnswerButton` now (a) **excludes any
candidate inside a response bubble** (`sel.response`) and (b) requires an **exact**
label match, not a prefix. This refines — does not reverse — the opt-in
quick-answer decision above.

## Alternatives considered

- **Activate the tab without focusing the window.** Lighter touch, but a fully
  occluded background window can still report `hidden` on Windows/macOS
  (Chrome occlusion tracking), so rendering may not resume. Window focus is the
  reliable signal, matching what users observed manually.
- **Poll a hidden/offscreen render or the provider API.** Rejected: violates the
  DOM-only, no-provider-API constraint (ADR-0002).
- **Always use quick answers.** Rejected: it lowers answer quality; the final
  synthesis in particular must not be shortcut.
