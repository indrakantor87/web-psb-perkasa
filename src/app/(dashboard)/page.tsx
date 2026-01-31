import { DashboardView } from '@/components/DashboardView'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const resolvedSearchParams = await searchParams
  const monthParam = resolvedSearchParams.month
  const yearParam = resolvedSearchParams.year

  const now = new Date()
  const currentMonth = typeof monthParam === 'string' ? parseInt(monthParam) : now.getMonth() + 1
  const currentYear = typeof yearParam === 'string' ? parseInt(yearParam) : now.getFullYear()

  const startDate = new Date(currentYear, currentMonth - 1, 1)
  const endDate = new Date(currentYear, currentMonth, 1)

  const where: any = {
    requestDate: {
      gte: startDate,
      lt: endDate,
    }
  }

  if (session.user.role === 'MARKETING') {
    where.marketingName = session.user.name
  }

  // 1. Group by Package
  const packages = await prisma.ticket.groupBy({
    by: ['package'],
    where,
    _count: {
      id: true,
    },
  })

  // 2. Group by Marketing and Status
  const marketingStats = await prisma.ticket.groupBy({
    by: ['marketingName', 'status'],
    where,
    _count: {
      id: true,
    },
  })

  const packageOrder = ['HOME LITE', 'HOME BASIC', 'HOME STREAM', 'HOME ENTERTAIN', 'HOME SMALL', 'HOME ADVAN']

  const packageData = packages.map((p: any) => ({
    name: p.package,
    count: p._count.id
  })).sort((a: { name: string }, b: { name: string }) => {
    const indexA = packageOrder.indexOf(a.name)
    const indexB = packageOrder.indexOf(b.name)
    
    // If both are in the list, sort by index
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB
    }
    
    // If only a is in the list, it comes first
    if (indexA !== -1) return -1
    
    // If only b is in the list, it comes first
    if (indexB !== -1) return 1
    
    // If neither, sort alphabetically
    return a.name.localeCompare(b.name)
  })

  // Process marketing stats to aggregate by name
  const marketingMap = new Map<string, { name: string; open: number; close: number; count: number }>()

  marketingStats.forEach((stat: any) => {
    const name = stat.marketingName || 'Unknown'
    const current = marketingMap.get(name) || { name, open: 0, close: 0, count: 0 }
    
    const count = stat._count.id
    current.count += count
    
    if (stat.status === 'OPEN') {
      current.open += count
    } else if (stat.status === 'CLOSE') {
      current.close += count
    }
    // Note: PENDING is included in total count but not shown in separate columns as per request (only Open/Close requested)
    
    marketingMap.set(name, current)
  })

  const marketingData = Array.from(marketingMap.values())
    .sort((a, b) => b.count - a.count)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
      <DashboardView 
        packageData={packageData} 
        marketingData={marketingData}
        initialPeriod={{ month: currentMonth, year: currentYear }}
      />
    </div>
  )
}
