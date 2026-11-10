import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardLayoutClient } from '@/components/DashboardLayoutClient'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  // Ambil position & subdivision terbaru dari DB agar perubahan jabatan
  // langsung tercermin di menu (mis. akses Daily Activity) tanpa perlu login ulang.
  let user = session.user
  try {
    const fresh = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { position: true, subdivision: true, division: true, role: true, name: true },
    })
    if (fresh) {
      user = {
        ...session.user,
        position: fresh.position ?? null,
        subdivision: fresh.subdivision ?? null,
        division: fresh.division ?? session.user.division ?? null,
      }
    }
  } catch {
    // Abaikan jika DB gagal; gunakan data dari session.
  }

  return (
    <DashboardLayoutClient user={user}>
      {children}
    </DashboardLayoutClient>
  )
}
