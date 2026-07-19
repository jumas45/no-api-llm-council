# ADR-0005: Light/dark theming via CSS variables

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The side panel shipped dark-only, with colors hardcoded across ~13 components as
custom `council-*` Tailwind colors plus raw `slate-*` / `white` / `black`
utilities and a few inline hex values. Users asked for a light mode. Rewriting
every component to carry paired `light`/`dark:` classes would be large and
error-prone, and would have to be repeated for every future component.

## Decision

Drive the palette from **CSS custom properties** and let Tailwind colors point at
them, so components re-theme with (mostly) no per-class changes:

- `index.css` defines semantic tokens (`--c-bg`, `--c-panel`, `--c-panel2`,
  `--c-border`, `--c-accent`, text tiers `--c-text`/`--c-muted`/`--c-faint`/
  `--c-strong`, plus `--c-line`, `--c-code`, and per-stage `--stageN*`). The dark
  palette is the default (also under `:root[data-theme='dark']`);
  `:root[data-theme='light']` overrides them.
- `tailwind.config.js` maps `council-*` colors to `var(--c-*)`, adds a static
  `council-onaccent` (fixed dark ink for text on bright accent circles, which
  must not flip), and sets `darkMode: ['selector', '[data-theme="dark"]']`.
- The raw `text-slate-*` tiers were mechanically remapped to `text-council-*`
  tokens. Status colors (red/amber/emerald/blue) that sit as text keep a bright
  shade for dark and gain a darker `dark:`-gated shade for light-mode contrast.
- `src/ui/theme.js` persists the choice in `localStorage` and applies it as
  `data-theme` on `<html>`; `main.jsx` applies it before first paint to avoid a
  flash. A header sun/moon button toggles it. Default is dark.

## Consequences

- New components theme automatically as long as they use `council-*` tokens
  instead of raw `slate`/`white`; that is now the house rule.
- Text on a **bright accent** (stage number badges, stepper "done" step) must use
  `text-council-onaccent`, not `text-council-bg` — the latter flips and would
  wash out on light. The Convene button intentionally still uses `text-council-bg`
  because its background is the accent and the flip is correct there.
- A handful of status colors carry an explicit `dark:` variant; those are the
  only places that still encode both themes by hand.
- `darkMode` is attribute-driven, so the app must always stamp an explicit
  `data-theme` (it does, in `main.jsx`). Relying on `prefers-color-scheme` was
  rejected to keep the toggle authoritative.

## Alternatives considered

- **Per-class `light`/`dark:` pairs everywhere.** Rejected: large diff, ongoing
  tax on every new component, easy to forget one side.
- **Two prebuilt stylesheets swapped at runtime.** Rejected: heavier, and
  duplicates the design system.
