import { OdpManager } from '@/components/OdpManager'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function OdpPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  if (session.user.role === 'MARKETING') {
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

  const canEdit = ['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(session.user.role)

  return <OdpManager canEdit={canEdit} />
}

