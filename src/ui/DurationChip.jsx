import { formatDuration } from './util.js'

// Small monospace stopwatch chip showing how long something took.
export default function DurationChip({ ms, className = '' }) {
  if (ms == null) return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded bg-council-panel2 px-1.5 py-0.5 font-mono text-[10px] text-council-text ${className}`}
      title="Time taken"
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-council-muted">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2 2M9 2h6" />
      </svg>
      {formatDuration(ms)}
    </span>
  )
}
