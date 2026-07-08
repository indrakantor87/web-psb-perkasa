import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess } from '@/lib/access-server'
import { ensureSecurityLogTable } from '@/lib/security-log'

export const runtime = 'nodejs'

function currentMonthKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export async function GET(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuAccess(session, 'settings')
  if (accessError) return accessError

  await ensureSecurityLogTable().catch(() => {})

  const { searchParams } = new URL(request.url)
  const sinceId = Number(searchParams.get('sinceId') ?? '')
  const monthKey = String(searchParams.get('month') ?? '').trim() || currentMonthKey()
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)))

  const where: string[] = [
    `"monthKey" = $1`,
    `"action" = 'LOGIN_SUCCESS'`,
    `COALESCE("role",'') ILIKE 'MARKETING'`,
    `(COALESCE("meta"->>'isNewIp','false') = 'true')`,
  ]
  const values: unknown[] = [monthKey]
  let idx = 2
  if (Number.isFinite(sinceId) && sinceId > 0) {
    where.push(`"id" > $${idx++}`)
    values.push(sinceId)
  }
  values.push(limit)

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: number
      createdAt: Date
      userId: number | null
      username: string | null
      ip: string | null
      userAgent: string | null
      meta: unknown
    }>
  >(
    `SELECT "id","createdAt","userId","username","ip","userAgent","meta"
     FROM "SecurityLogs"
     WHERE ${where.join(' AND ')}
     ORDER BY "id" ASC
     LIMIT $${idx};`,
    ...values
  )

  return NextResponse.json({ items: rows, monthKey })
}

