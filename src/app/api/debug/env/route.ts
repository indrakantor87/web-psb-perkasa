import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isDeveloperRole } from '@/lib/access'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getSession()
  if (!session || !isDeveloperRole(session.user.role)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    runtime: process.env.NODE_ENV,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  })
}
