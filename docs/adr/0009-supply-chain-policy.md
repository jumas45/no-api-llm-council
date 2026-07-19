# ADR-0009: Supply-chain policy — lockfile-exact installs, audit, AI-BOM

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The extension ships bundled third-party code and, at runtime, parses untrusted
content with dependencies: `turndown` converts scraped provider DOM to Markdown,
and `react-markdown`/`remark-gfm` render model output in the side panel. A
compromised or malicious dependency version pulled in at build time could reach
that untrusted-data path (OWASP LLM03). `package.json` uses caret ranges, so
`npm install` may float versions; there was no documented audit step or
dependency inventory.

## Decision

1. **Lockfile-exact installs.** CI and releases use `npm ci` (honors
   `package-lock.json`, which is committed). `npm install` is reserved for
   intentional add/upgrade.
2. **Audit before release.** `npm audit --omit=dev` runs in CI on every PR and is
   a release gate (see [BUILD.md](../BUILD.md)).
3. **Keep an AI-BOM.** [`docs/AI-BOM.md`](../AI-BOM.md) inventories the provider
   surfaces driven and the dependencies that touch untrusted data; it is reviewed
   whenever a dependency, provider, or council member changes.
4. **Keep build tooling exact-pinned** where it already is (`@crxjs/vite-plugin`).

## Consequences

- Reproducible builds and an explicit, auditable gate against known-vulnerable
  runtime dependencies.
- Slightly more release ceremony (audit must pass, AI-BOM kept current). Genuine
  advisories may block a release until patched or triaged.
- No provider **model** version pinning is possible or meaningful here — we drive
  live web UIs (ADR-0002), so the "model" is always the site's current one. The
  AI-BOM records this explicitly rather than implying a pin.

## Alternatives considered

- **Pin every top-level dependency to an exact version in `package.json`.**
  The committed lockfile already gives reproducibility; exact top-level pins add
  upgrade friction without extra safety once `npm ci` is mandated. We may revisit
  if drift becomes a problem.
- **No audit gate.** Rejected: leaves the untrusted-data dependency path unmonitored.
