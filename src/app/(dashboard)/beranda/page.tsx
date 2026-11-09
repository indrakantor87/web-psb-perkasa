import { MobileHome } from '@/components/MobileHome'
import { getSession } from '@/lib/auth'
import { isMobileTechnicianRole } from '@/lib/mobile-nav'
import { redirect } from 'next/navigation'

export default async function TechnicianHomePage() {
  const session = await getSession()

  if (!session) redirect('/login')
  if (!isMobileTechnicianRole(session.user.role)) redirect('/')

  return (
    <MobileHome
      userName={session.user.name ?? ''}
      userRole={session.user.role}
      statusCounts={{ total: 0, open: 0, close: 0, on_progress: 0 }}
      showPsbSummaryOverride={false}
      mobileOnly={false}
    />
  )
}
