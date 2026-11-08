import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export type ChipTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

const toneClasses: Record<ChipTone, string> = {
  neutral: 'border-line bg-surface-muted text-ink-muted',
  brand: 'border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300',
  info: 'border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  success:
    'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  warning:
    'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  danger: 'border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
}

export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: ChipTone
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide tabular-nums',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
