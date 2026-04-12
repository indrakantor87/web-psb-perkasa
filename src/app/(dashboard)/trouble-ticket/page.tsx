import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TroubleTicketView } from '@/components/TroubleTicketView'

export const dynamic = 'force-dynamic'

export default async function TroubleTicketPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const isTroubleshoots = (session.user.role || '').toUpperCase() === 'TROUBLESHOOTS'

  return (
    <div className={isTroubleshoots ? 'space-y-4' : 'space-y-6'}>
      {!isTroubleshoots && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trouble Ticket</h1>
        </div>
      )}
      <TroubleTicketView userRole={session.user.role} />
    </div>
  )
}
