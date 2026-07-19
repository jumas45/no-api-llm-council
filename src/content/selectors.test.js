import { describe, it, expect } from 'vitest'
import { selectorsForHost, SELECTORS } from './selectors.js'

// Host resolution decides which provider's DOM a content script drives. Getting
// this wrong means typing into the wrong site, so it's worth pinning down.

describe('selectorsForHost', () => {
  it('resolves an exact provider host', () => {
    const res = selectorsForHost('chatgpt.com')
    expect(res.key).toBe('chatgpt.com')
    expect(res.input).toEqual(SELECTORS['chatgpt.com'].input)
  })

  it('resolves a subdomain of a provider host', () => {
    expect(selectorsForHost('www.claude.ai').key).toBe('claude.ai')
    expect(selectorsForHost('app.gemini.google.com').key).toBe('gemini.google.com')
  })

  it('returns null for an unrelated host', () => {
    expect(selectorsForHost('example.com')).toBeNull()
  })

  it('does not match a look-alike suffix host', () => {
    // "notclaude.ai" ends with "claude.ai" only as a raw string, not as a
    // dot-delimited subdomain — must not resolve.
    expect(selectorsForHost('notclaude.ai')).toBeNull()
  })
})
