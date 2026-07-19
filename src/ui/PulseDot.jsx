// Pulsating "generating" indicator — a filled dot with an expanding ping ring.
export default function PulseDot({ color = '#6ea8fe', size = 10 }) {
  const s = `${size}px`
  return (
    <span className="relative inline-flex" style={{ width: s, height: s }}>
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
        style={{ background: color }}
      />
      <span
        className="relative inline-flex rounded-full"
        style={{ width: s, height: s, background: color }}
      />
    </span>
  )
}
