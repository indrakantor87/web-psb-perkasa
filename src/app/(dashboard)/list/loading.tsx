import { Skeleton } from '@/components/ui/Skeleton'
import { TicketListSkeleton } from '@/components/TicketListSkeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />

      <div className="rounded-card border border-line bg-surface shadow-card">
        <div className="p-4 sm:p-6 lg:p-8">
          <TicketListSkeleton />
        </div>
      </div>
    </div>
  )
}
