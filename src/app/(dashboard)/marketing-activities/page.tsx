import { MarketingActivityView } from '@/components/MarketingActivityView'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

function toValidDivision(value?: string) {
  if (value === 'PENJUALAN' || value === 'CS_ADMIN' || value === 'NOC_TROUBLESHOOTS' || value === 'CREATOR_DIGITAL') {
    return value
  }
  return 'ALL'
}

export default async function MarketingActivitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ division?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role === 'TEKNISI') redirect('/')
  const params = await searchParams
  const initialDivision = toValidDivision(params?.division)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Aktivitas Marketing</h1>
      </div>

      <MarketingActivityView 
        userRole={session.user.role} 
        userName={session.user.name} 
        initialDivision={initialDivision}
      />
    </div>
  )
}
