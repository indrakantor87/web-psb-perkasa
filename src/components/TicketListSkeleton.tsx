export function TicketListSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Stats Skeleton */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 rounded-md bg-gray-200 dark:bg-gray-700 shadow-sm" />
        ))}
      </div>

      {/* Filters Skeleton */}
      <div className="flex w-full flex-col space-y-1 rounded-lg bg-white dark:bg-gray-800 p-1.5 shadow-sm md:flex-row md:items-center md:justify-between md:space-y-0 md:gap-4">
        <div className="flex w-full flex-col space-y-1 md:w-auto md:flex-row md:items-center md:space-y-0 md:space-x-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col space-y-1">
              <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="overflow-x-auto overflow-y-hidden rounded-lg bg-white dark:bg-gray-800 shadow-sm">
        <table className="min-w-full border-collapse border border-gray-200 dark:border-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {[...Array(10)].map((_, i) => (
                <th key={i} className="px-3 py-3">
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded mx-auto" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
            {[...Array(10)].map((_, rowIdx) => (
              <tr key={rowIdx}>
                {[...Array(10)].map((_, colIdx) => (
                  <td key={colIdx} className="px-3 py-3 whitespace-nowrap">
                    <div className="h-4 w-full bg-gray-100 dark:bg-gray-700 rounded" />
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
