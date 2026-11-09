import { getSession } from '@/lib/auth'
import { isDeveloperRole } from '@/lib/access'
import { redirect } from 'next/navigation'
import { SecurityLogsClient } from '@/components/SecurityLogsClient'

export default async function SecurityLogsPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (!isDeveloperRole(session.user.role)) {
    redirect('/')
  }

  return <SecurityLogsClient />
}
