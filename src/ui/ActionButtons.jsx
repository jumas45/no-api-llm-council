import { useState } from 'react'
import { copyText, emailResults } from './util.js'

// Small Copy / Email button pair. `text` is copied; email uses `subject`+`text`.
export default function ActionButtons({ text, subject = 'LLM Council', compact = false }) {
  const [copied, setCopied] = useState(false)
  if (!text) return null

  async function handleCopy() {
    const ok = await copyText(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const base =
    'rounded border border-council-border text-council-text transition hover:bg-council-panel2 hover:text-council-strong'
  const pad = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={handleCopy} className={`${base} ${pad}`}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={() => emailResults(subject, text)}
        className={`${base} ${pad}`}
      >
        Email
      </button>
    </div>
  )
}
