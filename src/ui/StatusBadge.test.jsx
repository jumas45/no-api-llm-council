import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBadge from './StatusBadge.jsx'
import { STATUS } from '../shared/constants.js'

// Template: rendering a React component under jsdom and asserting on what the
// user sees. cleanup() between tests is handled globally in src/test/setup.js.

describe('StatusBadge', () => {
  it('shows the label for a known status', () => {
    render(<StatusBadge status={STATUS.DONE} />)
    expect(screen.getByText('done')).toBeInTheDocument()
  })

  it('applies the running style (pulse) for a running status', () => {
    render(<StatusBadge status={STATUS.RUNNING} />)
    expect(screen.getByText('running')).toHaveClass('animate-pulse')
  })

  it('falls back to the idle label for an unknown status', () => {
    render(<StatusBadge status="bogus" />)
    expect(screen.getByText('idle')).toBeInTheDocument()
  })
})
