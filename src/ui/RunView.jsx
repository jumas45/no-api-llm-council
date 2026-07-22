import { useState } from 'react'
import { COUNCIL_MEMBERS, STATUS } from '../shared/constants.js'
import StatusBadge from './StatusBadge.jsx'
import PulseDot from './PulseDot.jsx'
import ResponseCard from './ResponseCard.jsx'
import Collapsible from './Collapsible.jsx'
import Stepper from './Stepper.jsx'
import Markdown from './Markdown.jsx'
import DurationChip from './DurationChip.jsx'
import { STAGE_THEME } from './stageTheme.js'
import {
  formatTranscript,
  formatMarkdown,
  formatDuration,
  totalDuration,
  copyText,
  emailResults,
  downloadText,
  exportFilename,
} from './util.js'

// Renders one council run (live or historical): a progress stepper, the Chairman
// synthesis, and the two debate stages as color-coded collapsible sections.
export default function RunView({ run, live = false, collapsedDefault = false }) {
  const [sync, setSync] = useState(null)
  // Tracks the last bulk action so the single button can toggle between
  // expand-all and collapse-all. Seeded from the section defaults.
  const [allOpen, setAllOpen] = useState(!collapsedDefault)
  if (!run) return null
  const subject = `LLM Council: ${run.query}`.slice(0, 120)
  const done = run.status === STATUS.DONE || run.status === STATUS.CANCELLED
  const currentStage = live ? run.stage : 0
  const total = totalDuration(run)

  const toggleAll = () => {
    const next = !allOpen
    setAllOpen(next)
    setSync({ open: next, seq: Date.now() })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TopActions run={run} subject={subject} />
        <div className="flex items-center gap-2">
          {total != null && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-council-panel2 px-2 py-1 font-mono text-[11px] text-council-text"
              title="Total time across all stages"
            >
              <StopwatchIcon />
              {formatDuration(total)} total
            </span>
          )}
          <button type="button" onClick={toggleAll} className={toolBtn}>
            {allOpen ? <CollapseIcon /> : <ExpandIcon />}
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-council-border bg-council-panel px-2 py-3">
        <Stepper stage={currentStage} done={done && run.status === STATUS.DONE} />
      </div>

      <SynthesisBlock
        run={run}
        subject={subject}
        syncOpen={sync}
        defaultOpen={!collapsedDefault}
        durationMs={run.timings?.stage3}
      />

      <StageSection
        key={`s1-${currentStage === 1}`}
        stageNum={1}
        bucket={run.stage1}
        members={run.members}
        active={currentStage === 1}
        defaultOpen={currentStage === 1}
        subject={subject}
        syncOpen={sync}
        durationMs={run.timings?.stage1}
        expandAll={allOpen}
      />

      <StageSection
        key={`s2-${currentStage === 2}`}
        stageNum={2}
        bucket={run.stage2}
        members={run.members}
        active={currentStage === 2}
        defaultOpen={currentStage === 2}
        subject={subject}
        syncOpen={sync}
        durationMs={run.timings?.stage2}
        ranking={run.ranking}
        expandAll={allOpen}
      />
    </div>
  )
}

const toolBtn =
  'inline-flex items-center gap-1 rounded-md border border-council-border bg-council-panel2 px-2.5 py-1 text-[11px] font-medium text-council-text transition hover:border-council-accent hover:text-council-strong'

// Two downward chevrons — "unfold everything".
function ExpandIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M7 5l5 5 5-5M7 13l5 5 5-5" />
    </svg>
  )
}

// Small stopwatch — matches the per-stage DurationChip glyph.
function StopwatchIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-council-muted">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M9 2h6" />
    </svg>
  )
}

// Two chevrons meeting — "fold everything".
function CollapseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M7 9l5-5 5 5M7 20l5-5 5 5" />
    </svg>
  )
}

function TopActions({ run, subject }) {
  const [copied, setCopied] = useState(false)
  async function copyMd() {
    if (await copyText(formatMarkdown(run))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }
  const btn =
    'rounded-md border border-council-border bg-council-panel2 px-2.5 py-1 text-[11px] font-medium text-council-text transition hover:border-council-accent hover:text-council-strong'
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copyMd} className={btn}>
        {copied ? '✓ Copied' : 'Copy .md'}
      </button>
      <button
        type="button"
        onClick={() => downloadText(exportFilename(run), formatMarkdown(run))}
        className={btn}
      >
        ⬇ Export .md
      </button>
      <button
        type="button"
        onClick={() => emailResults(subject, formatTranscript(run))}
        className={btn}
      >
        ✉ Email
      </button>
    </div>
  )
}

function stageIsRunning(bucket, members) {
  return members.some((id) => bucket?.[id]?.status === STATUS.RUNNING)
}

