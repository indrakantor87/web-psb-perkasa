import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { Card } from './Card'
import { SectionHeading } from './SectionHeading'

export function ChartCard({
  title,
  description,
  badge,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode
  description?: ReactNode
  badge?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card className={clsx('p-5 sm:p-6', className)}>
      <SectionHeading title={title} description={description} badge={badge} action={action} className="mb-5" />
      <div className={bodyClassName}>{children}</div>
    </Card>
  )
}
