# Architecture Decision Records (ADRs)

This folder records the **significant decisions** made on this project — what we
chose, why, and what we traded away. The goal is that anyone (including a future
you or an AI assistant) can understand *why* the code is the way it is without
re-deriving it from scratch.

## When to write one

Write an ADR when you make a decision that is hard to reverse or that a
reasonable person might later question, e.g.:

- Choosing or replacing a library, framework, or build tool.
- A security/permissions boundary (e.g. host-permission scope).
- A cross-cutting architectural pattern (message contract, state machine).
- A non-obvious workaround (e.g. why tabs must be focused before typing).

Skip an ADR for trivial or easily-reversed changes.

## How to write one

1. Copy [`0000-template.md`](./0000-template.md).
2. Name it `NNNN-short-kebab-title.md`, using the next number in sequence.
3. Fill in the sections. Keep it short — a screenful is plenty.
4. Set **Status** to `Accepted` (or `Proposed` if still under discussion).
5. Add a row to the index below.
6. Never edit the decision of an already-Accepted ADR to reverse it. Instead
   write a new ADR that **supersedes** it, and mark the old one
   `Superseded by ADR-NNNN`.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](./0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](./0002-drive-web-uis-instead-of-apis.md) | Drive provider web UIs instead of their APIs | Accepted |
| [0003](./0003-strict-host-permission-jail.md) | Strict host-permission jail | Accepted |
| [0004](./0004-background-tab-capture-and-quick-answers.md) | Focus nudging for background-tab capture, and opt-in quick answers | Accepted |
| [0005](./0005-light-dark-theming-via-css-variables.md) | Light/dark theming via CSS variables | Accepted |
| [0006](./0006-user-overridable-prompt-templates.md) | User-overridable prompt templates | Accepted |
| [0007](./0007-prompt-injection-data-boundary.md) | Harden council prompts against cross-model prompt injection | Accepted |
| [0008](./0008-content-security-policy.md) | Content Security Policy for extension pages | Accepted |
| [0009](./0009-supply-chain-policy.md) | Supply-chain policy — lockfile installs, audit, AI-BOM | Accepted |
| [0010](./0010-testing-strategy-vitest.md) | Testing strategy — Vitest + jsdom, with a fake `chrome` harness | Accepted |
| [0011](./0011-pragmatic-orchestrator-coverage.md) | Pragmatic orchestrator coverage — cover behavior, not defensive plumbing | Accepted |
| [0012](./0012-fresh-tab-per-stage.md) | Fresh tab per stage to defeat self-preference bias | Accepted |
