import { CoveredAreaManager } from '@/components/CoveredAreaManager'
import { getSession } from '@/lib/auth'
import { canAccessMenu } from '@/lib/access'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Master Data Area | Web PSB Perkasa',
}

export default async function CoveredAreaPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  if (!canAccessMenu(session.user.role, 'settings')) redirect('/')

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Pengaturan Area</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Kelola daftar area tercover untuk analisis efektivitas kunjungan marketing.
        </p>
      </header>

      <CoveredAreaManager />
    </div>
  )
}
