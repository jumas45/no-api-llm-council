# Build & Release

How to build, run, and package the LLM Council Chrome extension (Manifest V3).

## Prerequisites

- Node.js (ESM-capable; the repo uses `"type": "module"`).
- Google Chrome with Developer mode.
- You must already be **logged into** ChatGPT, Claude, and Gemini in the Chrome
  profile you load the extension into — it drives your existing web sessions,
  there are no API keys.

## Install dependencies

For reproducible, lockfile-exact installs (what CI and releases should use):

```bash
npm ci              # installs exactly what package-lock.json pins
```

Use `npm install` only when you intend to add/upgrade a dependency (it may move
versions within the semver ranges and rewrite the lockfile).

### Dependency security

The extension parses untrusted, model-scraped DOM (via `turndown`) and renders
untrusted Markdown, so keep the dependency surface audited:

```bash
npm audit --omit=dev        # fail the build on known-vulnerable runtime deps
```

Run this in CI on every PR. The build/release checklist below assumes it passes.
See [`AI-BOM.md`](./AI-BOM.md) for the dependency & provider inventory, and
[ADR-0009](./adr/0009-supply-chain-policy.md) for the policy behind this.

## Test

```bash
npm test           # Vitest, single run (what CI uses)
npm run test:watch # red-green-refactor loop
npm run test:coverage
```

Vitest uses its own `vitest.config.js` (not `vite.config.js`, whose crx plugin
breaks the runner). Tests live next to the code as `*.test.js(x)`; a shared setup
in `src/test/setup.js` provides jest-dom matchers and a `chrome.*` stub. The full
orchestrator runs against a fake `chrome` harness (`src/test/chromeHarness.js`).
The manifest host-permission jail (ADR-0003) is asserted in `test/manifest.test.js`.
See [ADR-0010](./adr/0010-testing-strategy-vitest.md) for the strategy and the
documented coverage gaps (the DOM drivers are validated manually / via Playwright).

## Build (production)

```bash
npm run build      # Vite + @crxjs/vite-plugin → ./dist
```

The loadable, unpacked extension is written to `./dist`. This folder is what
Chrome loads; it is git-ignored and regenerated on every build.

## Load / update in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. First time: **Load unpacked** → select the `dist/` folder.
5. After a rebuild: click the **reload** ↻ icon on the extension card.
6. Pin the extension and click its icon to open the **side panel**.

## Dev mode (hot reload)

```bash
npm run dev        # Vite dev server on port 5173 (strict)
```

`@crxjs/vite-plugin` provides HMR for the side-panel UI. Changes to the
background service worker or content scripts may still require a reload of the
extension card in `chrome://extensions`.

## Icons

Icons are generated, not checked in as source-of-truth art:

```bash
npm run icons      # writes public/icons/icon-{16,32,48,128}.png
```

Edit `scripts/generate-icons.mjs` to change the design, then rerun and rebuild.

## Package for the Chrome Web Store

```bash
npm run package    # build, then zip dist/ → no-api-llm-council-v<version>.zip
```

`scripts/package.mjs` zips the **contents** of `dist/` (so `manifest.json` sits at
the archive root, as the Web Store requires) into `no-api-llm-council-v<version>.zip`.
It shells out to bsdtar (`System32\tar.exe`) on Windows and `zip` elsewhere — both
emit spec-compliant forward-slash paths, and neither adds an npm dependency
(ADR-0009). PowerShell's `Compress-Archive` is deliberately avoided: it writes
back-slash separators that Chrome can fail to resolve. CI also produces this zip
as a build artifact on every run.

Upload the zip at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
**The Web Store signs the extension for you** on publish — you do not generate a
`.crx` or manage signing keys yourself.

For the end-to-end store submission walkthrough (developer account, listing,
screenshots, permission justifications, and review-friction notes) see
[`PUBLISHING.md`](./PUBLISHING.md). The listing requires a public privacy policy
URL — host the contents of [`PRIVACY.md`](./PRIVACY.md).

## Versioning a release

`manifest.config.js` reads `version` from `package.json`, so the manifest version
tracks the package version automatically.

1. Bump `version` in `package.json`.
2. `npm ci` then `npm audit --omit=dev` (must pass).
3. `npm test` (must pass).
4. `npm run build`.
5. Reload the extension in `chrome://extensions` and smoke-test a run.
6. Update [`AI-BOM.md`](./AI-BOM.md) if any dependency or provider surface changed.
7. `npm run package` and upload `no-api-llm-council-v<version>.zip` to the Web Store
   (or download the `extension-zip` artifact from the CI run for that commit).

## Project layout

| Area | Files |
| --- | --- |
| Side-panel UI (React + Tailwind) | `index.html`, `src/main.jsx`, `src/App.jsx`, `src/ui/*` |
| Orchestrator (state machine) | `src/background/background.js`, `src/background/orchestrator.js`, `src/background/prompts.js` |
| DOM adapters (browser drivers) | `src/content/content_script.js`, `src/content/selectors.js` |
| Shared contract / config | `src/shared/constants.js` |
| Build config | `vite.config.js`, `manifest.config.js`, `tailwind.config.js`, `postcss.config.js` |
| Tooling scripts | `scripts/generate-icons.mjs`, `scripts/probe-selectors.mjs` |

See [`adr/`](./adr/) for the reasoning behind the key architectural decisions.
