import { useUiStore } from '../store/uiStore'

/** Recharts renders SVG stroke/fill via inline props, not CSS classes, so
 * grid lines and axis text can't pick up the semantic --border/--text-muted
 * tokens automatically the way DOM elements do — they need their own
 * light/dark constants read at render time. Series colors (status/category
 * fills) are left as-is: they're already saturated enough to stay legible on
 * both a white and a dark card surface, so only the grid/axis need a swap. */
const GRID_COLORS = { light: '#e2e8f0', dark: '#334155' }
const AXIS_COLORS = { light: '#94a3b8', dark: '#64748b' }

export function useChartGridColors() {
  const resolvedTheme = useUiStore((s) => s.resolvedTheme)
  return { grid: GRID_COLORS[resolvedTheme] || GRID_COLORS.light, axis: AXIS_COLORS[resolvedTheme] || AXIS_COLORS.light }
}
