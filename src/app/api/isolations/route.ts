import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { Prisma } from '@prisma/client'
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
      return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'HIT' } })
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
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'MISS' } })
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

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'CS', 'NOC'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as { radboox?: unknown; limit?: unknown }
  const radboox = typeof body.radboox === 'string' && body.radboox.trim() !== '' && body.radboox !== 'ALL' ? body.radboox.trim() : null
  const limitRaw = typeof body.limit === 'number' ? Math.trunc(body.limit) : typeof body.limit === 'string' ? parseInt(body.limit, 10) : 500
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5000, limitRaw)) : 500

  const normalizePhoneDigits = (v: string | null) => {
    if (!v) return ''
    return v.replace(/\D/g, '')
  }
  const normalizeNameKey = (v: string) => {
    return v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim()
  }

  try {
    const where: Prisma.IsolationWhereInput = { ticketId: null }
    if (radboox) where.radboox = radboox

    const items = await prisma.isolation.findMany({
      where,
      take: limit,
      orderBy: { id: 'desc' },
      select: { id: true, customerName: true, customerPhone: true },
    })

    let updated = 0
    for (const it of items) {
      const phoneDigits = normalizePhoneDigits(it.customerPhone)
      let ticketId: number | null = null

      if (phoneDigits) {
        const likeA = `%${phoneDigits}%`
        const last10 = phoneDigits.length > 10 ? phoneDigits.slice(-10) : phoneDigits
        const likeB = `%${last10}%`
        const rows = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          SELECT "id"
          FROM "Ticket"
          WHERE regexp_replace(COALESCE("phoneNumber", ''), '[^0-9]+', '', 'g') LIKE ${likeA}
             OR regexp_replace(COALESCE("phoneNumber", ''), '[^0-9]+', '', 'g') LIKE ${likeB}
          ORDER BY "createdAt" DESC
          LIMIT 1
        `)
        ticketId = rows[0]?.id ?? null
      }

      if (!ticketId) {
        const nameKey = normalizeNameKey(it.customerName)
        if (nameKey && nameKey.length >= 4) {
          const likeName = `%${nameKey}%`
          const rows = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
            SELECT "id"
            FROM "Ticket"
            WHERE regexp_replace(lower(COALESCE("customerName", '')), '[^a-z0-9]+', '', 'g') LIKE ${likeName}
            ORDER BY "createdAt" DESC
            LIMIT 1
          `)
          ticketId = rows[0]?.id ?? null
        }
      }

      if (ticketId) {
        await prisma.isolation.update({
          where: { id: it.id },
          data: { ticketId },
        })
        updated++
      }
    }

    cache.invalidateByPrefix('isolations:')
    return NextResponse.json({ ok: true, scanned: items.length, updated })
  } catch (error) {
    console.error('Failed to sync isolation tickets:', error)
    return NextResponse.json({ error: 'Failed to sync tickets' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Only ADMIN can bulk delete
  if (!['ADMIN', 'CS', 'NOC'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown }
    const idsRaw = body?.ids
    const ids =
      Array.isArray(idsRaw)
        ? idsRaw.map((x) => (typeof x === 'number' ? x : typeof x === 'string' ? parseInt(x, 10) : NaN)).filter((n) => Number.isFinite(n)) as number[]
        : null

    const deleted = ids && ids.length > 0
      ? await prisma.isolation.deleteMany({ where: { id: { in: ids } } })
      : await prisma.isolation.deleteMany({})

    cache.invalidateByPrefix('isolations:')
    return NextResponse.json({ success: true, count: deleted.count })
  } catch (error) {
    console.error('Failed to bulk delete isolations:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
