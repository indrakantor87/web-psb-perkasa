import { PackageManager } from '@/components/PackageManager'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function PackagesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const allowedRoles = ['ADMIN', 'CS', 'NOC']
  if (!allowedRoles.includes(session.user.role)) {
    return (
      <div className="rounded-2xl bg-red-50 p-4 sm:p-6 border border-red-100">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>You do not have permission to view this page.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Master Paket</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Kelola daftar paket untuk pilihan pada Input PSB.</p>
      </div>
      <PackageManager />
    </div>
  )
}

