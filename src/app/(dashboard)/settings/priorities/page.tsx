
import { PriorityManager } from '@/components/PriorityManager'
import { getSession } from '@/lib/auth'
import { canAccessMenu } from '@/lib/access'
import { redirect } from 'next/navigation'

export default async function PrioritiesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  if (!canAccessMenu(session.user.role, 'settings')) redirect('/')

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Pengaturan Prioritas</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Kelola level prioritas ticket beserta tampilan badge-nya.
        </p>
      </div>
      <PriorityManager />
    </div>
  )
}
