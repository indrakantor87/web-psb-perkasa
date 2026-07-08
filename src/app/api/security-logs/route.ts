import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess } from '@/lib/access-server'
import { ensureSecurityLogTable } from '@/lib/security-log'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuAccess(session, 'settings')
  if (accessError) return accessError

  await ensureSecurityLogTable().catch(() => {})

  const { searchParams } = new URL(request.url)
  const monthKey = String(searchParams.get('month') ?? '').trim() || null
  const user = String(searchParams.get('user') ?? '').trim() || null
  const action = String(searchParams.get('action') ?? '').trim() || null
  const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') ?? 200)))

  const where: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (monthKey) {
    where.push(`"monthKey" = $${idx++}`)
    values.push(monthKey)
  }

  if (user) {
    where.push(`("username" ILIKE $${idx++} OR CAST("userId" AS TEXT) = $${idx++})`)
    values.push(`%${user}%`, user)
  }

  if (action) {
    where.push(`"action" = $${idx++}`)
    values.push(action)
  }

  values.push(limit)
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: number
      monthKey: string
      createdAt: Date
      userId: number | null
      username: string | null
      role: string | null
      action: string
      path: string | null
      method: string | null
      ip: string | null
      userAgent: string | null
      meta: unknown
    }>
  >(
    `SELECT "id","monthKey","createdAt","userId","username","role","action","path","method","ip","userAgent","meta"
     FROM "SecurityLogs"
     ${whereSql}
     ORDER BY "createdAt" DESC, "id" DESC
     LIMIT $${idx};`,
    ...values
  )

  return NextResponse.json({ items: rows })
}

