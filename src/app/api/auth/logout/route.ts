import { logout } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { logSecurityEvent } from '@/lib/security-log'

export async function POST(request: Request) {
  const session = await getSession()
  if (session) {
    await logSecurityEvent({
      action: 'LOGOUT',
      request,
      user: { id: session.user.id, username: session.user.username, role: session.user.role },
    }).catch(() => {})
  }
  await logout()
  return NextResponse.json({ message: 'Logged out successfully' })
}
