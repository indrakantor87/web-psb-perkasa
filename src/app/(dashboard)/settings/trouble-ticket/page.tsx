import { TroubleTicketIdManager } from '@/components/TroubleTicketIdManager'
import { TroubleTicketSlaManager } from '@/components/TroubleTicketSlaManager'
import { TroubleTicketMasterManager } from '@/components/TroubleTicketMasterManager'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Pengaturan Trouble Ticket | Web PSB Perkasa',
}

export default async function TroubleTicketSettingsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const isAuthorized = ['ADMIN', 'CS', 'NOC'].includes(session.user.role)
  if (!isAuthorized) redirect('/')

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan Trouble Ticket</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola format ID, SLA, dan master data Jenis Gangguan/Tindakan untuk Trouble Ticket.
          </p>
        </header>
        <div className="space-y-4">
          <TroubleTicketIdManager />
          <TroubleTicketSlaManager />
          <TroubleTicketMasterManager />
        </div>
      </div>
    </div>
  )
}
