import { getSession } from '@/lib/auth'
import { canAccessMenu } from '@/lib/access'
import { redirect } from 'next/navigation'
import { DigitalLeadView } from '@/components/DigitalLeadView'

export const dynamic = 'force-dynamic'

export default async function DigitalLeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ division?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canAccessMenu(session.user.role, 'digital-leads')) redirect('/')
  const params = await searchParams

  return (
    <div className="space-y-4 sm:space-y-6">
      <DigitalLeadView
        userRole={session.user.role}
        initialDivision={params?.division as any}
      />
    </div>
  )
}
