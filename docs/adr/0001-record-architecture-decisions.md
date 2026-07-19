# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

This project has several non-obvious design choices (driving web UIs instead of
APIs, a strict host jail, focusing tabs before typing) that are currently only
explained in scattered code comments and the README. As the project grows, the
reasoning behind these choices risks being lost, leading to accidental
regressions (e.g. someone widening `host_permissions` without knowing why it was
narrow).

## Decision

We will keep lightweight Architecture Decision Records in `docs/adr/`, one
Markdown file per decision, following the template in `0000-template.md`. New
significant decisions get a new ADR **as the work happens**, not retroactively.

## Consequences

- The "why" behind decisions lives next to the code and survives handoffs.
- A small, ongoing documentation cost per significant decision.
- Reversing a past decision means writing a superseding ADR, not silently
  editing history — the trail stays intact.

## Alternatives considered

- **README only** — grows unwieldy and mixes user-facing docs with rationale.
- **Commit messages / PR descriptions** — hard to browse and easily lost in a
  repo with sparse history.
- **A wiki** — external to the repo; drifts out of sync with the code.
