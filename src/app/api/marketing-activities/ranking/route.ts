import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { cache } from '@/lib/cache'
import { marketingNameKey, getMarketingUsers, normalizeMarketingName } from '@/lib/marketing-users'
import { ensureMenuAccess, requireSession } from '@/lib/access-server'
import { ensureMarketingActivityColumnsOnce } from '@/lib/marketing-activity-schema'
import { jakartaMonthRange } from '@/lib/jakarta-time'

export const runtime = 'nodejs'

type RankingRow = {
  name: string
  skor: number
  psb: number
  flyer: number
  sosialisasi: number
  dataBase: number
  event: number
  total: number
}

const WEIGHT = { psb: 10, dataBase: 3, sosialisasi: 1, flyer: 1, event: 1 }

export async function GET(request: Request) {
  const session = await getSession()
  const accessError = ensureMenuAccess(session, 'marketing-activities')
  if (accessError) return accessError
  requireSession(session)

  await ensureMarketingActivityColumnsOnce()

  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month')
  const yearParam = searchParams.get('year')
  const now = new Date()
  const month = monthParam ? parseInt(monthParam, 10) : now.getUTCMonth() + 1
  const year = yearParam ? parseInt(yearParam, 10) : now.getUTCFullYear()

  if (!Number.isFinite(month) || !Number.isFinite(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Periode tidak valid' }, { status: 400 })
  }

  const cacheKey = `marketing-activities:ranking:${year}-${month}`
  const cached = cache.get<RankingRow[]>(cacheKey)
  if (cached) {
    return NextResponse.json({ period: { month, year }, rows: cached })
  }

  try {
    const { start, end } = jakartaMonthRange(year, month)

    const [marketingUsers, activities, tickets] = await Promise.all([
      getMarketingUsers(),
      prisma.marketingActivity.findMany({
        where: { date: { gte: start, lt: end } },
        select: { marketingName: true, flyer: true, sosialisasi: true, dataBase: true, event: true, total: true },
      }),
      prisma.ticket.findMany({
        where: { requestDate: { gte: start, lt: end } },
        select: { marketingName: true },
      }),
    ])

    const namesByKey = new Map<string, string>()
    for (const user of marketingUsers) {
      namesByKey.set(marketingNameKey(user.name), user.name)
    }

    const stats = new Map<string, RankingRow>()

    const ensureRow = (displayName: string): RankingRow => {
      const key = marketingNameKey(displayName)
      let row = stats.get(key)
      if (!row) {
        const name = namesByKey.get(key) ?? normalizeMarketingName(displayName)
        row = { name, skor: 0, psb: 0, flyer: 0, sosialisasi: 0, dataBase: 0, event: 0, total: 0 }
        stats.set(key, row)
        if (!namesByKey.has(key)) namesByKey.set(key, row.name)
      }
      return row
    }

    // Pastikan semua marketing muncul walau belum ada aktivitas
    for (const user of marketingUsers) ensureRow(user.name)

    for (const activity of activities) {
      const row = ensureRow(activity.marketingName)
      row.flyer += activity.flyer
      row.sosialisasi += activity.sosialisasi
      row.dataBase += activity.dataBase
      row.event += activity.event
      row.total += activity.total
    }

    for (const ticket of tickets) {
      const row = ensureRow(ticket.marketingName)
      row.psb += 1
    }

    const rows = Array.from(stats.values()).map((row) => ({
      ...row,
      skor:
        row.psb * WEIGHT.psb +
        row.dataBase * WEIGHT.dataBase +
        row.sosialisasi * WEIGHT.sosialisasi +
        row.flyer * WEIGHT.flyer +
        row.event * WEIGHT.event,
    }))

    rows.sort((a, b) => {
      if (b.skor !== a.skor) return b.skor - a.skor
      if (b.psb !== a.psb) return b.psb - a.psb
      return a.name.localeCompare(b.name)
    })

    const ranked = rows.map((row, index) => ({ rank: index + 1, ...row }))

    cache.set(cacheKey, ranked, 60_000)
    return NextResponse.json({ period: { month, year }, rows: ranked })
  } catch (error) {
    console.error('Failed to build marketing ranking:', error)
    return NextResponse.json({ error: 'Failed to build ranking' }, { status: 500 })
  }
}
