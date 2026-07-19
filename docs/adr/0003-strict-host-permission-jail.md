# ADR-0003: Strict host-permission jail

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

Because the extension works by injecting into and reading from page DOMs
(see [ADR-0002](./0002-drive-web-uis-instead-of-apis.md)), its `host_permissions`
and content-script `matches` define exactly which sites it can touch. A broad
grant (`<all_urls>`, `*://*/*`) would let the extension read and manipulate every
site the user visits — an unacceptable privacy and security surface for a tool
whose only job is talking to a few specific model sites.

## Decision

We will scope `host_permissions` and content-script `matches` to **only** the
authorized model domains, defined once as `HOST_PERMISSIONS` in
`manifest.config.js` and reused for the content-script matches. We will **never**
add `<all_urls>` or `*://*/*`.

## Consequences

- The extension can only act on the model sites; it is inert everywhere else.
- Adding a new council member requires deliberately adding its domain here (and
  wiring it into `COUNCIL_MEMBERS` in `src/shared/constants.js`), which is the
  correct, reviewable place for that decision.
- Keep `manifest.config.js` and `src/shared/constants.js` in sync: a member the
  UI can select must have a matching host grant, or its tab injection silently
  fails.

## Alternatives considered

- **`<all_urls>`** — trivially convenient but grossly over-privileged and would
  (rightly) draw scrutiny in any store review.
- **`optional_host_permissions` requested at runtime** — more flexible, but adds
  a permission-prompt flow that isn't needed for a fixed, known set of sites.
