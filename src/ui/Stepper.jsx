import { STAGE_THEME } from './stageTheme.js'

// Breadcrumb-style progress indicator: (1)──(2)──(3), coloring each step by its
// stage accent when done/active and greying out pending ones. The active step
// pulses.
export default function Stepper({ stage = 0, done = false }) {
  const steps = [1, 2, 3]
  return (
    <div className="flex items-center px-1">
      {steps.map((n, i) => {
        const theme = STAGE_THEME[n]
        const status = done || stage > n ? 'done' : stage === n ? 'active' : 'pending'
        return (
          <div key={n} className="flex flex-1 items-center last:flex-none">
            <Step n={n} theme={theme} status={status} />
            {i < steps.length - 1 && (
              <Connector filled={done || stage > n} color={theme.accent} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Step({ n, theme, status }) {
  const base =
    'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition'
  let ring = {}
  let cls = ''
  if (status === 'done') {
    cls = 'text-council-onaccent'
    ring = { background: theme.accent }
  } else if (status === 'active') {
    cls = 'animate-pulse'
    ring = {
      color: theme.accent,
      border: `2px solid ${theme.accent}`,
      boxShadow: `0 0 8px ${theme.accent}`,
    }
  } else {
    cls = 'text-council-faint'
    ring = { border: '2px solid var(--c-line)' }
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`${base} ${cls}`} style={ring}>
        {status === 'done' ? '✓' : n}
      </div>
      <span
        className="text-[9px] font-medium leading-none"
        style={{ color: status === 'pending' ? 'var(--c-faint)' : theme.accent }}
      >
        {theme.short}
      </span>
    </div>
  )
}

function Connector({ filled, color }) {
  return (
    <div className="mx-1 h-0.5 flex-1 rounded" style={{ background: filled ? color : 'var(--c-line)' }} />
  )
}
