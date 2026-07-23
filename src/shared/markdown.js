// Shared Markdown repair used by both the DOM scrape (content script) and the
// side-panel renderer.

// Models sometimes center ASCII art and indent the opening ``` fence along with
// it. CommonMark only allows a fence opener indented up to 3 spaces; at 4+ it
// becomes an indented code block instead, so the diagram's body leaks out as
// prose and the *closing* ``` is reparsed as a new, unterminated fence that
// swallows the rest of the document. De-indenting bare fence markers (```/~~~,
// with an optional info string) back to column 0 restores a balanced, parseable
// pair. Provider-agnostic.
export function normalizeCodeFences(md) {
  if (!md) return md
  return md.replace(/^[ \t]{4,}(`{3,}[^`\r\n]*|~{3,}[^\r\n]*)\r?$/gm, '$1')
}
