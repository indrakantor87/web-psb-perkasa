import type { CSSProperties } from 'react'

/** Gaya tooltip Recharts yang seragam untuk seluruh dashboard. */
export const chartTooltipStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  boxShadow: '0 12px 32px -12px rgba(15, 23, 42, 0.28)',
  fontSize: 12,
  padding: '8px 12px',
}

export const chartCursorFill = { fill: 'rgba(100, 116, 139, 0.08)' } as const

export const chartAxisTick = { fontSize: 10, fill: '#94a3b8' } as const