function StageSection({
  stageNum,
  bucket,
  members,
  active,
  defaultOpen,
  subject,
  syncOpen,
  durationMs,
  ranking,
  expandAll,
}) {
  const theme = STAGE_THEME[stageNum]
  const running = stageIsRunning(bucket, members)
  const title = (
    <span className="flex items-center gap-2">
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-council-onaccent"
        style={{ background: theme.accent }}
      >
        {stageNum}
      </span>
      <span
        className="text-xs font-bold uppercase tracking-wide"
        style={{ color: theme.accent }}
      >
        {theme.short}
      </span>
    </span>
  )
  return (
    <div
      className="rounded-xl border p-3"
      style={{ background: theme.tint, borderColor: theme.border }}
    >
      <Collapsible
        title={title}
        defaultOpen={defaultOpen}
        syncOpen={syncOpen}
        right={
          running ? (
            <PulseDot size={9} color={theme.accent} />
          ) : (
            <DurationChip ms={durationMs} />
          )
        }
      >
        <div className="space-y-2">
          {stageNum === 2 && <RankingBoard ranking={ranking} accent={theme.accent} />}
          {members.map((id) => (
            <ResponseCard
              key={id}
              memberId={id}
              result={bucket?.[id]}
              subject={subject}
              accent={theme.accent}
              syncOpen={syncOpen}
              expandAll={expandAll}
            />
          ))}
        </div>
      </Collapsible>
    </div>
  )
}

// Aggregate leaderboard from the parsed Stage 2 peer rankings (Borda points).
function RankingBoard({ ranking, accent }) {
  if (!ranking?.ballots) return null
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="rounded-lg border border-council-border bg-council-panel2 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
        Aggregate Ranking · {ranking.ballots} ballot{ranking.ballots === 1 ? '' : 's'}
      </p>
      <p className="mb-1.5 text-[9px] italic leading-snug text-council-muted">
        Self-reported peer ranking by the models — not an objective score.
      </p>
      <ol className="space-y-1">
        {ranking.board.map((row, i) => {
          const member = COUNCIL_MEMBERS[row.id]
          return (
            <li key={row.id} className="flex items-center gap-2 text-xs text-council-strong">
              <span className="w-5 shrink-0 text-center">{medals[i] || `${i + 1}.`}</span>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: member?.color }}
              />
              <span className="font-medium">{member?.label || row.id}</span>
              <span className="text-council-muted">Response {row.label}</span>
              <span className="ml-auto shrink-0 font-mono text-council-text">
                {row.points} pt{row.points === 1 ? '' : 's'}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function SynthesisBlock({ run, subject, syncOpen, defaultOpen = true, durationMs }) {
  const theme = STAGE_THEME[3]
  const s = run.stage3 || {}
  const running = s.status === STATUS.RUNNING
  const chairmanLabel = COUNCIL_MEMBERS[s.chairman || run.chairman]?.label

  const title = (
    <span className="flex items-center gap-2">
      {running ? (
        <PulseDot size={10} color={theme.accent} />
      ) : (
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-council-onaccent"
          style={{ background: theme.accent }}
        >
          3
        </span>
      )}
      <span className="text-sm font-bold" style={{ color: theme.accent }}>
        Chairman Synthesis
      </span>
    </span>
  )

  return (
    <div
      className="rounded-xl border p-3"
      style={{ background: theme.tint, borderColor: theme.border }}
    >
      <Collapsible
        title={title}
        defaultOpen={defaultOpen}
        syncOpen={syncOpen}
        right={
          <>
            {s.text && <SmallCopy text={s.text} />}
            {!running && <DurationChip ms={durationMs ?? s.ms} />}
            <StatusBadge status={s.status} />
          </>
        }
      >
        {chairmanLabel && (
          <p className="mb-2 text-[11px] text-council-text">
            Chairman: <span className="font-medium text-council-strong">{chairmanLabel}</span>
          </p>
        )}
        {s.error ? (
          <p className="whitespace-pre-wrap text-xs text-red-600 dark:text-red-300">{s.error}</p>
        ) : s.text ? (
          <div className="text-council-strong">
            <Markdown>{s.text}</Markdown>
            <p className="mt-2 border-t border-council-border pt-2 text-[10px] italic leading-snug text-council-muted">
              Synthesized from unverified model outputs. It may be wrong or
              incomplete — verify important claims independently.
            </p>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs italic text-council-muted">
            {running && <PulseDot size={8} color={theme.accent} />}
            {running
              ? 'Chairman is synthesizing the final answer…'
              : 'Awaiting synthesis…'}
          </p>
        )}
      </Collapsible>
    </div>
  )
}

function SmallCopy({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
      className="rounded border border-council-border px-2 py-0.5 text-[10px] text-council-text transition hover:text-council-strong"
    >
      {copied ? '✓' : 'Copy'}
    </button>
  )
}
