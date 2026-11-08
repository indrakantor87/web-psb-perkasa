import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export type CardVariant = 'default' | 'muted'

export function cardClassName({
  variant = 'default',
  interactive = false,
  className,
}: {
  variant?: CardVariant
  interactive?: boolean
  className?: string
} = {}) {
  return clsx(
    'rounded-card border shadow-card',
    variant === 'muted' ? 'border-line bg-surface-muted' : 'border-line bg-surface',
    interactive &&
      'transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transform-none motion-reduce:transition-none',
    className
  )
}

export function Card({
  children,
  className,
  variant = 'default',
  interactive = false,
}: {
  children: ReactNode
  className?: string
  variant?: CardVariant
  interactive?: boolean
}) {
  return <div className={cardClassName({ variant, interactive, className })}>{children}</div>
}
