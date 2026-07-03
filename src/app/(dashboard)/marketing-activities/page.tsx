import { MarketingActivityView } from '@/components/MarketingActivityView'
import { getSession } from '@/lib/auth'
import { canAccessMenu, canMutateMenu } from '@/lib/access'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MarketingActivitiesPage({
}: {
  searchParams?: Promise<{ division?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canAccessMenu(session.user.role, 'marketing-activities')) redirect('/')

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Aktivitas Marketing</h1>
      </div>

      <MarketingActivityView 
        userRole={session.user.role} 
        userName={session.user.name} 
        readOnly={!canMutateMenu(session.user.role, 'marketing-activities')}
      />
    </div>
  )
}
