import { MarketingActivityView } from '@/components/MarketingActivityView'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MarketingActivitiesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Aktivitas Marketing</h1>
      </div>

      <MarketingActivityView 
        userRole={session.user.role} 
        userName={session.user.name} 
      />
    </div>
  )
}
