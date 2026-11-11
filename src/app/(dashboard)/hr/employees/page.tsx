import { getSession } from '@/lib/auth'
import { canAccessHrEmployees, canAccessMenu, canMutateMenu } from '@/lib/access'
import { redirect } from 'next/navigation'
import { HrTabs } from '@/components/HrTabs'
import { HrEmployeesView } from '@/components/HrEmployeesView'

export const dynamic = 'force-dynamic'

export default async function HrEmployeesPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canAccessMenu(session.user.role, 'hr')) redirect('/')
  // Hanya Developer, Priority, Admin, dan HR yang boleh melihat daftar seluruh karyawan.
  if (!canAccessHrEmployees(session.user.role)) redirect('/hr')

  return (
    <div className="space-y-4 sm:space-y-6">
      <HrTabs />
      <HrEmployeesView canManage={canMutateMenu(session.user.role, 'hr')} />
    </div>
  )
}
