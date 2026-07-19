import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Model output is untrusted: only allow http(s)/mailto absolute links and
// relative/anchor links. Anything with another scheme (javascript:, data:, …)
// is dropped. Belt-and-suspenders on top of react-markdown's default sanitizer.
function safeUrlTransform(url) {
  const u = String(url).trim()
  if (/^(https?:|mailto:)/i.test(u)) return url
  if (/^(#|\/|\.)/.test(u)) return url // anchor / relative
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) return url // no scheme ⇒ relative
  return ''
}

// Renders a council response's Markdown the way the source sites do: styled
// headings/lists/tables, and — importantly — fenced code blocks and ASCII
// diagrams in a scrollable monospace box instead of flattened plain text.
//
// `prose prose-invert` (Tailwind typography) supplies the base styling; the
// component overrides below tighten it for the narrow side panel and give code
// a distinct, horizontally-scrollable surface.
export default function Markdown({ children, className = '' }) {
  return (
    <div
      className={
        'prose dark:prose-invert prose-sm max-w-none ' +
        'prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1.5 ' +
        'prose-pre:my-2 prose-pre:p-0 prose-pre:bg-transparent ' +
        'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 ' +
        'prose-table:my-2 prose-hr:my-3 prose-blockquote:my-2 ' +
        'prose-headings:text-council-strong prose-strong:text-council-strong ' +
        'prose-p:text-council-text prose-li:text-council-text ' +
        'prose-a:text-council-accent break-words ' +
        className
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrlTransform}
        components={{
          // react-markdown v9 dropped the `inline` prop, so infer it: block code
          // has a language class or spans multiple lines; everything else is an
          // inline pill.
          code({ node, className: cls, children, ...props }) {
            const content = String(children ?? '')
            const isBlock = /language-/.test(cls || '') || content.includes('\n')
            if (!isBlock) {
              return (
                <code
                  className="rounded bg-council-panel2 px-1 py-0.5 text-[12px] text-amber-700 dark:text-amber-200"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code className={`${cls || ''} text-[12px]`} {...props}>
                {children}
              </code>
            )
          },
          pre({ children }) {
            return (
              <pre className="overflow-x-auto rounded-lg border border-council-border bg-council-code p-3 text-[12px] leading-relaxed text-council-text">
                {children}
              </pre>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">{children}</table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="border border-council-border bg-council-panel2 px-2 py-1 text-left">
                {children}
              </th>
            )
          },
          td({ children }) {
            return <td className="border border-council-border px-2 py-1">{children}</td>
          },
          a({ children, href }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          },
        }}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}
