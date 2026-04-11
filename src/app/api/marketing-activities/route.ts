import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { cache } from '@/lib/cache'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role === 'TEKNISI') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const year = searchParams.get('year')
  const marketing = searchParams.get('marketing')

  const where: Prisma.MarketingActivityWhereInput = {}

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
        },
        area2: {
          select: { name: true }
        },
        area3: {
          select: { name: true }
        },
        area4: {
          select: { name: true }
        },
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
  if (session.user.role === 'TEKNISI') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { date, marketingName, activity, notes, areaId, areaId2, areaId3, areaId4 } = body

    if (!date || !marketingName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parseOptionalInt = (v: unknown) => {
      if (v === null || typeof v === 'undefined' || v === '') return null
      const n = parseInt(String(v), 10)
      return Number.isFinite(n) ? n : null
    }

    const picked = [parseOptionalInt(areaId), parseOptionalInt(areaId2), parseOptionalInt(areaId3), parseOptionalInt(areaId4)]
    const uniquePicked = picked.map((val, idx) => {
      if (val === null) return null
      const firstIndex = picked.findIndex(v => v === val)
      return firstIndex === idx ? val : null
    })

    const newActivity = await prisma.marketingActivity.create({
      data: {
        date: new Date(date),
        marketingName,
        activity: activity || '-',
        notes: notes || '',
        areaId: uniquePicked[0],
        areaId2: uniquePicked[1],
        areaId3: uniquePicked[2],
        areaId4: uniquePicked[3],
      },
    })

    cache.invalidateByPrefix('marketing-activities:')
    return NextResponse.json(newActivity)
  } catch (error) {
    console.error('Failed to create marketing activity:', error)
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
  }
}
