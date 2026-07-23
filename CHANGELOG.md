# Changelog

All notable user-visible changes to this extension are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The version here tracks `package.json`, which in turn drives the manifest
version. After updating, reload the extension on its card in
`chrome://extensions`.

## [Unreleased]

## [1.0.1]

### Added
- Each council stage now runs in a **fresh tab**, so a model can't recognize
  its own earlier answer in the Peer Review stage — reducing self-preference
  bias.

### Fixed
- Repaired over-indented code fences in scraped Markdown so fenced code blocks
  render correctly.
- Dropped the unused `tabs` permission that was rejected by the Chrome Web
  Store.

## [1.0.0]

Initial release.

### Added
- Runs Karpathy's 3-stage council debate (First Opinions → anonymized Peer
  Review → Chairman's Synthesis) across ChatGPT, Claude, and Gemini by driving
  their web UIs — no API keys, no background network calls to providers.
- **"Expand all"** control that drops the per-response inner scrollers so full
  answers are visible at once.
- Privacy policy and Chrome Web Store listing.

### Changed
- Rebranded the extension to **"No API LLM Council."**

### Fixed
- Dropped the unused `scripting` permission and pinned the permission set to the
  jailed model domains.
