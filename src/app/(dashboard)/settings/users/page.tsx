import { getSession } from '@/lib/auth'
import { canAccessMenu } from '@/lib/access'
import { redirect } from 'next/navigation'
import { UsersClient } from '@/components/UsersClient'

export default async function UsersPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (!canAccessMenu(session.user.role, 'settings')) {
    redirect('/')
  }

  return <UsersClient currentUser={session.user} />
}
