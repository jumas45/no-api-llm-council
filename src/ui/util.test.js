import { describe, it, expect } from 'vitest'
import { formatDuration, runHadIssues } from './util.js'
import { STATUS } from '../shared/constants.js'

// Template: testing a pure helper module. No DOM, no mocks — just inputs →
// outputs, one behavior per test.

describe('formatDuration', () => {
  it('renders sub-second values in milliseconds', () => {
    expect(formatDuration(850)).toBe('850ms')
  })

  it('renders seconds with one decimal below a minute', () => {
    expect(formatDuration(1500)).toBe('1.5s')
  })

  it('renders minutes and seconds above a minute', () => {
    expect(formatDuration(74000)).toBe('1m 14s')
  })

  it('returns an empty string for null', () => {
    expect(formatDuration(null)).toBe('')
  })
})

describe('runHadIssues', () => {
  it('is false for a clean, fully-done run', () => {
    const run = {
      status: STATUS.DONE,
      stage1: { a: { status: STATUS.DONE } },
      stage2: { a: { status: STATUS.DONE } },
      stage3: { status: STATUS.DONE },
    }
    expect(runHadIssues(run)).toBe(false)
  })

  it('is true when any stage-1 member errored', () => {
    const run = {
      status: STATUS.DONE,
      stage1: { a: { status: STATUS.ERROR } },
      stage2: { a: { status: STATUS.DONE } },
      stage3: { status: STATUS.DONE },
    }
    expect(runHadIssues(run)).toBe(true)
  })

  it('is true when the run itself was cancelled', () => {
    const run = { status: STATUS.CANCELLED, stage1: {}, stage2: {}, stage3: {} }
    expect(runHadIssues(run)).toBe(true)
  })
})
