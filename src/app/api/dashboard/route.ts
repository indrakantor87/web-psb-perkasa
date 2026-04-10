import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const year = searchParams.get('year')

  // Default to current month if not specified? 
  // The requirement says "tiap tanggal 1 di bulan baru data menjadi 0".
  // So default view is current month.
  
  const now = new Date()
  const currentMonth = month ? parseInt(month) : now.getMonth() + 1
  const currentYear = year ? parseInt(year) : now.getFullYear()

  // Construct date range for the selected month
  // Note: month is 1-indexed in our params, but 0-indexed in Date constructor
  const startDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1))
  const endDate = new Date(Date.UTC(currentYear, currentMonth, 1))

  try {
    const isSelectedCurrentMonth = (now.getFullYear() === currentYear && (now.getMonth() + 1) === currentMonth)
    const openStatuses = ['OPEN', 'ON_PROGRESS', 'PENDING']

    const whereOr: Prisma.TicketWhereInput[] = [
      { AND: [{ installedDate: { not: null } }, { installedDate: { gte: startDate, lt: endDate } }] },
    ]
    if (isSelectedCurrentMonth) {
      whereOr.push({ AND: [{ installedDate: null }, { status: { in: openStatuses } }, { requestDate: { lt: endDate } }] })
    }
    const where: Prisma.TicketWhereInput = { OR: whereOr }

    // Fetch tickets for manual aggregation (workaround for Prisma groupBy issues on Vercel)
    const tickets = await prisma.ticket.findMany({
      where,
      select: {
        package: true,
        marketingName: true
      }
    })

    // 1. Group by Package
    const packageCounts: Record<string, number> = {}
    tickets.forEach((t) => {
      const pkg = t.package || 'Unknown'
      packageCounts[pkg] = (packageCounts[pkg] || 0) + 1
    })

    // 2. Group by Marketing
    const marketingMap = new Map<string, { name: string, count: number }>()
    
    tickets.forEach((t) => {
      const rawName = t.marketingName || 'Unknown'
      const name = rawName.trim()
      const key = name.toLowerCase()
      
      const current = marketingMap.get(key) || { name, count: 0 }
      current.count += 1
      marketingMap.set(key, current)
    })

    // Format for frontend
    const packageData = Object.entries(packageCounts).map(([name, count]) => ({
      name,
      count
    }))

    const marketingData = Array.from(marketingMap.values())
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      packageData,
      marketingData,
      period: {
        month: currentMonth,
        year: currentYear
      }
    }, {
      headers: {
        // Allow CDN/public caching for short period; dashboard tak berisi data sensitif per user
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
