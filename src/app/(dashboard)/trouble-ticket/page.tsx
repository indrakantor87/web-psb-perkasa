import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TroubleTicketView } from '@/components/TroubleTicketView'

export const dynamic = 'force-dynamic'

function toValidDivision(value?: string) {
  if (value === 'PENJUALAN' || value === 'CS_ADMIN' || value === 'NOC_TROUBLESHOOTS' || value === 'CREATOR_DIGITAL') {
    return value
  }
  return 'ALL'
}

export default async function TroubleTicketPage({
  searchParams,
}: {
  searchParams?: Promise<{ division?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  const params = await searchParams

  const isTroubleshoots = (session.user.role || '').toUpperCase() === 'TROUBLESHOOTS'

  return (
    <div className={isTroubleshoots ? 'space-y-4' : 'space-y-6'}>
      {!isTroubleshoots && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trouble Ticket</h1>
        </div>
      )}
      <TroubleTicketView userRole={session.user.role} initialDivision={toValidDivision(params?.division)} />
    </div>
  )
}
