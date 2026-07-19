# ADR-0010: Testing strategy — Vitest + jsdom, with a fake `chrome` harness

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

The project had no automated tests. Ahead of publishing to GitHub and the
Chrome Web Store as a signed extension, we need a safety net for the parts that
can silently produce wrong results: the 3-stage orchestrator state machine, the
prompt/ranking logic (which is also a security boundary — see ADR-0007), host
resolution for the DOM drivers, and the host-permission jail (ADR-0003).

Forces:

- The codebase is ESM + React, built with Vite. A runner that reuses Vite's
  resolution avoids a second, divergent build config.
- Most logic depends on the `chrome.*` extension APIs, which don't exist under a
  test runner.
- The content-script DOM drivers are **intentionally brittle** (selectors track
  provider redesigns) — pinning their exact DOM would create churny, low-value
  tests.

## Decision

We will use **Vitest** with the **jsdom** environment as the test framework,
plus `@testing-library/react` for component tests.

- Vitest gets its **own config** (`vitest.config.js`), not `vite.config.js`,
  because `@crxjs/vite-plugin` builds the MV3 manifest and breaks the runner.
- A global setup (`src/test/setup.js`) installs jest-dom matchers and a minimal
  `chrome.*` stub so modules import cleanly; tests override specific methods.
- Background code that spans the whole orchestration is tested through a **fake
  `chrome` harness** (`src/test/chromeHarness.js`) that simulates
  tabs/windows/storage/alarms and the content-script message round-trip, driven
  under fake timers to completion. This exercises `startRun` end-to-end (happy
  path, no-answers, chairman fallback, per-member timeout, auto-close) without a
  browser.
- The **manifest host-permission jail is asserted as a test** (`test/manifest.test.js`,
  run in the `node` environment because importing the manifest pulls in esbuild),
  turning the ADR-0003 guardrail into a build gate.
- We will **not** unit-test the content-script DOM drivers against synthetic
  provider DOM. They are covered at the contract level (`selectorsForHost`) and
  otherwise validated manually / via Playwright (already a devDependency) against
  the real sites when a selector breaks.

Scripts: `npm test` (CI), `npm run test:watch` (TDD loop), `npm run test:coverage`.

## Consequences

- Fast, browser-free confidence over the core logic; the suite runs in CI on
  every push/PR and gates `npm run build` and packaging.
- The TDD workflow mandated in `CLAUDE.md` now has a real harness to run against.
- Trade-off: the DOM drivers remain uncovered by automated tests. This is a
  deliberate, documented gap — their failure mode (a provider redesign) is
  detected in use and fixed by updating `selectors.js`, not by tests.
- The fake harness must track the orchestrator's chrome API usage; if the
  orchestrator starts calling a new `chrome.*` method, the harness needs the
  matching stub.

## Alternatives considered

- **Jest** — would need separate Babel/ESM plumbing to match Vite's resolution;
  Vitest reuses it for free.
- **Mocking `chrome` with `sinon-chrome`/`jest-webextension-mock`** — heavier
  dependencies for less control than the small purpose-built harness, and
  another supply-chain entry to audit (ADR-0009).
- **Full E2E via Playwright against the real sites** — valuable but requires
  logged-in provider sessions and is inherently flaky; reserved for manual
  selector validation rather than the CI gate.
