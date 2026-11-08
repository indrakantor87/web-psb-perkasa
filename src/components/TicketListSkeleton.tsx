import { Skeleton } from '@/components/ui/Skeleton'

export function TicketListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Stats Skeleton */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>

      {/* Filters Skeleton */}
      <div className="flex w-full flex-col space-y-1 rounded-xl border border-line bg-surface p-1.5 shadow-card md:flex-row md:items-center md:justify-between md:space-y-0 md:gap-4">
        <div className="flex w-full flex-col space-y-1 md:w-auto md:flex-row md:items-center md:space-y-0 md:space-x-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="overflow-x-auto overflow-y-hidden rounded-card border border-line bg-surface shadow-card">
        <table className="min-w-full border-collapse">
          <thead className="bg-surface-muted">
            <tr>
              {[...Array(10)].map((_, i) => (
                <th key={i} className="px-3 py-3">
                  <Skeleton className="mx-auto h-4 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...Array(10)].map((_, rowIdx) => (
              <tr key={rowIdx}>
                {[...Array(10)].map((_, colIdx) => (
                  <td key={colIdx} className="px-3 py-3 whitespace-nowrap">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
