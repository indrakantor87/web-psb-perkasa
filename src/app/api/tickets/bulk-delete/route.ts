import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/cache'
import type { Prisma } from '@prisma/client'
import { jakartaMonthRange, jakartaNow } from '@/lib/jakarta-time'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['ADMIN', 'CS', 'NOC']
  if (!allowedRoles.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    month?: unknown
    year?: unknown
    status?: unknown
    marketing?: unknown
    search?: unknown
    confirmText?: unknown
  }

  const confirmText = String(body.confirmText ?? '')
  if (confirmText !== 'HAPUS') {
    return NextResponse.json({ error: 'Konfirmasi tidak valid' }, { status: 400 })
  }

  const month = Math.trunc(Number(body.month))
  const year = Math.trunc(Number(body.year))
  if (!Number.isFinite(month) || month < 1 || month > 12) return NextResponse.json({ error: 'Bulan tidak valid' }, { status: 400 })
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return NextResponse.json({ error: 'Tahun tidak valid' }, { status: 400 })

  const statusRaw = String(body.status ?? 'ALL').toUpperCase()
  const status = statusRaw === 'PENDING' ? 'ON_PROGRESS' : statusRaw
  const marketing = String(body.marketing ?? '').trim()
  const search = String(body.search ?? '').trim()

  const { start: startDate, end: endDate } = jakartaMonthRange(year, month)
  const now = jakartaNow()
  const isSelectedCurrentMonth = now.getFullYear() === year && (now.getMonth() + 1) === month
  const openStatuses = ['OPEN', 'ON_PROGRESS']

  const baseWhereOr: Prisma.TicketWhereInput[] = [
    { AND: [{ installedDate: { not: null } }, { installedDate: { gte: startDate, lt: endDate } }] },
  ]
  if (isSelectedCurrentMonth) {
    baseWhereOr.push({ AND: [{ installedDate: null }, { status: { in: openStatuses } }, { requestDate: { lt: endDate } }] })
  }
  const where: Prisma.TicketWhereInput = { OR: baseWhereOr }

  if (marketing) {
    where.marketingName = { contains: marketing }
  }

  if (search) {
    const searchInt = parseInt(search, 10)
    const isNum = !Number.isNaN(searchInt)
    where.OR = [
      { customerName: { contains: search, mode: 'insensitive' } },
      { pengawalan: { contains: search, mode: 'insensitive' } },
    ]
    if (isNum) where.OR.push({ id: searchInt })
  }

  if (status && status !== 'ALL') {
    where.status = status
  }

  const deleted = await prisma.ticket.deleteMany({ where })
  cache.invalidateByPrefix('tickets-list:')
  cache.invalidateByPrefix('tickets:')
  return NextResponse.json({ ok: true, deleted: deleted.count })
}
