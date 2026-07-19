// Per-stage visual identity: a distinct accent color, a subtle tinted panel
// background, and a matching border so Stage 1 / 2 / 3 read as clearly different
// zones. Kept separate from member colors (which mark who said what). The colors
// are CSS variables (defined in index.css) so they can darken in light mode for
// contrast — sky/rose/emerald on dark, deeper shades on light. See ADR-0005.
export const STAGE_THEME = {
  1: {
    label: 'Stage 1',
    short: 'First Opinions',
    accent: 'var(--stage1)',
    tint: 'var(--stage1-tint)',
    border: 'var(--stage1-border)',
  },
  2: {
    label: 'Stage 2',
    short: 'Peer Review',
    accent: 'var(--stage2)',
    tint: 'var(--stage2-tint)',
    border: 'var(--stage2-border)',
  },
  3: {
    label: 'Stage 3',
    short: 'Synthesis',
    accent: 'var(--stage3)',
    tint: 'var(--stage3-tint)',
    border: 'var(--stage3-border)',
  },
}
