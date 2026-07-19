// @vitest-environment node
// Node env (not jsdom): importing manifest.config.js pulls in @crxjs/vite-plugin
// → esbuild, whose startup invariant fails under jsdom's TextEncoder.
import { describe, it, expect } from 'vitest'
import manifest from '../manifest.config.js'
import { COUNCIL_MEMBERS } from '../src/shared/constants.js'

// Guardrail enforced as a test (ADR-0003 / PRD §2 Security Constraint 1): the
// extension's reach must stay jailed to the three model domains. A widened
// host_permission is both a security regression and a likely Chrome Web Store
// rejection, so we fail the build if the jail ever leaks.

const ALLOWED_DOMAINS = ['chatgpt.com', 'claude.ai', 'gemini.google.com']

describe('manifest host-permission jail', () => {
  it('grants exactly the three model domains, nothing wider', () => {
    expect([...manifest.host_permissions].sort()).toEqual(
      ['*://chatgpt.com/*', '*://claude.ai/*', '*://gemini.google.com/*'].sort(),
    )
  })

  it('never contains an all-URLs / wildcard-host grant', () => {
    const forbidden = /<all_urls>|:\/\/\*\/\*|\*:\/\/\*/
    for (const pattern of [...manifest.host_permissions, ...contentScriptMatches()]) {
      expect(pattern).not.toMatch(forbidden)
    }
  })

  it('injects content scripts only into the granted hosts', () => {
    expect([...contentScriptMatches()].sort()).toEqual([...manifest.host_permissions].sort())
  })

  it('keeps every council member covered by a host grant', () => {
    // A member without a matching host grant would silently fail tab injection
    // (see CLAUDE.md "Keep members in sync").
    for (const { url } of Object.values(COUNCIL_MEMBERS)) {
      const host = new URL(url).hostname
      const covered = ALLOWED_DOMAINS.some((d) => host === d || host.endsWith('.' + d))
      expect(covered, `no host grant covers ${host}`).toBe(true)
    }
  })
})

function contentScriptMatches() {
  return manifest.content_scripts.flatMap((cs) => cs.matches)
}
