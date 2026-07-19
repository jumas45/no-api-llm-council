import { useEffect, useState } from 'react'
import { COUNCIL_MEMBERS } from '../shared/constants.js'
import { getHistory, deleteHistoryItem, clearHistory } from './bus.js'
import { relativeTime, formatDuration, totalDuration, runHadIssues } from './util.js'
import Collapsible from './Collapsible.jsx'
import RunView from './RunView.jsx'
import StatusBadge from './StatusBadge.jsx'

export default function HistoryView({ onReload }) {
  const [history, setHistory] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getHistory().then((h) => {
      setHistory(h)
      setLoaded(true)
    })
  }, [])

  async function handleDelete(runId) {
    setHistory(await deleteHistoryItem(runId))
  }

  async function handleClear() {
    if (confirm('Delete all saved council sessions?')) {
      setHistory(await clearHistory())
    }
  }

  if (loaded && history.length === 0) {
    return (
      <p className="mt-10 text-center text-xs text-council-faint">
        No saved sessions yet. Completed council runs are stored here
        automatically.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-council-muted">
          {history.length} saved session{history.length === 1 ? '' : 's'}
        </span>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="rounded border border-red-500/40 px-2 py-1 text-[11px] text-red-600 transition hover:bg-red-500/10 dark:text-red-300"
          >
            Clear all
          </button>
        )}
      </div>

      {history.map((run) => (
        <HistoryItem
          key={run.runId}
          run={run}
          onDelete={() => handleDelete(run.runId)}
          onReload={() => onReload?.(run)}
        />
      ))}
    </div>
  )
}

function HistoryItem({ run, onDelete, onReload }) {
  const total = totalDuration(run)
  const hadIssues = runHadIssues(run)
  const title = (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-council-strong">{run.query}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-council-text">
        <span className="inline-flex items-center gap-1">
          <ClockIcon />
          {relativeTime(run.finishedAt)}
        </span>
        {total != null && (
          <>
            <span className="text-council-faint">•</span>
            <span className="inline-flex items-center gap-1" title="Total time across all stages">
              <StopwatchIcon />
              {formatDuration(total)}
            </span>
          </>
        )}
        <span className="text-council-faint">•</span>
        <span className="inline-flex flex-wrap items-center gap-1">
          {run.members.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-council-panel2 px-1.5 py-0.5 text-[10px] font-medium text-council-text"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: COUNCIL_MEMBERS[id]?.color }}
              />
              {COUNCIL_MEMBERS[id]?.label || id}
            </span>
          ))}
        </span>
      </p>
    </div>
  )

  return (
    <div className="rounded-xl border border-council-border bg-council-panel p-3">
      <Collapsible
        title={title}
        defaultOpen={false}
        right={
          <>
            {hadIssues && <WarningTriangle />}
            <StatusBadge status={run.status} />
          </>
        }
      >
        <div className="mb-3 flex gap-2">
          <button
            onClick={onReload}
            className="rounded border border-council-border px-2 py-1 text-[11px] text-council-text transition hover:bg-council-panel2 hover:text-council-strong"
          >
            Reuse query
          </button>
          <button
            onClick={onDelete}
            className="rounded border border-red-500/40 px-2 py-1 text-[11px] text-red-600 transition hover:bg-red-500/10 dark:text-red-300"
          >
            Delete
          </button>
        </div>
        <RunView run={run} live={false} collapsedDefault />
      </Collapsible>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-council-muted">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

// Amber warning triangle: shown on a history item when some responses timed out
// or errored, so a "DONE" run with partial results is still flagged.
function WarningTriangle() {
  return (
    <span
      title="Some responses timed out or did not complete successfully"
      className="inline-flex text-amber-500 dark:text-amber-400"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    </span>
  )
}

function StopwatchIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-council-muted">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M9 2h6" />
    </svg>
  )
}
