import { TicketListSkeleton } from '@/components/TicketListSkeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>

      <div className="rounded-lg bg-white dark:bg-gray-800 shadow">
        <div className="p-4 sm:p-6 lg:p-8">
          <TicketListSkeleton />
        </div>
      </div>
    </div>
  )
}
