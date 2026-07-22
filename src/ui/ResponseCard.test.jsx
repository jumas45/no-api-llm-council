import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ResponseCard from './ResponseCard.jsx'
import { STATUS } from '../shared/constants.js'

const result = { status: STATUS.DONE, text: 'Hello world', ms: 1200 }

// The per-response body normally caps its height and scrolls internally so a
// long answer stays compact while browsing. "Expand all" should override that
// so nothing is trapped behind an inner scroller.
describe('ResponseCard', () => {
  it('caps the body height with an inner scroller by default', () => {
    render(<ResponseCard memberId="chatgpt" result={result} subject="s" />)
    const body = screen.getByText('Hello world').closest('div.overflow-y-auto')
    expect(body).not.toBeNull()
    expect(body).toHaveClass('max-h-[28rem]')
  })

  it('drops the inner scroller when expandAll is set', () => {
    render(<ResponseCard memberId="chatgpt" result={result} subject="s" expandAll />)
    expect(document.querySelector('.overflow-y-auto')).toBeNull()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })
})
