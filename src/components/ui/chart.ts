import type { CSSProperties } from 'react'

/** Gaya tooltip Recharts yang seragam untuk seluruh dashboard. */
export const chartTooltipStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid var(--line)',
  backgroundColor: 'var(--surface)',
  color: 'var(--ink)',
  boxShadow: '0 12px 32px -12px rgba(15, 23, 42, 0.28)',
  fontSize: 12,
  padding: '8px 12px',
}

export const chartCursorFill = { fill: 'var(--chart-cursor)' } as const

export const chartAxisTick = { fontSize: 10, fill: '#94a3b8' } as const
