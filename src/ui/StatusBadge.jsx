import { STATUS } from '../shared/constants.js'

const MAP = {
  [STATUS.IDLE]: { label: 'idle', cls: 'bg-council-panel2 text-council-muted' },
  [STATUS.PENDING]: { label: 'pending', cls: 'bg-council-panel2 text-council-muted' },
  [STATUS.RUNNING]: {
    label: 'running',
    cls: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 animate-pulse',
  },
  [STATUS.DONE]: {
    label: 'done',
    cls: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  },
  [STATUS.ERROR]: {
    label: 'error',
    cls: 'bg-red-500/20 text-red-700 dark:text-red-300',
  },
  [STATUS.TIMEOUT]: {
    label: 'timeout',
    cls: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  },
  [STATUS.CANCELLED]: {
    label: 'cancelled',
    cls: 'bg-council-panel2 text-council-muted',
  },
}

export default function StatusBadge({ status }) {
  const s = MAP[status] || MAP[STATUS.IDLE]
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.cls}`}
    >
      {s.label}
    </span>
  )
}
