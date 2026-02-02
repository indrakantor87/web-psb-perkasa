import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

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
  const startDate = new Date(currentYear, currentMonth - 1, 1)
  const endDate = new Date(currentYear, currentMonth, 1)

  try {
    const where = {
      requestDate: {
        gte: startDate,
        lt: endDate,
      }
    }

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
    tickets.forEach((t: any) => {
      const pkg = t.package || 'Unknown'
      packageCounts[pkg] = (packageCounts[pkg] || 0) + 1
    })

    // 2. Group by Marketing
    const marketingCounts: Record<string, number> = {}
    tickets.forEach((t: any) => {
      const name = t.marketingName || 'Unknown'
      marketingCounts[name] = (marketingCounts[name] || 0) + 1
    })

    // Format for frontend
    const packageData = Object.entries(packageCounts).map(([name, count]) => ({
      name,
      count
    }))

    const marketingData = Object.entries(marketingCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count)

    return NextResponse.json({
      packageData,
      marketingData,
      period: {
        month: currentMonth,
        year: currentYear
      }
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
