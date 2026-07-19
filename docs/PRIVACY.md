# Privacy Policy — LLM Council

**Last updated:** 2026-07-19

LLM Council is a Chrome extension (Manifest V3) that orchestrates a 3-stage
council debate across ChatGPT, Claude, and Gemini by driving their existing web
interfaces in your browser. This policy explains exactly what the extension does
and does not do with your data.

## Summary

- **No accounts, no API keys, no sign-up.** The extension uses the logins you
  already have in your browser.
- **No data collection.** We do not collect, transmit, sell, or share any of
  your data. There is no analytics, telemetry, tracking, or advertising.
- **No servers.** The extension makes no background network calls to the
  developer or to any third party. All processing happens locally in your
  browser.

## What the extension accesses, and why

### Your prompts and the models' responses

When you start a council run, the extension:

1. Types your prompt into the editor of each provider's web page
   (ChatGPT, Claude, Gemini) in a browser tab, and submits it — the same action
   you would perform by hand.
2. Reads each model's streamed answer back from that page's on-screen content
   (the DOM).
3. Uses those answers locally to drive the next debate stage and to render the
   result in the extension's side panel.

Your prompt text and the models' responses are **processed only on your device**
and are **only ever sent to the provider whose page you are already using**. The
extension does not send this content to the developer or to any other server. It
is not persisted beyond what is needed to display the current run, and it is not
retained after you clear or close the panel.

Note that ChatGPT, Claude, and Gemini each have their **own** privacy policies
and terms governing what they do with prompts you submit through their sites.
This extension does not change that relationship — it interacts with those sites
as you, using your existing session. Please review each provider's own policy.

### Settings and prompt templates

The extension stores your preferences (such as toggles and any prompt templates
you customize) using Chrome's local extension storage (`chrome.storage`). This
data stays on your device (and syncs only through your own Chrome profile if you
have Chrome Sync enabled). It is never transmitted to the developer.

## Permissions and how they are used

| Permission | Why it is needed |
| --- | --- |
| `tabs` | Locate and coordinate the provider tabs used in a run. |
| `scripting` / content scripts | Inject the prompt into, and read the answer from, the provider pages. |
| `storage` | Save your settings and custom prompt templates locally. |
| `sidePanel` | Render the council UI in Chrome's side panel. |
| `alarms` | Drive orchestration timers (e.g. per-tab timeouts). |
| Host access to `chatgpt.com`, `claude.ai`, `gemini.google.com` | The **only** sites the extension may read from or act on. It cannot access any other website. |

The extension's host access is deliberately restricted ("jailed") to those three
model domains. It requests no access to any other site, and its content security
policy blocks it from making network requests to any external host.

## Data we do **not** collect

- No personal information.
- No browsing history.
- No analytics or usage statistics.
- No location, contacts, or financial data.
- Nothing is sold or shared with third parties, because nothing is collected.

## Children's privacy

The extension is not directed to children and collects no data from anyone.

## Changes to this policy

If this policy changes, the "Last updated" date above will change and the new
version will be published at the same URL.

## Contact

Questions about this policy can be sent to: **jumas45@gmail.com**
