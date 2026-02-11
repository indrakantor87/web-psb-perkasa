import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { UsersClient } from '@/components/UsersClient'

export default async function UsersPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  // Double check RBAC (though middleware should handle it)
  const allowedRoles = ['ADMIN', 'CS', 'NOC']
  if (!allowedRoles.includes(session.user.role)) {
    redirect('/')
  }

  return <UsersClient currentUser={session.user} />
}
