import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export type StatTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral'

const toneIcon: Record<StatTone, string> = {
  brand: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  danger: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  neutral: 'bg-surface-muted text-ink-muted',
}

const toneValue: Record<StatTone, string> = {
  brand: 'text-ink',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-ink',
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  className,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: StatTone
  className?: string
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-line bg-surface p-4 transition duration-200 hover:border-brand/30 dark:hover:border-brand/40',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
        {icon && <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', toneIcon[tone])}>{icon}</span>}
      </div>
      <div className={clsx('mt-2 text-2xl font-bold tabular-nums tracking-tight', toneValue[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-muted">{hint}</div>}
    </div>
  )
}
