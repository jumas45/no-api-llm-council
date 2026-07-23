# CLAUDE.md — LLM Council (Chrome Extension, MV3)

Project-specific guidance. Merge with the global `~/.claude/CLAUDE.md` rules.

## What this is

A Manifest V3 Chrome extension that ports Karpathy's `llm-council`: it runs a
3-stage council debate (First Opinions → anonymized Peer Review → Chairman's
Synthesis) across ChatGPT, Claude, and Gemini by **driving their web UIs** in
browser tabs. No API keys, no background network calls to providers.

## Build & run

```bash
npm install
npm run build      # → ./dist  (load this unpacked in chrome://extensions)
npm run dev        # Vite dev server + HMR on :5173
npm run icons      # regenerate public/icons/*
```

To update a loaded extension: `npm run build`, then click **reload** ↻ on the
extension card in `chrome://extensions`. Full details in
[`docs/BUILD.md`](./docs/BUILD.md).

The manifest version tracks `package.json`'s `version` — bump it there for a
release.

## Architecture map

| Layer | Files |
| --- | --- |
| Side-panel UI (React + Tailwind) | `index.html`, `src/main.jsx`, `src/App.jsx`, `src/ui/*` |
| Orchestrator (state machine) | `src/background/*` |
| DOM adapters (browser drivers) | `src/content/content_script.js`, `src/content/selectors.js` |
| Shared contract / config | `src/shared/constants.js` |
| Build config | `vite.config.js`, `manifest.config.js` |

## Guardrails specific to this project

- **Never widen `host_permissions`.** Keep it jailed to the model domains in
  `manifest.config.js` (`HOST_PERMISSIONS`). No `<all_urls>` / `*://*/*`.
  See [ADR-0003](./docs/adr/0003-strict-host-permission-jail.md).
- **No provider API calls / no background network calls.** Orchestration is
  DOM-only. See [ADR-0002](./docs/adr/0002-drive-web-uis-instead-of-apis.md).
- **Site selectors are brittle.** When a provider redesign breaks a driver,
  update only the candidate lists in `src/content/selectors.js`.
- **Keep members in sync.** A council member needs both an entry in
  `COUNCIL_MEMBERS` (`src/shared/constants.js`) and a matching host grant in
  `manifest.config.js`, or its tab injection silently fails.

## Documentation you must maintain as you work

Treat docs as part of "done," not an afterthought:

1. **`docs/`** holds developer docs. Keep [`docs/BUILD.md`](./docs/BUILD.md) in
   sync when the build/run/release steps change.
2. **`docs/adr/`** holds Architecture Decision Records. **When you make a
   significant or hard-to-reverse decision** (a new/replaced library, a
   security boundary, a cross-cutting pattern, a non-obvious workaround), write
   a new ADR **as part of that change**:
   - Copy `docs/adr/0000-template.md` → `docs/adr/NNNN-short-kebab-title.md`
     (next number in sequence).
   - Fill it in, set **Status: Accepted**, and add a row to the index table in
     `docs/adr/README.md`.
   - To reverse a past decision, write a new ADR that **supersedes** the old one
     and mark the old one `Superseded by ADR-NNNN` — don't rewrite its decision.
   - Skip ADRs for trivial, easily-reversed changes.
3. **`CHANGELOG.md`** records user-visible changes. **Every change a user would
   notice** (new/changed behavior, UI, permissions, fixes) gets a one-line
   entry under `## [Unreleased]`, in [Keep a Changelog](https://keepachangelog.com)
   format. On release, rename `[Unreleased]` to the new version. Skip
   internal-only refactors — those live in git history, not here.

## Test-Driven Development (TDD) — Mandatory Workflow

TDD is not optional on this project. Follow strict red-green-refactor for every
change unless it falls under a named exception below.

### The Cycle
1. **RED** — Write a failing test first that describes the desired behavior.
   Run it and confirm it fails for the expected reason (not a typo/import error).
2. **GREEN** — Write the minimum code needed to make the test pass. No extra
   logic, no speculative abstractions.
3. **REFACTOR** — Clean up the implementation and the test with the safety
   net of passing tests. Re-run the full suite after every refactor.

Never write implementation code before there is a failing test for it.
Never write more implementation than is needed to pass the current test.

### Rules
- One behavior per test. If a test needs "and" to describe it, split it.
- Tests must fail for the right reason before you make them pass — don't
  skip the red step, even when the fix seems obvious.
- Do not modify a test to make it pass unless the test itself was wrong.
  If you think the test is wrong, say so explicitly and explain why before
  changing it.
- Do not delete or comment out a failing test to unblock a commit.
- Run the full test suite (not just the new test) before considering a task done.
- No commit should introduce new code without a corresponding test, and no
  commit should leave the suite red.

### Named Exceptions (the only cases where TDD may be skipped)
- **Throwaway spikes/prototypes** explicitly marked as such, never merged to
  main.
- **Pure config/docs/formatting changes** with no logic change.
- **Generated code** from a trusted, deterministic generator (e.g. protobuf
  stubs) — test the usage, not the generated file itself.
- **Emergency hotfix** — write the regression test immediately after, in the
  same PR or the very next commit, not "later."

If none of these apply and you're tempted to skip TDD for speed, stop and
flag it instead of proceeding.

### When Asked to Add a Feature
Always respond in this order:
1. Propose/write the test(s) first and show them.
2. Wait for confirmation (or proceed if instructed to move fast) — but still
   show the red test result before writing implementation.
3. Implement.
4. Refactor.
5. Report final test suite status (pass count, coverage delta if tracked).
