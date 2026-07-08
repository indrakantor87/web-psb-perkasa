import { getSession } from '@/lib/auth'
import { canAccessMenu } from '@/lib/access'
import { redirect } from 'next/navigation'
import { SecurityLogsClient } from '@/components/SecurityLogsClient'

export default async function SecurityLogsPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (!canAccessMenu(session.user.role, 'settings')) {
    redirect('/')
  }

  return <SecurityLogsClient />
}

