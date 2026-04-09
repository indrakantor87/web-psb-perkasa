import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { cache } from '@/lib/cache'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const areas = await (prisma as any).coveredArea.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(areas)
  } catch (error) {
    console.error('Failed to fetch covered areas:', error)
    return NextResponse.json({ error: 'Failed to fetch areas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!['ADMIN', 'CS', 'NOC'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const newArea = await (prisma as any).coveredArea.create({
      data: {
        name,
        description,
      },
    })

    cache.invalidateByPrefix('covered-areas:')
    return NextResponse.json(newArea)
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? (error as { code?: string }).code
        : undefined
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Nama area sudah ada' }, { status: 400 })
    }
    console.error('Failed to create covered area:', error)
    return NextResponse.json({ error: 'Failed to create area' }, { status: 500 })
  }
}
