# ADR-0002: Drive provider web UIs instead of their APIs

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The extension ports Karpathy's `llm-council` orchestration (a 3-stage debate
across ChatGPT, Claude, and Gemini). The original runs server-side against
provider APIs, which requires API keys, billing, and network calls. We want a
zero-setup tool a user can run against models they already pay for through their
normal browser logins.

## Decision

We will orchestrate the models by **driving their web UIs** in browser tabs —
injecting the prompt into each site's editor and reading the streamed answer
from the DOM — rather than calling any provider API. Communication happens only
by manipulating the DOM of the authorized domains; the extension makes **no
background network calls** to model providers.

## Consequences

- No API keys, no billing setup, no server. It reuses the user's existing
  logged-in sessions (shared across the whole Chrome profile).
- We depend on each site's markup. Selectors are brittle and must be maintained
  in `src/content/selectors.js` (fallback candidate lists per domain). Provider
  redesigns can break the driver — the "generation complete" signal is the
  disappearance of the site's Stop button.
- Tabs must be briefly **focused** to accept typed input (see the two-phase
  `TYPE_AND_SUBMIT` / `AWAIT_RESPONSE` message contract), which is why tabs flash
  to the foreground during a run.
- Per-tab inactivity timeouts isolate a stuck model so it can't hang the loop.

## Alternatives considered

- **Provider APIs** — cleaner and more stable, but requires keys, billing, and
  breaks the "no setup, use what you already have" goal.
- **Headless automation outside the browser** — loses the user's authenticated
  sessions and cookies, and cannot ride existing logins.
