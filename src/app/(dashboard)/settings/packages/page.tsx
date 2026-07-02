import { PackageManager } from '@/components/PackageManager'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function PackagesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const allowedRoles = ['ADMIN', 'CS', 'NOC']
  if (!allowedRoles.includes(session.user.role)) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 sm:p-6">
        Halaman ini hanya tersedia untuk akun yang memiliki akses pengaturan paket.
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Pengaturan Paket</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Rapikan daftar paket yang dipakai sebagai pilihan pada Input PSB.
        </p>
      </div>
      <PackageManager />
    </div>
  )
}
