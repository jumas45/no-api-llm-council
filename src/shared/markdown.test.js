import { describe, it, expect } from 'vitest'
import { normalizeCodeFences } from './markdown.js'

describe('normalizeCodeFences', () => {
  it('de-indents an over-indented (4+ space) opening fence to column 0', () => {
    // A model that centers its ASCII art indents the opening ``` too; CommonMark
    // then reads it as an indented code block, the diagram leaks out as prose,
    // and the closing ``` becomes an unterminated fence that eats the rest.
    const md = 'x\n\n                  ```\n  ┌─┐\n```\n\n## Heading\n'
    const out = normalizeCodeFences(md)
    expect(out).toContain('\n```\n  ┌─┐\n```\n')
    expect(out).not.toMatch(/^[ \t]{4,}```/m)
  })

  it('leaves a column-0 fence and its indented content untouched', () => {
    const md = '```\n    indented art line\n```\n'
    expect(normalizeCodeFences(md)).toBe(md)
  })

  it('leaves a lightly-indented (<=3 space) fence untouched', () => {
    const md = '   ```\ncode\n   ```\n'
    expect(normalizeCodeFences(md)).toBe(md)
  })

  it('yields a balanced pair of column-0 fences from a mismatched scrape', () => {
    const md = 'intro\n\n                  ```\ndiagram\n```\n\n## After\n'
    const fenceLines = normalizeCodeFences(md)
      .split('\n')
      .filter((l) => l === '```')
    expect(fenceLines).toHaveLength(2) // both open and close now at column 0
  })

  it('returns falsy input unchanged', () => {
    expect(normalizeCodeFences('')).toBe('')
  })
})
