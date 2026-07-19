import { describe, it, expect } from 'vitest'
import { responseLabel, MEMBER_IDS, COUNCIL_MEMBERS } from './constants.js'

// Smoke test: confirms the Vitest harness resolves ESM under jsdom and the
// pure helpers behave. Real behavior-first suites live alongside each module.
describe('responseLabel', () => {
  it('maps index 0 to "A"', () => {
    expect(responseLabel(0)).toBe('A')
  })

  it('maps index 2 to "C"', () => {
    expect(responseLabel(2)).toBe('C')
  })
})

describe('MEMBER_IDS', () => {
  it('lists exactly the keys of COUNCIL_MEMBERS', () => {
    expect(MEMBER_IDS).toEqual(Object.keys(COUNCIL_MEMBERS))
  })
})
