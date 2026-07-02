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
    <div className="mx-auto w-full max-w-5xl space-y-4 sm:space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Pengaturan Trouble Ticket</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Kelola format ID, SLA, dan master data agar alur ticket lebih rapi dan konsisten.
        </p>
      </header>
      <div className="space-y-4">
        <TroubleTicketIdManager />
        <TroubleTicketSlaManager />
        <TroubleTicketMasterManager />
      </div>
    </div>
  )
}
