# Publishing to the Chrome Web Store

How to cut a release of **LLM Council** and get it onto (or updated on) the
Chrome Web Store. For local dev/build details see [`BUILD.md`](./BUILD.md).

## 0. Pre-flight

- [ ] Bump `version` in `package.json` (the manifest reads it — see
      `manifest.config.js`). Follow semver; the store rejects re-uploads that
      don't increase the version.
- [ ] `npm test` is green.
- [ ] You've smoke-tested the built `dist/` via **Load unpacked** in
      `chrome://extensions`.
- [ ] A public **privacy policy URL** is live (see step 3) — the store will not
      let you submit without one, because we request host permissions.

## 1. Build the upload package

```bash
npm install
npm run package
```

This builds `dist/` and produces `llm-council-v<version>.zip` at the repo root,
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
