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

    // 1. Group by Package
    const packages = await prisma.ticket.groupBy({
      by: ['package'],
      where,
      _count: {
        id: true,
      },
    })

    // 2. Group by Marketing
    const marketingStats = await prisma.ticket.groupBy({
      by: ['marketingName'],
      where,
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    })

    // Format for frontend
    const packageData = packages.map((p: any) => ({
      name: p.package,
      count: p._count.id
    }))

    const marketingData = marketingStats.map((m: any) => ({
      name: m.marketingName,
      count: m._count.id
    }))

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
