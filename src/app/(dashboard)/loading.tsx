export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
       <div className="h-8 w-1/4 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg shadow" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg shadow" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg shadow" />
       </div>
       <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg shadow mt-6" />
    </div>
  )
}
