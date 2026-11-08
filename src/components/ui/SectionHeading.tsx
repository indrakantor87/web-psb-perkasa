import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function SectionHeading({
  title,
  description,
  icon: Icon,
  badge,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  badge?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-muted">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-ink sm:text-lg">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
      </div>
      {(badge || action) && (
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {action}
        </div>
      )}
    </div>
  )
}
