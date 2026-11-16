import { MobileHome } from '@/components/MobileHome'
import { NocDashboard } from '@/components/NocDashboard'
import { getSession } from '@/lib/auth'
import { normalizeRole } from '@/lib/access'
import { redirect } from 'next/navigation'

export default async function TechnicianHomePage() {
  const session = await getSession()

  if (!session) redirect('/login')
  const userRole = session.user.role
  const isNoc = normalizeRole(userRole) === 'NOC'
  const mobileShortcuts = (
    <MobileHome
      userRole={userRole}
      position={session.user.position}
      subdivision={session.user.subdivision}
      statusCounts={{ total: 0, open: 0, close: 0, on_progress: 0 }}
      showPsbSummaryOverride={false}
      mobileOnly={isNoc}
    />
  )

  if (isNoc) {
    return (
      <>
        {mobileShortcuts}
        <div className="hidden md:block">
          <NocDashboard />
        </div>
      </>
    )
  }

  return mobileShortcuts
}
