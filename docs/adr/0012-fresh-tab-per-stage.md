# ADR-0012: Fresh tab per stage to defeat self-preference bias

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

The orchestrator originally opened one tab per council member in `openMemberTabs`
and **reused that same tab for all three stages** (First Opinions → Peer Review →
Synthesis). Because each stage's prompt was submitted into the *same conversation
thread*, by Stage 2 a model's own Stage-1 answer was still scrolled up in its own
chat. The Stage-2 review is anonymized ("Response A/B/C"), but anonymization is
defeated when the model can see, in its own thread, which answer it wrote.

In practice this produced **self-preference bias**: models recognized and
consistently up-ranked their own answer in the peer review. The Stage-3 chairman
had the same problem — it synthesized in a tab that already held its own Stage-1
and Stage-2 turns, colouring the "neutral" verdict.

## Decision

We will run **each stage in a brand-new tab (a fresh conversation)**. A helper,
`reopenTabsFor(memberIds)`, opens a fresh tab per member and then closes the
previous stage's tabs. It is called at two boundaries in `startRun`:

- **Before Stage 2** — fresh tabs for every member that answered Stage 1, so no
  model carries the memory of its own first opinion into the peer review.
- **Before Stage 3** — all council tabs are closed and a single fresh tab is
  opened for the chairman, so the synthesis is judged only on the anonymized
  materials embedded in the prompt.

Fresh tabs are opened **before** the old ones are closed, so a dedicated council
window is never momentarily emptied (which would close the window itself).

## Consequences

- The anonymized peer review is genuinely anonymized: a reviewer has no thread
  context revealing which response is its own.
- Stage 1 is unchanged — it already ran in the freshly-opened tabs.
- **Slower runs.** Each reopen costs a page load plus the ~1.5 s composer-hydration
  wait (`waitForComposer`): N reopens before Stage 2, one before Stage 3.
- **Intermediate tabs don't linger.** By Stage 3 only the chairman's tab is open;
  earlier per-model tabs are already closed. The scraped answers remain in the
  side-panel UI and history, so nothing is lost, but you can no longer scroll a
  finished model's own tab after the run.
- **Residual limitation.** A fresh tab removes *conversation-thread* memory only.
  Provider account-level features (e.g. ChatGPT's cross-chat Memory) can still
  carry some signal between conversations; that is not reachable via the DOM and
  is out of scope.
- `openMemberTab` / `waitForComposer` are shared by the initial open and the
  reopen, so tab-creation and hydration-wait behaviour stays in one place.

## Alternatives considered

- **Rely on anonymized labels alone (status quo).** Rejected — this is exactly
  what leaked; labels don't help when the thread reveals authorship.
- **Start a new chat inside the existing tab** (navigate to the new-chat URL or
  click the provider's "new chat" control). Functionally similar to a reopen but
  more brittle: it depends on per-provider "new chat" selectors and in-place SPA
  navigation. Closing and reopening the tab is provider-agnostic and reuses the
  existing, already-tested open path.
- **Strip the model's own answer from the review prompt per member.** Rejected —
  it doesn't remove the thread context the model can still see, and it would make
  each reviewer see a different (asymmetric) candidate set.
