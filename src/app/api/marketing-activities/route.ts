import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { cache } from '@/lib/cache'
import { Prisma } from '@prisma/client'
import {
  normalizeMarketingName,
  resolveMarketingName,
  marketingNameKey,
} from '@/lib/marketing-users'
import { canMutateMarketingActivities, isAdminRole } from '@/lib/access'
import { ensureMenuAccess, requireSession, unauthorizedResponse } from '@/lib/access-server'
import { ensureMarketingActivityColumnsOnce } from '@/lib/marketing-activity-schema'
import { jakartaDayKey, jakartaMonthRange } from '@/lib/jakarta-time'

export const runtime = 'nodejs'

function toNonNegativeInt(value: unknown) {
  const n = parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function parseOptionalInt(value: unknown) {
  if (value === null || typeof value === 'undefined' || value === '') return null
  const n = parseInt(String(value), 10)
  return Number.isFinite(n) ? n : null
}

async function buildPsbMap(start: Date, end: Date) {
  const psbMap = new Map<string, number>()
  try {
    const tickets = await prisma.ticket.findMany({
      where: { requestDate: { gte: start, lt: end } },
      select: { marketingName: true, requestDate: true },
    })
    for (const ticket of tickets) {
      const key = `${marketingNameKey(ticket.marketingName)}|${jakartaDayKey(ticket.requestDate)}`
      psbMap.set(key, (psbMap.get(key) ?? 0) + 1)
    }
  } catch (error) {
    console.error('Failed to build PSB map:', error)
  }
  return psbMap
}

export async function GET(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuAccess(session, 'marketing-activities')
  if (accessError) return accessError
  const activeSession = requireSession(session)

  await ensureMarketingActivityColumnsOnce()

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const year = searchParams.get('year')
  const marketing = searchParams.get('marketing')
  const divisionParam = (searchParams.get('division') ?? 'ALL').trim().toUpperCase()
  const roleUpper = (activeSession.user.role || '').toUpperCase()
  const divisionFilter =
    isAdminRole(roleUpper) &&
    ['ALL', 'PENJUALAN', 'CS_ADMIN', 'NOC_TROUBLESHOOTS', 'CREATOR_DIGITAL'].includes(divisionParam)
      ? divisionParam
      : 'ALL'

  if (isAdminRole(roleUpper) && divisionFilter !== 'ALL' && divisionFilter !== 'PENJUALAN') {
    return NextResponse.json([])
  }

  const where: Prisma.MarketingActivityWhereInput = {}
  let rangeStart: Date | null = null
  let rangeEnd: Date | null = null

  if (month && year) {
    const range = jakartaMonthRange(parseInt(year), parseInt(month))
    rangeStart = range.start
    rangeEnd = range.end
    where.date = {
      gte: range.start,
      lt: range.end,
    }
  }

  if (activeSession.user.role === 'MARKETING') {
    const ownerName = normalizeMarketingName(activeSession.user.name)
    if (ownerName) {
      where.marketingName = {
        equals: ownerName,
        mode: 'insensitive',
      }
    } else {
      where.id = { lt: 0 }
    }
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

    // Rentang tanggal untuk perhitungan PSB otomatis dari list tiket
    if (!rangeStart || !rangeEnd) {
      if (activities.length > 0) {
        const times = activities.map((a) => new Date(a.date).getTime())
        rangeStart = new Date(Math.min(...times))
        rangeEnd = new Date(Math.max(...times) + 24 * 60 * 60 * 1000)
      }
    }

    const psbMap =
      rangeStart && rangeEnd ? await buildPsbMap(rangeStart, rangeEnd) : new Map<string, number>()

    const result = activities.map((activity) => ({
      ...activity,
      psb: psbMap.get(`${marketingNameKey(activity.marketingName)}|${jakartaDayKey(activity.date)}`) ?? 0,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch marketing activities:', error)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canMutateMarketingActivities(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const activeSession = requireSession(session)

  await ensureMarketingActivityColumnsOnce()

  try {
    const body = await request.json()
    const {
      date,
      marketingName,
      activity,
      notes,
      areaId,
      areaId2,
      areaId3,
      areaId4,
      flyer,
      sosialisasi,
      dataBase,
      event,
    } = body

    if (!date || (!marketingName && activeSession.user.role !== 'MARKETING')) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const finalMarketingName =
      activeSession.user.role === 'MARKETING'
        ? normalizeMarketingName(activeSession.user.name)
        : await resolveMarketingName(marketingName)

    if (!finalMarketingName) {
      return NextResponse.json({ error: 'Nama marketing harus dipilih dari user marketing yang valid' }, { status: 400 })
    }

    const picked = [parseOptionalInt(areaId), parseOptionalInt(areaId2), parseOptionalInt(areaId3), parseOptionalInt(areaId4)]
    const uniquePicked = picked.map((val, idx) => {
      if (val === null) return null
      const firstIndex = picked.findIndex(v => v === val)
      return firstIndex === idx ? val : null
    })

    let activityText = typeof activity === 'string' ? activity.trim() : ''
    if (!activityText && uniquePicked[0]) {
      const area = await prisma.coveredArea.findUnique({
        where: { id: uniquePicked[0] },
        select: { name: true },
      })
      activityText = area?.name ?? ''
    }
    if (!activityText) activityText = '-'

    const flyerValue = toNonNegativeInt(flyer)
    const sosialisasiValue = toNonNegativeInt(sosialisasi)
    const dataBaseValue = toNonNegativeInt(dataBase)
    const eventValue = toNonNegativeInt(event)

    const newActivity = await prisma.marketingActivity.create({
      data: {
        date: new Date(date),
        marketingName: finalMarketingName,
        activity: activityText,
        notes: notes || '',
        flyer: flyerValue,
        sosialisasi: sosialisasiValue,
        dataBase: dataBaseValue,
        event: eventValue,
        total: flyerValue + sosialisasiValue + eventValue,
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
