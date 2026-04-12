import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TroubleTicketCloseForm } from '@/components/TroubleTicketCloseForm'

export const dynamic = 'force-dynamic'

export default async function TroubleTicketClosePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const ticketId = parseInt(id, 10)
  if (!Number.isFinite(ticketId) || ticketId < 1) redirect('/trouble-ticket')

  const isTroubleshoots = (session.user.role || '').toUpperCase() === 'TROUBLESHOOTS'

  return (
    <div className={isTroubleshoots ? 'space-y-4' : 'space-y-6'}>
      {!isTroubleshoots && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Close Trouble Ticket</h1>
        </div>
      )}

      <TroubleTicketCloseForm ticketId={ticketId} />
    </div>
  )
}
