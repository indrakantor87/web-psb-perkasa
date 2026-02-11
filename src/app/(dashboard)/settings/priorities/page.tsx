
import { PriorityManager } from '@/components/PriorityManager'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function PrioritiesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Only ADMIN can manage priorities
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>You do not have permission to view this page. Only Administrators can manage priorities.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
