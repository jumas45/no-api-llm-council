# No API LLM Council — Chrome Extension (Manifest V3)

[![CI](https://github.com/jumas45/no-api-llm-council/actions/workflows/ci.yml/badge.svg)](https://github.com/jumas45/no-api-llm-council/actions/workflows/ci.yml)
![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)
![Built with React + Vite](https://img.shields.io/badge/React%20%2B%20Vite-tooling-646CFF?logo=vite&logoColor=white)
![No API keys](https://img.shields.io/badge/API%20keys-none-brightgreen)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Convene a council of ChatGPT, Claude, and Gemini on any question — they answer,
> anonymously peer-review each other, and a chairman synthesizes the verdict —
> all by driving their **web UIs**, with no API keys and no background network calls.

A browser-native port of **[Andrej Karpathy's `llm-council`](https://github.com/karpathy/llm-council)**.
Instead of calling APIs, this Manifest V3 extension drives the web UIs of
ChatGPT, Claude, and Gemini in background tabs and runs the same 3-stage council
debate, rendering the final synthesis in a Chrome Side Panel.

![The No-API LLM Council — architecture blueprint](assets/no-api-llm-council-architecture.png)

- **No API keys.** It uses your existing logged-in browser sessions.
- **No background network calls.** All communication happens by injecting text
  into the DOM of the three authorized domains.
- **Strict host jail.** `host_permissions` is limited to `chatgpt.com`,
  `claude.ai`, and `gemini.google.com` — never `<all_urls>`.

## Table of contents

- [See it in action](#see-it-in-action)
- [How it works](#how-it-works)
- [Install](#install)
- [Usage](#usage)
- [Customize the prompts](#customize-the-prompts)
- [Configuration](#configuration)
- [Development](#development)
  - [Testing](#testing)
  - [Architecture](#architecture)
  - [Maintaining the DOM adapters](#maintaining-the-dom-adapters)
- [Publishing to the Chrome Web Store](#publishing-to-the-chrome-web-store)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)
- [Credits](#credits)

## See it in action

One question → three frontier models answer, anonymously grade each other, and a
chairman compiles the verdict — **no API keys, just your logged-in browser tabs.**

![The extension driving a live Gemini tab while the side panel shows the Chairman's synthesized answer](assets/no-api-llm-council-final-output.png)

<sub>The chairman's synthesis (right) is produced by driving a real Gemini tab
(left) — formatted comparison table and all — without a single API call.</sub>

## How it works

The council runs the same three stages as Karpathy's original:

1. **Stage 1 — First Opinions.** The raw, unaltered query is sent concurrently
   to every selected member's tab.
2. **Stage 2 — Anonymized Peer Review.** Stage 1 answers are relabeled
   `Response A/B/C` (identities hidden to prevent sycophancy) and each member
   reviews the full set with "Do not favor your own prior response."
3. **Stage 3 — Chairman's Synthesis.** The chosen chairman receives the query,
   all responses, and all reviews, and compiles one final authoritative answer.

![A live council session with all three members generating in parallel](assets/no-api-llm-council-in-progress.png)

<sub>A live session — the stepper sits on Peer Review while ChatGPT, Claude, and
Gemini all generate in parallel; a pulsing dot marks whatever is still working.</sub>

Each tab has a configurable inactivity timeout, caught so one stuck model can't
hang the whole loop.

![A completed council run — synthesis, first opinions, and peer-review ranking](assets/no-api-llm-council-output.png)

<sub>A completed run: the Chairman's synthesis on top, then each member's first
opinion, and the anonymized peer-review leaderboard (3 ballots).</sub>

## Install

> **Not yet on the Chrome Web Store.** For now, build from source and load the
> unpacked extension.

**Prerequisites**

- Node.js (ESM-capable — the repo uses `"type": "module"`).
- Google Chrome with Developer mode.
- You must already be **logged into** ChatGPT, Claude, and Gemini in the Chrome
  profile you load the extension into — it drives your existing web sessions.

**Build and load**

```bash
npm install
npm run build        # outputs the loadable extension to ./dist
```

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `dist/` folder.
4. Pin the extension and click its icon to open the **side panel**.
5. After a rebuild, click the **reload** ↻ icon on the extension card.

Full build/run/release detail lives in [`docs/BUILD.md`](docs/BUILD.md).

> Logins are shared across the whole Chrome profile, so the dedicated council
> window reuses your existing sessions automatically — you never need to log in
> again. Only a *different profile* or *incognito* window would have separate
> sessions, and the extension never opens those.

## Usage

1. Open the side panel.
2. Type a query, pick council members, choose a Chairman, set a timeout.
3. Click **Convene Council**. By default the council runs in its own separate
   window (toggle "Run in a separate window" off to instead use pinned
   background tabs in your current window). It drives all three stages, streaming
   status into the panel.
4. Read the Chairman's final synthesis at the top; a **1→2→3 stepper** shows
   which stage is active. Stage 1 (sky), Stage 2 (rose), and Stage 3 (emerald)
   are color-coded and start collapsed (the live stage auto-opens). A pulsating
   dot marks whatever is still generating.
5. **Copy** or **Email** any single response, the synthesis, or the full
   transcript via the buttons on each block.
6. **↺ New question / Stop & reset** stops any running session, clears the
   current responses, and resets the panel. (**Cancel** instead stops generation
   but keeps whatever was gathered.)
7. Every completed run is saved to the **History** tab — expand any item to see
   all Stage 1/2 responses and the Chairman's decision, copy/email it,
   **Export .md**, **Reuse query**, or delete it.

![The side panel with the History tab open](assets/no-api-llm-council-history.png)

<sub>The side panel: Council / History / Settings tabs, the 1→2→3 stage stepper,
and every past session with export and reuse controls.</sub>

### Why tabs briefly come to the foreground

Text insertion into ChatGPT/Claude/Gemini's rich-text editors only works when
their tab is **focused** — in a background tab the browser silently drops the
inserted text. So the orchestrator briefly activates each tab just long enough to
type + submit the prompt, then lets the model generate in the background while it
moves on. You'll see each tab flash to the front once per stage; that's expected.

## Customize the prompts

The council isn't a black box — **every stage runs on a prompt template you can
edit.** The **Settings** tab exposes the Stage 2 (Peer Review) and Stage 3
(Chairman Synthesis) prompts, starting from Karpathy's `llm-council` defaults.
Rewrite the rubric, change the tone, or enforce a specific output format, using
`{{query}}`, `{{responses}}`, and `{{reviews}}` tokens to inject the run's content
— remove a token and that content is left out. Overrides are stored locally in
your browser and apply to your next run; **Reset to default** restores the
original at any time.

![The Settings tab with editable Stage 2 and Stage 3 prompt templates](assets/no-api-llm-council-settings.png)

<sub>Run options plus fully editable Stage 2 / Stage 3 prompt templates — tune the
council's behavior, then reset to the defaults whenever you like.</sub>

## Configuration

All options are set on the panel's **Settings** tab and per run:

| Option | Default | What it does |
| --- | --- | --- |
| Per-tab timeout | 240s | Inactivity budget before a member is marked timed-out. |
| Run in a separate window | on | Contains the focus-flashing to a dedicated council window. |
| Close window/tabs when finished | on (30s) | Tidies up after a run; the delay lets you glance at the tabs. Survives service-worker suspension via `chrome.alarms`. |
| Keep tabs active | on | Rotates focus to still-generating tabs so their output renders and is scraped. |
| Answer now | off | Clicks a provider's optional "quick answer" control (never for the synthesis). |
| Review / Synthesis prompts | Karpathy defaults | Override the Stage 2/3 templates — see [Customize the prompts](#customize-the-prompts). Stored locally in the browser. |

## Development

```bash
npm run dev          # Vite dev server + HMR on :5173
npm test             # run the test suite once
npm run test:watch   # red-green-refactor loop
npm run build        # production build → ./dist
```

This project follows **Test-Driven Development** and keeps its Architecture
Decision Records current — see [`CLAUDE.md`](CLAUDE.md) and [`docs/adr/`](docs/adr/)
before contributing.

### Testing

[Vitest](https://vitest.dev) + jsdom, with `@testing-library/react` for
components. The full 3-stage orchestrator is exercised end-to-end against a fake
`chrome` harness (`src/test/chromeHarness.js`) under fake timers, and the
manifest host-permission jail is asserted as a build gate. Per-file coverage
thresholds on the core logic run in CI.

```bash
npm run test:coverage
```

See [ADR-0010](docs/adr/0010-testing-strategy-vitest.md) (strategy) and
[ADR-0011](docs/adr/0011-pragmatic-orchestrator-coverage.md) (what's covered vs.
deliberately not).

### Architecture

| Layer | Files |
| --- | --- |
| Side-panel UI (React + Tailwind) | `index.html`, `src/main.jsx`, `src/App.jsx`, `src/ui/*` |
| Orchestrator (state machine) | `src/background/background.js`, `src/background/orchestrator.js`, `src/background/prompts.js` |
| Browser drivers (DOM adapters) | `src/content/content_script.js`, `src/content/selectors.js` |
| Shared contract / config | `src/shared/constants.js` |
| Storage | `chrome.storage.local` (keys `councilState`, `councilHistory`, `councilSettings`) |

See [`docs/adr/`](docs/adr/) for the reasoning behind the key decisions.

### Maintaining the DOM adapters

LLM sites change their markup often. All CSS selectors are externalized and
mapped by domain at the top of [`src/content/selectors.js`](src/content/selectors.js)
— each field is a list of fallback candidates tried in order. When a provider
ships a redesign, update only that file. The "generation complete" signal is
primarily text stability, with each site's **Stop** button as a secondary hint.

Icons are generated, not checked in as source-of-truth art:

```bash
npm run icons        # writes public/icons/icon-{16,32,48,128}.png
```

## Publishing to the Chrome Web Store

```bash
npm run package      # build, then zip dist/ → no-api-llm-council-v<version>.zip
```

Upload the zip at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
**The Web Store signs the extension for you** on publish — you don't generate a
`.crx` or manage signing keys. CI also attaches the zip as a build artifact on
every run. Bump `version` in `package.json` first (the manifest tracks it
automatically); see the release checklist in [`docs/BUILD.md`](docs/BUILD.md).

The full store submission walkthrough — developer account, listing, permission
justifications, and review-friction notes — is in
[`docs/PUBLISHING.md`](docs/PUBLISHING.md), and the privacy policy the listing
requires is [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Security

- **Strict host-permission jail** — reach is limited to the three model domains;
  never `<all_urls>` ([ADR-0003](docs/adr/0003-strict-host-permission-jail.md)),
  enforced by a test.
- **No provider API calls / no background network egress** — orchestration is
  DOM-only ([ADR-0002](docs/adr/0002-drive-web-uis-instead-of-apis.md)); the CSP
  blocks `connect-src` and remote images ([ADR-0008](docs/adr/0008-content-security-policy.md)).
- **Prompt-injection boundary** — model outputs are wrapped as tagged, fenced
  data before being fed to peer review / synthesis
  ([ADR-0007](docs/adr/0007-prompt-injection-data-boundary.md)).
- **Supply chain** — lockfile-exact installs and `npm audit` gate the build
  ([ADR-0009](docs/adr/0009-supply-chain-policy.md)); see [`docs/AI-BOM.md`](docs/AI-BOM.md).

Found a vulnerability? Please open a private report rather than a public issue.

## Contributing

Contributions are welcome. Before opening a PR:

1. `npm install`, then work in `npm run test:watch`.
2. Follow the **TDD workflow** and the guidelines in [`CLAUDE.md`](CLAUDE.md)
   (surgical changes, simplicity first).
3. For a significant/hard-to-reverse decision, add an ADR under
   [`docs/adr/`](docs/adr/) as part of the change.
4. Ensure `npm run test:coverage` and `npm run build` pass.
5. Keep `host_permissions` jailed and make no provider API / background network
   calls — these are hard project constraints.

## License

Released under the **MIT License** — see [`LICENSE`](LICENSE). This matches the
license of the upstream [`llm-council`](https://github.com/karpathy/llm-council)
project it ports.

## Credits

This project is a browser-based port of **Andrej Karpathy's**
[**llm-council**](https://github.com/karpathy/llm-council). The 3-stage council
orchestration (First Opinions → anonymized Peer Review → Chairman's Synthesis)
and its prompt templates originate from that repository. All credit for the
underlying idea and design goes to Karpathy; this extension only adapts it to
drive provider web UIs instead of calling APIs.
