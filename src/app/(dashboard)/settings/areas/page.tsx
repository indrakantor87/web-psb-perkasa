import { CoveredAreaManager } from '@/components/CoveredAreaManager'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Master Data Area | Web PSB Perkasa',
}

export default async function CoveredAreaPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const isAuthorized = ['ADMIN', 'CS', 'NOC'].includes(session.user.role)
  if (!isAuthorized) redirect('/')

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan Area</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola daftar area tercover untuk analisis efektivitas kunjungan marketing.
          </p>
        </header>

        <CoveredAreaManager />
      </div>
    </div>
  )
}
