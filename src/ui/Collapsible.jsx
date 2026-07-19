import { useEffect, useState } from 'react'

// A collapsible section with a clickable header. `defaultOpen` controls the
// initial state; `right` renders extra controls/badges on the header row.
// `syncOpen` = { open: boolean, seq: number }: whenever `seq` changes, the
// section is forced to `open` — this drives parent-level "Expand/Collapse all".
export default function Collapsible({
  title,
  right = null,
  defaultOpen = true,
  syncOpen = null,
  headerClass = '',
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (syncOpen && typeof syncOpen.open === 'boolean') setOpen(syncOpen.open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncOpen?.seq])

  return (
    <section>
      <div
        className={`flex cursor-pointer items-center justify-between select-none ${headerClass}`}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-1.5">
          <Chevron open={open} />
          {title}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {right}
        </div>
      </div>
      {open && <div className="mt-2">{children}</div>}
    </section>
  )
}

function Chevron({ open }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
