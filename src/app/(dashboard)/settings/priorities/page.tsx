
import { PriorityManager } from '@/components/PriorityManager'

export default function PrioritiesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan Prioritas</h1>
      </div>
      <PriorityManager />
    </div>
  )
}
