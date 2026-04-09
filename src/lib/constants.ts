// Lansbury Ledger — Shared Constants
// All magic values live here, not scattered through components.

/** Chart colour tokens — reference CSS custom properties */
export const CHART = {
  grid: 'var(--color-border-subtle)',
  axis: 'var(--color-border-subtle)',
  text: 'var(--color-text-tertiary)',
  textSize: 11,
  tooltip: {
    backgroundColor: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: '8px',
    color: 'var(--color-text-primary)',
    fontSize: '12px',
  },
  colors: {
    green: '#0A7B4F',
    red: '#C4362C',
    blue: '#1B3A6B',
    amber: '#B8860B',
    purple: '#6941C6',
    cyan: '#0E7490',
    pink: '#B93874',
    lavender: '#7C6CC4',
    muted: '#9A9A92',
  },
} as const

export const PALETTE = [
  CHART.colors.green,
  CHART.colors.blue,
  CHART.colors.amber,
  CHART.colors.red,
  CHART.colors.purple,
  CHART.colors.cyan,
  CHART.colors.pink,
  CHART.colors.lavender,
  CHART.colors.muted,
]

/** ATO tax brackets — FY2025-26 individual rates */
export const TAX_BRACKETS_FY2526 = [
  { min: 0, max: 18200, rate: 0, base: 0 },
  { min: 18201, max: 45000, rate: 0.16, base: 0 },
  { min: 45001, max: 135000, rate: 0.30, base: 4288 },
  { min: 135001, max: 190000, rate: 0.37, base: 31288 },
  { min: 190001, max: Infinity, rate: 0.45, base: 51638 },
] as const

export const MEDICARE_LEVY_RATE = 0.02
export const SBITO_RATE = 0.08
export const SBITO_CAP = 1000
export const SUPER_CONCESSIONAL_CAP = 30000
export const CENTS_PER_KM_RATE = 0.88 // FY2025-26
export const CENTS_PER_KM_MAX = 5000
export const INSTANT_WRITEOFF_THRESHOLD = 20000

/** Financial year helpers */
export function getFYYear(): number {
  const now = new Date()
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
}

export function getEOFYDate(): Date {
  return new Date(getFYYear() + 1, 5, 30) // June 30
}

export function getCurrentQuarter(): { start: Date; end: Date; label: string } {
  const now = new Date()
  const m = now.getMonth()
  const y = now.getFullYear()
  // ATO quarters: Jul-Sep, Oct-Dec, Jan-Mar, Apr-Jun
  if (m >= 6 && m <= 8) return { start: new Date(y, 6, 1), end: new Date(y, 8, 30), label: 'Q1' }
  if (m >= 9 && m <= 11) return { start: new Date(y, 9, 1), end: new Date(y, 11, 31), label: 'Q2' }
  if (m >= 0 && m <= 2) return { start: new Date(y, 0, 1), end: new Date(y, 2, 31), label: 'Q3' }
  return { start: new Date(y, 3, 1), end: new Date(y, 5, 30), label: 'Q4' }
}

/** Stagger delay helper for animations */
export function staggerDelay(index: number, baseMs = 75): string {
  return `${index * baseMs}ms`
}

/** File size limit for CSV imports (10MB) */
export const MAX_CSV_SIZE_BYTES = 10 * 1024 * 1024
