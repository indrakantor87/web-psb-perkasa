import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TroubleTicketIdManager } from '@/components/TroubleTicketIdManager'
import { TroubleTicketSlaManager } from '@/components/TroubleTicketSlaManager'

export default async function TroubleTicketSettingsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const allowed = ['ADMIN', 'CS', 'NOC']
  if (!allowed.includes(session.user.role)) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>You do not have permission to view this page.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trouble Ticket Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Pengaturan durasi Trouble Ticket berdasarkan tipe.
        </p>
      </div>
      <TroubleTicketIdManager />
      <TroubleTicketSlaManager />
    </div>
  )
}
