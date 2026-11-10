import { DailyActivityView } from '@/components/DailyActivityView'
import { getSession } from '@/lib/auth'
import { canAccessMenu, canMutateMenu } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DailyActivityPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Ambil position & subdivision terbaru untuk pengecekan akses.
  let position = session.user.position ?? null
  let subdivision = session.user.subdivision ?? null
  try {
    const fresh = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { position: true, subdivision: true },
    })
    if (fresh) {
      position = fresh.position ?? null
      subdivision = fresh.subdivision ?? null
    }
  } catch {
    // Gunakan data session jika DB gagal.
  }

  if (!canAccessMenu(session.user.role, 'daily-activity', position, subdivision)) redirect('/')

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Daily Activity</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Rencana, laporan, dan approval aktivitas harian
          </p>
        </div>
      </div>

      <DailyActivityView
        userRole={session.user.role}
        userName={session.user.name}
        readOnly={!canMutateMenu(session.user.role, 'daily-activity')}
      />
    </div>
  )
}
