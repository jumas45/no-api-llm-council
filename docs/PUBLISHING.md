# Publishing to the Chrome Web Store

How to cut a release of **LLM Council** and get it onto (or updated on) the
Chrome Web Store. For local dev/build details see [`BUILD.md`](./BUILD.md).

## 0. Pre-flight

- [ ] Bump `version` in `package.json` (the manifest reads it — see
      `manifest.config.js`). Follow semver; the store rejects re-uploads that
      don't increase the version.
- [ ] `npm test` is green.
- [ ] You've run the [manual QA smoke test](#05-manual-qa-smoke-test) against the
      built `dist/`. The unit tests **cannot** catch a permission-gating
      regression — `chrome.*` is mocked in tests — so a real Load-unpacked run is
      the only thing that proves the extension still works with the current
      permission set.
- [ ] A public **privacy policy URL** is live (see step 3) — the store will not
      let you submit without one, because we request host permissions.

## 0.5. Manual QA smoke test

Do this every release, and especially after **any manifest `permissions` /
`host_permissions` change** — the automated suite mocks `chrome.*`, so it cannot
detect a permission that Chrome enforces at runtime but the code still relies on.
About 3 minutes; exercises every `chrome.tabs` / `chrome.windows` path a run
uses.

**Load the build**

- [ ] `chrome://extensions` → enable **Developer mode**.
- [ ] Remove any previously loaded copy first, so you're testing a clean install
      of the current permission set (not a stale grant).
- [ ] **Load unpacked** → select the freshly built `dist/`.

**Verify permissions (the store-relevant check)**

- [ ] Card shows **no red "Errors"** button (a malformed manifest flags here).
- [ ] **Details** → **Permissions** lists **only** what the manifest declares.
      In particular, confirm there is **no tab-access / "read your browsing
      history" warning** unless `tabs` is deliberately declared.

**Exercise every tab code path — one council run**

Be logged into ChatGPT, Claude, and Gemini in this profile, then open the side
panel, run a short prompt (e.g. *"Name one benefit of unit tests"*), and confirm:

- [ ] Three tabs open and briefly focus — proves `tabs.create` /
      `windows.create` + `tabs.update({active})`.
- [ ] Each provider receives the typed prompt — proves the `tabs.onUpdated`
      load-wait + `tabs.sendMessage`.
- [ ] Answers stream back into the panel — proves `tabs.get`
      (`.status`/`.windowId`) + scraping.
- [ ] Tabs auto-close after the run (if the "close when finished" toggle is on)
      — proves `tabs.remove`.

**Check for silent runtime errors**

- [ ] Extension card → **service worker** → **Inspect** → **Console** shows no
      `permission`-related or `Cannot read properties of undefined` errors from
      the run.

> This is manual by necessity: loading an unpacked extension needs a native file
> picker, and `chrome://` pages plus the side panel aren't reachable by page
> automation — so it can't be scripted.

## 1. Build the upload package

```bash
npm install
npm run package
```

This builds `dist/` and produces `no-api-llm-council-v<version>.zip` at the repo root,
with `manifest.json` at the archive root — the exact layout the Chrome Web Store
expects. Upload **this zip** (not the `dist/` folder, not the source).

## 2. Developer account (one-time)

- Sign in to the
  [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
- Pay the **one-time $5 USD** registration fee.
- Set up your publisher contact email and verify it.

## 3. Host the privacy policy

The store requires a publicly reachable privacy policy URL because the extension
requests host permissions. Options:

- Enable **GitHub Pages** for this repo and link the rendered
  [`docs/PRIVACY.md`](./PRIVACY.md), **or**
- Use the file's public GitHub URL directly, **or**
- Host `PRIVACY.md`'s contents on any public page you control.

Paste that URL into the listing's **Privacy** tab.

## 4. Create / update the listing

In the dashboard: **New item** (first release) or open the existing item →
**Package** → upload the new zip.

Fill in the **Store listing** tab:

- **Name, summary, description** — the manifest `description` is a good seed.
- **Icon** — 128×128 (`public/icons/icon-128.png`).
- **Screenshots** — at least one **1280×800** (or 640×400). Show the side panel
  running a council debate.
- **Category** — Productivity. **Language** — set primary language.

## 5. Privacy tab (the part reviewers scrutinize)

This extension automates other sites, so justify everything clearly:

- **Single purpose** — orchestrating a 3-stage council debate across ChatGPT,
  Claude, and Gemini.
- **Permission justifications** — one per requested permission. Use the "why"
  column in [`PRIVACY.md`](./PRIVACY.md) and lean on the selling point: *no API
  keys, no background network calls to providers, all processing is local and
  DOM-only.* See ADR-0002, ADR-0003, ADR-0008.
- **Data usage** — declare that no user data is collected or transmitted (the
  `connect-src 'self'` CSP backs this up). Check the "does not sell/transfer"
  and "not used for unrelated purposes" certifications.
- **Privacy policy URL** — from step 3.

## 6. Submit

- Choose **visibility**: Public, Unlisted, or Private. For a first release,
  **Unlisted** lets you exercise the full store flow without public exposure.
- Submit for review. Reviews range from a few hours to several business days;
  extensions with broad host permissions or that automate other sites can take
  longer or draw follow-up questions.

## Known review-friction points for this extension

1. **Automating third-party sites.** Be explicit that the extension acts only on
   the user's behalf, in their own logged-in tabs — no background automation, no
   scraping-for-resale.
2. **Provider Terms of Service.** Distributing a tool that automates
   ChatGPT/Claude/Gemini may conflict with *those providers'* terms, independent
   of Chrome's approval. Review before going **Public**.
3. **Privacy policy is a hard blocker** — you cannot submit without the URL
   (step 3) given the host permissions.

## Updating a published extension

Repeat steps 0–1 (bump version, rebuild, repackage), upload the new zip to the
existing item, and resubmit. Each update goes through review again.
