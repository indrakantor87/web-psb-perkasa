import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  const where: any = {}

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
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { marketing: { equals: mk } },
          { marketing: { contains: mk, mode: 'insensitive' } }
        ]
      }
    ]
  }
  // Role-based restriction: non-privileged users hanya melihat isolir milik dirinya
  const privileged = ['ADMIN', 'CS', 'NOC']
  if (!privileged.includes((await getSession())!.user.role)) {
    const me = (await getSession())!.user.name?.trim()
    if (me) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { marketing: { equals: me } },
            { marketing: { contains: me, mode: 'insensitive' } }
          ]
        }
      ]
    }
  }

  try {
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

    return NextResponse.json({
      items: isolations,
      total,
      page,
      limit
    })
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
    const body = await request.json()
    const { 
      customerName, customerAddress, customerPhone, 
      userEmail, activeDate, marketing, radboox,
      reason, teknisi, ticketId 
    } = body

    // Build data object as any to avoid type mismatch if Prisma types are not regenerated yet
    const createData: any = {
      customerName,
      customerAddress,
      customerPhone,
      userEmail: userEmail || null,
      activeDate: activeDate ? new Date(activeDate) : null,
      marketing: marketing || null,
      reason,
      teknisi: teknisi || session.user.name,
      ticketId: ticketId ? parseInt(ticketId) : null,
      status: 'OPEN',
    }
    if (typeof radboox !== 'undefined') {
      createData.radboox = radboox || null
    }
    const isolation = await prisma.isolation.create({ data: createData })

    return NextResponse.json(isolation)
  } catch (error) {
    console.error('Failed to create isolation:', error)
    return NextResponse.json({ error: 'Failed to create isolation' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Only ADMIN can bulk delete
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const deleted = await prisma.isolation.deleteMany({})
    return NextResponse.json({ success: true, count: deleted.count })
  } catch (error) {
    console.error('Failed to bulk delete isolations:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
