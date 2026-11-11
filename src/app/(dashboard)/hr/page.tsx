import { getSession } from '@/lib/auth'
import { canAccessHrEmployees, canAccessMenu, canMutateMenu, isDeveloperRole } from '@/lib/access'
import { redirect } from 'next/navigation'
import { HrTabs } from '@/components/HrTabs'
import { HrAttendanceView } from '@/components/HrAttendanceView'

export const dynamic = 'force-dynamic'

export default async function HrPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canAccessMenu(session.user.role, 'hr')) redirect('/')

  return (
    <div className="space-y-4 sm:space-y-6">
      <HrTabs canViewEmployees={canAccessHrEmployees(session.user.role)} />
      <HrAttendanceView
        userRole={session.user.role}
        canManage={canMutateMenu(session.user.role, 'hr')}
        canConfigureMachine={isDeveloperRole(session.user.role)}
      />
    </div>
  )
}
