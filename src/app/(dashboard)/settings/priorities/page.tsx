
import { PriorityManager } from '@/components/PriorityManager'

export default function PrioritiesPage() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Priority Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage ticket priority levels and their colors.
        </p>
      </div>
      <PriorityManager />
    </div>
  )
}
