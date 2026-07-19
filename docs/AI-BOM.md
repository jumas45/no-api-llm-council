# AI Bill of Materials (AI-BOM)

A documented inventory of everything this extension depends on to produce its
output, reviewed as part of each release (see [BUILD.md](./BUILD.md) and
[ADR-0009](./adr/0009-supply-chain-policy.md)). Because the whole pipeline is
DOM-driven, our "models" are the provider **web UIs**, not versioned API models.

## Model / provider surfaces driven

| Provider | Surface (web UI) | Origin | Auth | Version pinning |
| --- | --- | --- | --- | --- |
| ChatGPT | `https://chatgpt.com/` | jailed host permission | user's own logged-in session | N/A — always the site's current model/UI |
| Claude | `https://claude.ai/new` | jailed host permission | user's own logged-in session | N/A — always the site's current model/UI |
| Gemini | `https://gemini.google.com/app` | jailed host permission | user's own logged-in session | N/A — always the site's current model/UI |

There is **no** provider API call, API key, fine-tuning, training data, RAG
corpus, or vector store. The council members and their host grants must stay in
sync (`COUNCIL_MEMBERS` in `src/shared/constants.js` ↔ `HOST_PERMISSIONS` in
`manifest.config.js`).

## Output-path dependencies (process untrusted content)

These libraries touch attacker-influenceable data (scraped model output), so
they get the most scrutiny on upgrade:

| Package | Role | Untrusted input? |
| --- | --- | --- |
| `turndown` + `turndown-plugin-gfm` | scraped response DOM → Markdown (content script) | **yes** — provider DOM |
| `react-markdown` + `remark-gfm` | render council Markdown in the side panel | **yes** — model output |

Raw HTML rendering is **not** enabled (no `rehype-raw`), link/image URLs are
scheme-restricted (`src/ui/Markdown.jsx`), and the side panel runs under a
locked-down CSP ([ADR-0008](./adr/0008-content-security-policy.md)).

## Other runtime & build dependencies

- **Runtime:** `react`, `react-dom`.
- **Build/tooling:** `vite`, `@crxjs/vite-plugin` (exact-pinned), `@vitejs/plugin-react`,
  `tailwindcss`, `@tailwindcss/typography`, `autoprefixer`, `postcss`, `playwright`.

## Provenance & controls

- All transitive versions are pinned by `package-lock.json`; builds use `npm ci`.
- `npm audit --omit=dev` runs before every release (and should run in CI).
- No third-party plugins, MCP servers, or remote code are loaded at runtime.
- Review this file whenever a dependency, provider surface, or council member changes.
