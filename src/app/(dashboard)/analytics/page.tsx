import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AnalyticsView } from '@/components/AnalyticsView'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ division?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  const params = await searchParams

  return (
    <div className="space-y-4 sm:space-y-6">
      <AnalyticsView
        userRole={session.user.role}
        initialDivision={params?.division as any}
      />
    </div>
  )
}
