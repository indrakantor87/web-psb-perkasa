import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardLayoutClient } from '@/components/DashboardLayoutClient'

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

  return (
    <DashboardLayoutClient user={session.user}>
      {children}
    </DashboardLayoutClient>
  )
}
