# ADR-0006: User-overridable prompt templates

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The Stage 2 (peer review) and Stage 3 (chairman synthesis) prompts are the
levers that most affect council output quality. They were previously hard-coded
in `src/background/prompts.js`. Two forces pushed for making them editable:

1. We realigned both prompts to be **verbatim ports of Karpathy's `llm-council`**
   (Stage 2 now emits a strict `FINAL RANKING:` block we parse; Stage 3 uses the
   upstream chairman wording). Users experimenting with the council will want to
   tweak that wording without rebuilding the extension.
2. The project's DOM-only, no-backend constraint (ADR-0002) means there is no
   server-side config; any user setting must live in the browser.

## Decision

We will let users override the Stage 2 and Stage 3 prompt templates from a new
**Settings** tab, persisting overrides in `chrome.storage.local` under
`SETTINGS_STORAGE_KEY` (`{ reviewPrompt?, synthesisPrompt? }`).

- The defaults (`DEFAULT_REVIEW_PROMPT`, `DEFAULT_SYNTHESIS_PROMPT`) remain the
  single source of truth in `prompts.js`. An absent/empty override means "use
  the default", so runs keep tracking upstream if a default changes.
- Templates use `{{query}}`, `{{responses}}`, and (synthesis only) `{{reviews}}`
  placeholders. `renderTemplate` fills known tokens and leaves unknown ones
  untouched so a malformed override degrades visibly.
- The side panel reads overrides at launch and passes them through the existing
  `START_COUNCIL` payload; the orchestrator forwards them to the builders and
  does **not** store them on run state (they would bloat every history record).

## Consequences

- Editing prompts no longer requires a rebuild — good for iteration.
- Overrides are per-browser and per-profile; they are not synced or exported,
  and are invisible in run history. That is an accepted limitation.
- The prompt builders are now the contract boundary for tokens. Adding a new
  template variable means updating both the default string and the token list
  surfaced in `SettingsView`, or users' existing overrides silently omit it.
- `prompts.js` is now imported by the UI bundle too (for the default strings and
  builders), so it must stay free of `chrome.*` / worker-only APIs.

## Alternatives considered

- **A structured field-by-field editor** (separate inputs per prompt section)
  instead of a raw template textarea. Rejected as over-engineered for a
  single-user tool; a raw editable template with token hints is simpler and more
  flexible.
- **Storing overrides on run state / in history.** Rejected: it bloats every
  saved record and conflates a global preference with per-run config.
