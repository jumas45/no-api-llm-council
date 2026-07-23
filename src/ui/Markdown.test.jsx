import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Markdown from './Markdown.jsx'

// Integration guard for the normalizeCodeFences wiring: a model that centers an
// ASCII diagram indents its opening ``` fence, which (unrepaired) makes remark
// treat the closing ``` as a new unterminated fence that swallows everything
// after it as raw text. After repair, content past the diagram parses normally.
describe('Markdown — over-indented code fence', () => {
  const malformed =
    'Intro line.\n\n' +
    '                  ```\n' +
    '   ┌── Target ──┐\n' +
    '```\n\n' +
    '## After The Diagram\n\n' +
    'Body paragraph.\n'

  it('renders a heading after the diagram instead of raw markdown', () => {
    render(<Markdown>{malformed}</Markdown>)
    // The `## After The Diagram` line parses as a real heading...
    expect(
      screen.getByRole('heading', { name: /After The Diagram/ }),
    ).toBeInTheDocument()
    // ...and is NOT rendered literally with its `##` markers.
    expect(screen.queryByText(/## After The Diagram/)).toBeNull()
  })

  it('keeps the diagram in a code block', () => {
    const { container } = render(<Markdown>{malformed}</Markdown>)
    const code = container.querySelector('pre code')
    expect(code).not.toBeNull()
    expect(code.textContent).toContain('┌── Target ──┐')
  })
})
