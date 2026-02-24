import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const where: any = {}

  if (status && status !== 'ALL') {
    where.status = status
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

  try {
    const isolations = await prisma.isolation.findMany({
      where,
      orderBy: {
        isolationDate: 'desc',
      },
      include: {
        ticket: {
          select: {
            package: true,
            locationMap: true,
          }
        }
      }
    })

    return NextResponse.json(isolations)
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
    const { customerName, customerAddress, customerPhone, reason, teknisi, ticketId } = body

    const isolation = await prisma.isolation.create({
      data: {
        customerName,
        customerAddress,
        customerPhone,
        reason,
        teknisi: teknisi || session.user.name,
        ticketId: ticketId ? parseInt(ticketId) : null,
        status: 'OPEN',
      },
    })

    return NextResponse.json(isolation)
  } catch (error) {
    console.error('Failed to create isolation:', error)
    return NextResponse.json({ error: 'Failed to create isolation' }, { status: 500 })
  }
}
