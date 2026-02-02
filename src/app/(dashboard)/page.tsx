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

  // Fetch tickets for manual aggregation (workaround for Prisma groupBy issues on Vercel)
  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      package: true,
      marketingName: true,
      status: true
    }
  })

  // 1. Group by Package
  const packageCounts: Record<string, number> = {}
  tickets.forEach((t: any) => {
    const pkg = t.package || 'Unknown'
    packageCounts[pkg] = (packageCounts[pkg] || 0) + 1
  })

  // 2. Group by Marketing and Status
  const marketingMap = new Map<string, { name: string; open: number; close: number; count: number }>()

  tickets.forEach((t: any) => {
    const name = t.marketingName || 'Unknown'
    const current = marketingMap.get(name) || { name, open: 0, close: 0, count: 0 }
    
    current.count += 1
    
    if (t.status === 'OPEN') {
      current.open += 1
    } else if (t.status === 'CLOSE') {
      current.close += 1
    }
    
    marketingMap.set(name, current)
  })

  const packageOrder = ['HOME LITE', 'HOME BASIC', 'HOME STREAM', 'HOME ENTERTAIN', 'HOME SMALL', 'HOME ADVAN']

  const packageData = Object.entries(packageCounts).map(([name, count]) => ({
    name,
    count
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
