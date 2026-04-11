import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { Prisma } from '@prisma/client'
import { cache } from '@/lib/cache'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role === 'TEKNISI') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const radboox = searchParams.get('radboox')
  const marketing = searchParams.get('marketing')
  const status = searchParams.get('status')
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
  const limit = (() => {
    const n = parseInt(searchParams.get('limit') || '25', 10)
    if ([25, 50, 75, 100].includes(n)) return n
    return 25
  })()

  const where: Prisma.IsolationWhereInput = {}
  const appendAnd = (clause: Prisma.IsolationWhereInput) => {
    const current = where.AND
    const arr = Array.isArray(current) ? current : current ? [current] : []
    where.AND = [...arr, clause]
  }

  if (status && status.trim() !== '') {
    where.status = status.trim().toUpperCase()
  }
  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: 'insensitive' } },
      { customerAddress: { contains: search, mode: 'insensitive' } },
      { customerPhone: { contains: search, mode: 'insensitive' } },
      { userEmail: { contains: search, mode: 'insensitive' } },
      { marketing: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (radboox && radboox !== 'ALL') {
    where.radboox = radboox
  }
  if (marketing && marketing.trim() !== '') {
    const mk = marketing.trim()
    appendAnd({
      OR: [{ marketing: { equals: mk } }, { marketing: { contains: mk, mode: 'insensitive' } }],
    })
  }
  // Role-based restriction: non-privileged users hanya melihat isolir milik dirinya
  const privileged = ['ADMIN', 'CS', 'NOC']
  if (!privileged.includes(session.user.role)) {
    const me = session.user.name?.trim()
    if (me) {
      appendAnd({
        OR: [{ marketing: { equals: me } }, { marketing: { contains: me, mode: 'insensitive' } }],
      })
    }
  }

  try {
    const cacheKey = `isolations:${JSON.stringify({ search, radboox, marketing, status, page, limit, role: session.user.role, user: session.user.name })}`
    const cached = cache.get<{ items: Array<{ id: number }>; total: number; page: number; limit: number }>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60', 'X-Cache': 'HIT' } })
    }
    const [total, isolations] = await Promise.all([
      prisma.isolation.count({ where }),
      prisma.isolation.findMany({
      where,
      orderBy: {
        isolationDate: 'desc',
      },
        skip: (page - 1) * limit,
        take: limit,
      include: {
        ticket: {
          select: {
            package: true,
            locationMap: true,
          }
        }
        }
      })
    ])

    const payload = {
      items: isolations,
      total,
      page,
      limit
    }
    cache.set(cacheKey, payload, 15_000)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60', 'X-Cache': 'MISS' } })
  } catch (error) {
    console.error('Failed to fetch isolations:', error)
    return NextResponse.json({ error: 'Failed to fetch isolations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Restrict MARKETING from creating isolations
  if (session.user.role === 'MARKETING') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const customerName = String(body.customerName ?? '')
    const customerAddress = typeof body.customerAddress === 'string' ? body.customerAddress : undefined
    const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone : undefined
    const userEmail = typeof body.userEmail === 'string' ? body.userEmail : null
    const marketing = typeof body.marketing === 'string' ? body.marketing : null
    const reason = typeof body.reason === 'string' ? body.reason : undefined
    const teknisi = typeof body.teknisi === 'string' ? body.teknisi : undefined
    const radboox = typeof body.radboox === 'string' ? body.radboox : null
    const activeDate = body.activeDate ? new Date(String(body.activeDate)) : null
    const ticketIdRaw = body.ticketId
    const ticketId = typeof ticketIdRaw === 'number' ? Math.trunc(ticketIdRaw) : typeof ticketIdRaw === 'string' ? parseInt(ticketIdRaw, 10) : null

    const createData: Prisma.IsolationUncheckedCreateInput = {
      customerName,
      customerAddress,
      customerPhone,
      userEmail,
      activeDate,
      marketing,
      radboox,
      reason,
      teknisi: teknisi || session.user.name,
      ticketId,
      status: 'OPEN',
    }

    const isolation = await prisma.isolation.create({ data: createData })

    cache.invalidateByPrefix('isolations:')
    return NextResponse.json(isolation)
  } catch (error) {
    console.error('Failed to create isolation:', error)
    return NextResponse.json({ error: 'Failed to create isolation' }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Only ADMIN can bulk delete
  if (!['ADMIN', 'CS', 'NOC'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const deleted = await prisma.isolation.deleteMany({})
    cache.invalidateByPrefix('isolations:')
    return NextResponse.json({ success: true, count: deleted.count })
  } catch (error) {
    console.error('Failed to bulk delete isolations:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
