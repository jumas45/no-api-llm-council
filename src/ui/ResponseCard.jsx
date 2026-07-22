import { COUNCIL_MEMBERS, STATUS } from '../shared/constants.js'
import StatusBadge from './StatusBadge.jsx'
import PulseDot from './PulseDot.jsx'
import ActionButtons from './ActionButtons.jsx'
import Collapsible from './Collapsible.jsx'
import Markdown from './Markdown.jsx'
import DurationChip from './DurationChip.jsx'

export default function ResponseCard({ memberId, result, subject, accent, syncOpen, expandAll }) {
  const member = COUNCIL_MEMBERS[memberId]
  const { status, text, error, ms } = result || {}
  const running = status === STATUS.RUNNING

  const title = (
    <span className="flex items-center gap-2">
      {running ? (
        <PulseDot color={member?.color} />
      ) : (
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: member?.color }} />
      )}
      <span className="text-sm font-semibold text-council-strong">
        {member?.label || memberId}
      </span>
    </span>
  )

  const right = (
    <>
      {text && <ActionButtons text={text} subject={subject} compact />}
      <DurationChip ms={ms} />
      <StatusBadge status={status} />
    </>
  )

  return (
    <div
      className="overflow-hidden rounded-lg border border-council-border bg-council-panel2 px-3 py-2"
      style={accent ? { borderLeft: `3px solid ${member?.color || accent}` } : undefined}
    >
      <Collapsible title={title} right={right} defaultOpen syncOpen={syncOpen}>
        <div className="border-t border-council-border pt-2">
          {error ? (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-red-600 dark:text-red-300">
              {error}
            </p>
          ) : text ? (
            <div
              className={
                expandAll
                  ? 'text-council-strong'
                  : 'max-h-[28rem] overflow-y-auto pr-1 text-council-strong'
              }
            >
              <Markdown>{text}</Markdown>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-xs italic text-council-muted">
              {running && <PulseDot color={member?.color} size={8} />}
              {running ? 'Generating…' : 'Waiting…'}
            </p>
          )}
        </div>
      </Collapsible>
    </div>
  )
}
