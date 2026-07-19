# ADR-0011: Pragmatic orchestrator coverage — cover behavior, not defensive plumbing

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

ADR-0010 established the testing strategy and a fake `chrome` harness for driving
the orchestrator end-to-end. The initial suite left `orchestrator.js` at ~80%
line coverage. The question was whether to push it to 100%.

The uncovered remainder falls into two very different buckets:

1. **Meaningful behavior** that a user can trigger and that could regress
   silently — run cancellation (`abort()` → CANCELLED), dedicated-window mode
   (open a window, close the leftover on re-run), and the auto-close
   "a newer run is active, don't close it" guard.
2. **Defensive / timing-fragile plumbing** — the `sendToTab` retry loop, the
   `awaitTab` internal `Promise.race` timeout, `focusTab` / `waitForTabComplete`
   `try/catch` guards for already-closed tabs, and the focus-nudger `setInterval`
   body. Testing these means advancing fake timers through retry/round-trip races
   whose outcomes are inherently ordering-sensitive; such tests are more likely to
   flake than to catch a real defect, and they assert on internal mechanics rather
   than observable behavior.

## Decision

We will cover bucket 1 and **deliberately not** cover bucket 2.

- Added tests: cancellation → `abort()`; dedicated-window open + leftover-window
  close on re-run; `performAutoClose` removing a dedicated window; and the
  newer-run guard skipping a stale close. This brings `orchestrator.js` to ~86%
  statements / ~93% functions.
- We will **not** chase 100%. The defensive branches stay uncovered by intent.
- We lock the gain in with **per-file coverage thresholds** on the core logic
  (`orchestrator.js`, `prompts.js`, `selectors.js`, `constants.js`, `settings.js`)
  in `vitest.config.js`, set just under measured values. There is intentionally
  **no global threshold** — the UI and DOM-driver layers are untested by design
  (ADR-0010) and would drag a global number down misleadingly.
- CI runs `npm run test:coverage` so these thresholds gate the build.

## Consequences

- The behaviors a user actually exercises are pinned; a regression in
  cancel/dedicated-window/auto-close fails CI.
- The number reads honestly: ~86% on the orchestrator reflects "every meaningful
  branch, minus defensive guards," not a gamed 100%.
- Trade-off: a genuine bug living only in a retry/race guard would not be caught
  by tests. We accept this; those paths are simple, defensive, and their failure
  mode (a closed tab, an unreachable content script) is already handled by
  falling through to an error state the user sees.
- Maintenance: raising real coverage later should be accompanied by raising the
  matching threshold; lowering a threshold to unblock a change requires a reason.

## Alternatives considered

- **Push to 100%** (Option B when this was decided) — rejected: the last ~14%
  buys fragile tests over defensive code, trading suite reliability for a vanity
  metric.
- **Leave at 80%** — rejected: cancel/dedicated-window/auto-close are real user
  flows worth pinning.
- **A single global coverage threshold** — rejected: with the UI/DOM layers
  untested by design, any global floor is either trivially low or forces
  low-value UI tests.
