# ADR-005: Recharts with a custom Tooltip content component

**Date:** 2026-07-08 · **Status:** Accepted

## Context

The dashboard needs 3 charts: a seat-status pie, a top-departments bar, and a stacked occupancy-by-floor bar. In dark mode, we discovered the default Recharts `<Tooltip>` renders an inner label row in a hardcoded white block that ignores `contentStyle` (which only controls the outer wrapper). This looked terrible against a dark card.

## Options

1. **Switch to a different chart library.** Visx, Nivo, or Tremor. All good, all a bigger dependency swap.
2. **Wrap the Recharts Tooltip in a CSS-based override.** Force the inner element to match our card token via `.recharts-default-tooltip { background: hsl(var(--card)) !important; }`.
3. **Pass a custom `content` component to Recharts' `<Tooltip>`.** Recharts calls it with `active`, `payload`, and `label` props. We render whatever we want.

## Decision

**Option 3: pass a custom content component.**

## Consequences

**Accepted:**

- A small `ChartTooltip` component in `dashboard/page.tsx`. About 30 lines. Renders a dark-mode-aware card with a colored dot and tabular numerals for the value.
- The tooltip is dashboard-specific for now. If we add charts elsewhere, we'll lift it to `components/ui.tsx`.

**Gained:**

- Full theming — bg, border, text, and font family all resolve from the design tokens. Toggling light/dark instantly updates the tooltip too.
- Cleaner formatting than the default — the value is right-aligned with `tabular-nums` for a professional look.

**Rejected:**

- **Option 1 (swap library)** — a 3-chart dashboard doesn't justify replacing a working dependency. Recharts is standard.
- **Option 2 (CSS override)** — fragile. Recharts controls the internal DOM structure and could change class names in a minor release, silently breaking our override.
