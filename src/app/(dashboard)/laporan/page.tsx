import { getSession } from '@/lib/auth'
import { canAccessMenu } from '@/lib/access'
import { redirect } from 'next/navigation'
import { LaporanView } from '@/components/LaporanView'

export const dynamic = 'force-dynamic'

export default async function LaporanPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canAccessMenu(session.user.role, 'laporan')) redirect('/')

  return (
    <div className="space-y-4 sm:space-y-6">
      <LaporanView userRole={session.user.role} />
    </div>
  )
}
