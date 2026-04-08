import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { cache } from '@/lib/cache'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const year = searchParams.get('year')
  const marketing = searchParams.get('marketing')

  const where: any = {}

  if (month && year) {
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
    const endDate = new Date(parseInt(year), parseInt(month), 1)
    where.date = {
      gte: startDate,
      lt: endDate,
    }
  }

  if (session.user.role === 'MARKETING') {
    where.marketingName = session.user.name
  } else if (marketing && marketing.trim()) {
    where.marketingName = {
      contains: marketing.trim(),
      mode: 'insensitive',
    }
  }

  try {
    const activities = await prisma.marketingActivity.findMany({
      where,
      include: {
        area: {
          select: { name: true }
        }
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(activities)
  } catch (error) {
    console.error('Failed to fetch marketing activities:', error)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { date, marketingName, activity, notes, areaId } = body

    if (!date || !marketingName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const newActivity = await prisma.marketingActivity.create({
      data: {
        date: new Date(date),
        marketingName,
        activity: activity || '-',
        notes: notes || '',
        areaId: areaId ? parseInt(areaId) : null,
      },
    })

    cache.invalidateByPrefix('marketing-activities:')
    return NextResponse.json(newActivity)
  } catch (error) {
    console.error('Failed to create marketing activity:', error)
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
  }
}
